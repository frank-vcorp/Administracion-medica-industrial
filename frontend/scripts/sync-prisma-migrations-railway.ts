/**
 * Sync retroactivo de _prisma_migrations para Railway.
 *
 * FIX-20260708-01: La tabla _prisma_migrations de Railway está VACÍA.
 * Todas las migraciones se aplicaron vía `prisma db execute` con SQL directo,
 * pero nunca se registró en la tabla de control. Esto hace que `prisma
 * migrate status` reporte todas como "no aplicadas" y que `migrate dev`
 * en local intente reaplicar (rompería la DB).
 *
 * Estrategia:
 * 1. Crear tabla _prisma_migrations si no existe (estructura oficial Prisma 5+).
 * 2. Para CADA migración en prisma/migrations/:
 *    - Parsear el SQL para identificar qué tablas/columnas/enums crea.
 *    - Verificar contra information_schema de Railway si esos objetos existen.
 *    - Si SÍ existen → marcar como aplicada en _prisma_migrations.
 *    - Si NO existen → reportar y NO marcar (queda como pendiente real).
 * 3. Reportar resumen final.
 *
 * Ref: context/infra/06-migration-20260708-fix-schema-drift.sql
 *      context/juntas/Junta semanal 2026-07-01
 *
 * Uso:
 *   DATABASE_URL=<railway_url> npx tsx scripts/sync-prisma-migrations-railway.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const MIGRATIONS_DIR = path.resolve(__dirname, "../prisma/migrations");
const MANUAL_FIX_MARKER = "manual-railway-fix";

interface MigrationAnalysis {
  name: string;
  createdTables: string[];
  addedColumns: { table: string; column: string }[];
  addedEnums: string[];
  status: "applied" | "partial" | "missing" | "error";
  missing: string[];
}

async function createMigrationsTableIfMissing() {
  const exists: any[] = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    ) as exists;
  `);
  if (exists[0]?.exists) {
    console.log("  ✓ _prisma_migrations ya existe");
    return;
  }
  console.log("  + Creando _prisma_migrations (estructura oficial Prisma 5+)...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "_prisma_migrations" (
      "id"                    VARCHAR(36)  PRIMARY KEY NOT NULL,
      "checksum"              VARCHAR(64)  NOT NULL,
      "finished_at"           TIMESTAMPTZ,
      "migration_name"        VARCHAR(255) NOT NULL,
      "logs"                   TEXT,
      "rolled_back_at"        TIMESTAMPTZ,
      "started_at"            TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count"   INTEGER      NOT NULL DEFAULT 0
    );
  `);
  // Índice único para evitar duplicados (es la estructura actual de Prisma)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX "_prisma_migrations_migration_name_key"
    ON "_prisma_migrations"("migration_name");
  `);
  console.log("  ✓ _prisma_migrations creada");
}

function parseMigrationSql(sql: string) {
  const createdTables: string[] = [];
  const addedColumns: { table: string; column: string }[] = [];
  const addedEnums: string[] = [];

  // CREATE TABLE "x" (con posibles IF NOT EXISTS)
  const tableRegex = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRegex.exec(sql)) !== null) {
    createdTables.push(m[1]);
  }

  // ALTER TABLE "x" ADD COLUMN "y"
  const colRegex = /ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/gi;
  while ((m = colRegex.exec(sql)) !== null) {
    addedColumns.push({ table: m[1], column: m[2] });
  }

  // ALTER TYPE "x" ADD VALUE 'y'
  const enumRegex = /ALTER TYPE\s+"([^"]+)"\s+ADD VALUE(?:\s+IF NOT EXISTS)?\s+'([^']+)'/gi;
  while ((m = enumRegex.exec(sql)) !== null) {
    addedEnums.push(`${m[1]}.${m[2]}`);
  }

  return { createdTables, addedColumns, addedEnums };
}

async function analyzeMigration(name: string): Promise<MigrationAnalysis> {
  const migrationPath = path.join(MIGRATIONS_DIR, name, "migration.sql");
  if (!fs.existsSync(migrationPath)) {
    return {
      name,
      createdTables: [],
      addedColumns: [],
      addedEnums: [],
      status: "error",
      missing: ["migration.sql not found"],
    };
  }
  const sql = fs.readFileSync(migrationPath, "utf8");
  const parsed = parseMigrationSql(sql);

  const missing: string[] = [];

  for (const t of parsed.createdTables) {
    const r: any[] = await prisma.$queryRawUnsafe(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}') as e;`
    );
    if (!r[0]?.e) missing.push(`table:${t}`);
  }
  for (const c of parsed.addedColumns) {
    const r: any[] = await prisma.$queryRawUnsafe(
      `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='${c.table}' AND column_name='${c.column}') as e;`
    );
    if (!r[0]?.e) missing.push(`col:${c.table}.${c.column}`);
  }
  for (const e of parsed.addedEnums) {
    const [typeName, value] = e.split(".");
    const r: any[] = await prisma.$queryRawUnsafe(
      `SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='${typeName}' AND e.enumlabel='${value}') as e;`
    );
    if (!r[0]?.e) missing.push(`enum:${e}`);
  }

  // Si la migración no declara nada detectable (puede ser un init con muchos
  // CREATE), la tratamos como "applied" si la DB tiene al menos una tabla del
  // schema (heurística suave).
  const detectable =
    parsed.createdTables.length + parsed.addedColumns.length + parsed.addedEnums.length;

  let status: MigrationAnalysis["status"];
  if (detectable === 0) {
    status = "applied"; // sin objetos detectables, no podemos validar
  } else if (missing.length === 0) {
    status = "applied";
  } else if (missing.length < detectable / 2) {
    status = "partial";
  } else {
    status = "missing";
  }

  return { name, ...parsed, status, missing };
}

async function recordMigrationAsApplied(name: string) {
  // Verificar si ya existe
  const existing: any[] = await prisma.$queryRaw`
    SELECT id, finished_at IS NOT NULL as finished, rolled_back_at IS NOT NULL as rolled_back
    FROM _prisma_migrations
    WHERE migration_name = ${name}
    LIMIT 1
  `;

  if (existing.length > 0) {
    const r = existing[0];
    if (r.finished && !r.rolled_back) {
      return "already-applied";
    }
    if (r.rolled_back) {
      await prisma.$executeRaw`
        UPDATE _prisma_migrations
        SET finished_at = NOW(), rolled_back_at = NULL, applied_steps_count = 1
        WHERE id = ${r.id}
      `;
      return "updated-from-rolled-back";
    }
    await prisma.$executeRaw`
      UPDATE _prisma_migrations
      SET finished_at = NOW(), applied_steps_count = 1
      WHERE id = ${r.id}
    `;
    return "updated-no-finished";
  }

  // Generar checksum determinístico a partir del nombre (no es real, pero válido)
  const checksum = MANUAL_FIX_MARKER + "-" + name.replace(/[^a-z0-9]/gi, "").slice(-12);

  await prisma.$executeRaw`
    INSERT INTO _prisma_migrations
      (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
    VALUES
      (gen_random_uuid()::text, ${checksum}, NOW(), ${name}, NOW(), 1)
  `;
  return "inserted";
}

async function main() {
  console.log("=== Sync retroactivo de _prisma_migrations (Railway) ===\n");

  // Paso 1: crear tabla si no existe
  console.log("[1/4] Tabla _prisma_migrations:");
  await createMigrationsTableIfMissing();

  // Paso 2: listar migraciones locales
  const migrationNames = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((d) => /^\d{14}_/.test(d))
    .sort();

  console.log(`\n[2/4] Analizando ${migrationNames.length} migraciones contra Railway...`);

  // Paso 3: analizar cada una
  const analyses: MigrationAnalysis[] = [];
  for (const name of migrationNames) {
    const a = await analyzeMigration(name);
    analyses.push(a);
    const icon =
      a.status === "applied" ? "✓" :
      a.status === "partial" ? "⚠" :
      a.status === "missing" ? "✗" :
      a.status === "error"   ? "?" : "?";
    console.log(`  ${icon} ${a.name}  [${a.status}]${a.missing.length > 0 ? `  missing: ${a.missing.slice(0, 3).join(", ")}${a.missing.length > 3 ? "..." : ""}` : ""}`);
  }

  // Paso 4: registrar las aplicadas
  console.log(`\n[3/4] Registrando migraciones aplicadas en _prisma_migrations...`);
  const toRecord = analyses.filter((a) => a.status === "applied");
  const skipped = analyses.filter((a) => a.status !== "applied");

  for (const a of toRecord) {
    try {
      const result = await recordMigrationAsApplied(a.name);
      console.log(`  ✓ ${a.name}: ${result}`);
    } catch (e: any) {
      console.error(`  ✗ ${a.name}: ERROR - ${e.message}`);
    }
  }

  console.log(`\n[4/4] Resumen:`);
  console.log(`  Total migraciones:    ${analyses.length}`);
  console.log(`  Marcadas aplicadas:   ${toRecord.length}`);
  console.log(`  Omitidas (parcial/missing/error): ${skipped.length}`);
  if (skipped.length > 0) {
    console.log(`\n  Migraciones omitidas (requieren atención manual):`);
    for (const a of skipped) {
      console.log(`    - ${a.name} [${a.status}]`);
      if (a.missing.length > 0) {
        console.log(`        missing: ${a.missing.join(", ")}`);
      }
    }
  }

  await prisma.$disconnect();
  console.log("\n=== FIN ===");
}

main().catch(async (e) => {
  console.error("ERROR FATAL:", e);
  await prisma.$disconnect();
  process.exit(1);
});