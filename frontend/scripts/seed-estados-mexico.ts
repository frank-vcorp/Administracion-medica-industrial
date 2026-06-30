/**
 * Aplica el seed de estados_mexico + sincroniza _prisma_migrations.
 * Específico para FIX-20260624-08. Idempotente.
 *
 * USO:
 *   railway run --service "Administracion-medica-industrial" npx tsx scripts/seed-estados-mexico.ts
 */
import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { resolve } from "path"

const prisma = new PrismaClient()

const MIGRATION_NAME = "20260630180000_seed_estados_mexico"

async function run() {
  console.log("=== INICIO: Seed de estados_mexico + sync _prisma_migrations ===\n")

  // 1. Verificar conteo actual
  const beforeCount: Array<{ n: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::int as n FROM estados_mexico
  `
  console.log(`Estados actuales en la tabla: ${beforeCount[0]?.n ?? 0}`)

  // 2. Cargar y ejecutar el seed SQL (idempotente)
  const sqlPath = resolve(__dirname, "../../context/infra/06-seed-estados-mexico.sql")
  console.log(`Cargando seed desde: ${sqlPath}`)
  const sql = readFileSync(sqlPath, "utf-8")
  await prisma.$executeRawUnsafe(sql)
  console.log("✓ Seed ejecutado (idempotente con ON CONFLICT)")

  // 3. Verificar conteo después
  const afterCount: Array<{ n: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::int as n FROM estados_mexico
  `
  const total = Number(afterCount[0]?.n ?? 0)
  console.log(`Estados después del seed: ${total}`)
  if (total === 32) {
    console.log("✓ Total correcto: 32 estados")
  } else if (total > 0) {
    console.log(`⚠ Solo hay ${total} estados. Revisar el script SQL (deberían ser 32).`)
  } else {
    console.log("✗ La tabla sigue vacía. Algo falló.")
    process.exit(1)
  }

  // 4. Sincronizar _prisma_migrations (idempotente)
  console.log("\nSincronizando _prisma_migrations...")

  // Crear tabla si no existe
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) NOT NULL,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
    )
  `)

  // Borrar si existe, luego insertar (idempotente)
  await prisma.$executeRaw`
    DELETE FROM "_prisma_migrations" WHERE "migration_name" = ${MIGRATION_NAME}
  `
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
    VALUES (gen_random_uuid()::text, 'manual-railway-fix-seed', NOW(), ${MIGRATION_NAME}, NOW(), 1)
  `
  console.log(`✓ Migración "${MIGRATION_NAME}" registrada como aplicada`)

  // 5. Verificación final
  const sample: any[] = await prisma.$queryRaw`
    SELECT nombre, array_length(municipios, 1) AS n_mun FROM estados_mexico ORDER BY id LIMIT 5
  `
  console.log("\nMuestra de los primeros 5 estados:")
  sample.forEach((s: any) => console.log(`  • ${s.nombre} (${s.n_mun} municipios)`))

  await prisma.$disconnect()
  console.log("\n=== FIN: Seed aplicado exitosamente ===")
}

run().catch(async (e) => {
  console.error("ERROR FATAL:", e)
  await prisma.$disconnect()
  process.exit(1)
})
