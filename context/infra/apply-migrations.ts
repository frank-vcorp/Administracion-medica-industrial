/**
 * @fileoverview Script de Node que aplica las migraciones pendientes de Prisma en la DB de Railway
 * @id FIX-20260624-06
 *
 * USO:
 *   railway run --service frontend node -e "require('./context/infra/apply-migrations.js')"
 *
 * O bien, con DATABASE_URL apuntando a Railway:
 *   DATABASE_URL="postgresql://..." npx tsx context/infra/apply-migrations.ts
 *
 * El script es IDEMPOTENTE: usa verificaciones antes de cada cambio.
 */

import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { resolve } from "path"

const prisma = new PrismaClient()

interface CheckResult {
  name: string
  exists: boolean
}

async function checkTable(name: string): Promise<boolean> {
  const r = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS exists
  `
  return r[0]?.exists ?? false
}

async function checkColumn(table: string, column: string): Promise<boolean> {
  const r = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
    ) AS exists
  `
  return r[0]?.exists ?? false
}

async function checkType(name: string): Promise<boolean> {
  const r = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (SELECT FROM pg_type WHERE typname = ${name}) AS exists
  `
  return r[0]?.exists ?? false
}

async function checkEnumValue(enumName: string, value: string): Promise<boolean> {
  const r = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = ${value}
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = ${enumName})
    ) AS exists
  `
  return r[0]?.exists ?? false
}

async function checkConstraint(constraintName: string, table: string): Promise<boolean> {
  const r = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = ${constraintName} AND table_name = ${table}
    ) AS exists
  `
  return r[0]?.exists ?? false
}

async function run() {
  console.log("=== INICIO: Aplicación de migraciones pendientes ===\n")

  // 0. Diagnóstico inicial
  console.log("--- 0. Diagnóstico inicial ---")
  const diag0: CheckResult[] = [
    { name: "_prisma_migrations existe", exists: await checkTable("_prisma_migrations") },
    { name: "IntakeSource existe", exists: await checkType("IntakeSource") },
    { name: "medical_events.intakeSource existe", exists: await checkColumn("medical_events", "intakeSource") },
    { name: "medical_events.projectId existe", exists: await checkColumn("medical_events", "projectId") },
    { name: "medical_events.intakeCreatedByUserId existe", exists: await checkColumn("medical_events", "intakeCreatedByUserId") },
    { name: "UserRole.VENDEDOR existe", exists: await checkEnumValue("UserRole", "VENDEDOR") },
    { name: "CompanyStatus existe", exists: await checkType("CompanyStatus") },
    { name: "CompanyOrigin existe", exists: await checkType("CompanyOrigin") },
    { name: "CompanySelfRegStatus existe", exists: await checkType("CompanySelfRegStatus") },
    { name: "CfdiUso existe", exists: await checkType("CfdiUso") },
    { name: "companies.sellerId existe", exists: await checkColumn("companies", "sellerId") },
    { name: "companies.origen existe", exists: await checkColumn("companies", "origen") },
    { name: "companies.estado existe", exists: await checkColumn("companies", "estado") },
    { name: "company_seller_history existe", exists: await checkTable("company_seller_history") },
    { name: "company_self_registrations existe", exists: await checkTable("company_self_registrations") },
    { name: "estados_mexico existe", exists: await checkTable("estados_mexico") },
    { name: "company_self_registrations.channel existe", exists: await checkColumn("company_self_registrations", "channel") },
  ]
  diag0.forEach((r) => console.log(`  ${r.exists ? "✓" : "✗"} ${r.name}`))
  console.log()

  // 1. MIGRACIÓN 20260527121500
  console.log("--- 1. MIGRACIÓN 20260527121500_add_intake_trace_to_medical_event ---")
  try {
    if (!(await checkType("IntakeSource"))) {
      await prisma.$executeRaw`
        CREATE TYPE "IntakeSource" AS ENUM (
          'APPOINTMENT', 'PROJECT_PRE_REGISTERED', 'PROJECT_SAME_DAY',
          'EXTERNAL_WALK_IN', 'DIRECT_RECEPTION'
        )
      `
      console.log("  ✓ Creado enum IntakeSource")
    } else {
      console.log("  ⊙ Enum IntakeSource ya existe")
    }

    await prisma.$executeRaw`
      ALTER TABLE "medical_events"
        ADD COLUMN IF NOT EXISTS "intakeSource" "IntakeSource",
        ADD COLUMN IF NOT EXISTS "projectId" TEXT,
        ADD COLUMN IF NOT EXISTS "intakeCreatedByUserId" TEXT
    `
    console.log("  ✓ Columnas agregadas/verificadas en medical_events")

    if (!(await checkConstraint("medical_events_projectId_fkey", "medical_events"))) {
      await prisma.$executeRaw`
        ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_projectId_fkey"
          FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `
      console.log("  ✓ FK medical_events_projectId_fkey creada")
    }
    if (!(await checkConstraint("medical_events_intakeCreatedByUserId_fkey", "medical_events"))) {
      await prisma.$executeRaw`
        ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_intakeCreatedByUserId_fkey"
          FOREIGN KEY ("intakeCreatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `
      console.log("  ✓ FK medical_events_intakeCreatedByUserId_fkey creada")
    }

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "medical_events_projectId_idx" ON "medical_events"("projectId")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "medical_events_intakeCreatedByUserId_idx" ON "medical_events"("intakeCreatedByUserId")`
    console.log("  ✓ Índices creados/verificados")
  } catch (e) {
    console.error("  ✗ Error:", (e as Error).message)
    throw e
  }
  console.log()

  // 2. MIGRACIÓN 20260623170000 (parte A: enums + companies columns)
  console.log("--- 2. MIGRACIÓN 20260623170000_company_v2_vendedor (PARTE A) ---")
  try {
    if (!(await checkEnumValue("UserRole", "VENDEDOR"))) {
      await prisma.$executeRaw`ALTER TYPE "UserRole" ADD VALUE 'VENDEDOR' AFTER 'COMPANY_CLIENT'`
      console.log("  ✓ Valor VENDEDOR agregado a UserRole")
    } else {
      console.log("  ⊙ VENDEDOR ya existe en UserRole")
    }

    for (const def of [
      { name: "CompanyStatus", sql: `CREATE TYPE "CompanyStatus" AS ENUM ('PENDIENTE_REVISION', 'HABILITADO', 'DESHABILITADO')` },
      { name: "CompanyOrigin", sql: `CREATE TYPE "CompanyOrigin" AS ENUM ('MANUAL', 'AUTO_ALTA')` },
      { name: "CompanySelfRegStatus", sql: `CREATE TYPE "CompanySelfRegStatus" AS ENUM ('ACTIVE', 'SUBMITTED', 'EXPIRED', 'CANCELLED')` },
      { name: "CfdiUso", sql: `CREATE TYPE "CfdiUso" AS ENUM ('G01','G02','G03','B01','B02','B03','B04','B05','B06','B07','B08','B09','B10','B11','B12','B13','B14','B15','B16','B17','B18','B19','B20','P01','S01','CP01','CN01')` },
    ]) {
      if (!(await checkType(def.name))) {
        await prisma.$executeRawUnsafe(def.sql)
        console.log(`  ✓ Creado enum ${def.name}`)
      } else {
        console.log(`  ⊙ Enum ${def.name} ya existe`)
      }
    }

    await prisma.$executeRaw`
      ALTER TABLE "companies"
        ADD COLUMN IF NOT EXISTS "sellerId"          TEXT,
        ADD COLUMN IF NOT EXISTS "sellerAssignedAt"  TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "origen"            "CompanyOrigin" NOT NULL DEFAULT 'MANUAL',
        ADD COLUMN IF NOT EXISTS "estado"            "CompanyStatus" NOT NULL DEFAULT 'HABILITADO',
        ADD COLUMN IF NOT EXISTS "enabledAt"         TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "enabledByUserId"   TEXT,
        ADD COLUMN IF NOT EXISTS "fiscalData"        JSONB,
        ADD COLUMN IF NOT EXISTS "repLegalData"      JSONB,
        ADD COLUMN IF NOT EXISTS "rhData"            JSONB,
        ADD COLUMN IF NOT EXISTS "cuentasPagarData"  JSONB,
        ADD COLUMN IF NOT EXISTS "referenciasData"   JSONB,
        ADD COLUMN IF NOT EXISTS "terminosAceptados" BOOLEAN,
        ADD COLUMN IF NOT EXISTS "documentosAdjuntos" JSONB
    `
    console.log("  ✓ Columnas agregadas/verificadas en companies")

    await prisma.$executeRaw`
      UPDATE "companies"
      SET "origen" = 'MANUAL',
          "estado" = 'HABILITADO',
          "enabledAt" = COALESCE("enabledAt", NOW())
      WHERE "origen" IS NULL OR "estado" IS NULL
    `
    await prisma.$executeRaw`
      UPDATE "companies" c
      SET "enabledByUserId" = (SELECT u.id FROM "users" u WHERE u.role = 'ADMIN' ORDER BY u."createdAt" ASC LIMIT 1)
      WHERE c."enabledByUserId" IS NULL
    `
    console.log("  ✓ Backfill de companies ejecutado")

    if (!(await checkConstraint("companies_sellerId_fkey", "companies"))) {
      await prisma.$executeRaw`
        ALTER TABLE "companies" ADD CONSTRAINT "companies_sellerId_fkey"
          FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `
      console.log("  ✓ FK companies_sellerId_fkey creada")
    }
    if (!(await checkConstraint("companies_enabledByUserId_fkey", "companies"))) {
      await prisma.$executeRaw`
        ALTER TABLE "companies" ADD CONSTRAINT "companies_enabledByUserId_fkey"
          FOREIGN KEY ("enabledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `
      console.log("  ✓ FK companies_enabledByUserId_fkey creada")
    }

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "companies_sellerId_idx" ON "companies"("sellerId")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "companies_estado_idx" ON "companies"("estado")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "companies_origen_idx" ON "companies"("origen")`
    console.log("  ✓ Índices de companies creados/verificados")
  } catch (e) {
    console.error("  ✗ Error:", (e as Error).message)
    throw e
  }
  console.log()

  // 3. MIGRACIÓN 20260623170000 (parte B: tablas) + 20260624120000
  console.log("--- 3. MIGRACIÓN 20260623170000 (PARTE B) + 20260624120000 ---")
  try {
    if (!(await checkTable("company_seller_history"))) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "company_seller_history" (
          "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "companyId"        TEXT NOT NULL,
          "previousSellerId" TEXT,
          "newSellerId"      TEXT,
          "changedByUserId"  TEXT NOT NULL,
          "changedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "reason"           TEXT,
          CONSTRAINT "company_seller_history_pkey" PRIMARY KEY ("id")
        )
      `)
      console.log("  ✓ Tabla company_seller_history creada")
    } else {
      console.log("  ⊙ Tabla company_seller_history ya existe")
    }
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "company_seller_history_companyId_changedAt_idx" ON "company_seller_history"("companyId", "changedAt")`
    if (!(await checkConstraint("company_seller_history_companyId_fkey", "company_seller_history"))) {
      await prisma.$executeRaw`ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    }
    if (!(await checkConstraint("company_seller_history_previousSellerId_fkey", "company_seller_history"))) {
      await prisma.$executeRaw`ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_previousSellerId_fkey" FOREIGN KEY ("previousSellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    }
    if (!(await checkConstraint("company_seller_history_newSellerId_fkey", "company_seller_history"))) {
      await prisma.$executeRaw`ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_newSellerId_fkey" FOREIGN KEY ("newSellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    }
    if (!(await checkConstraint("company_seller_history_changedByUserId_fkey", "company_seller_history"))) {
      await prisma.$executeRaw`ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`
    }
    console.log("  ✓ Tabla company_seller_history completa")

    if (!(await checkTable("company_self_registrations"))) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "company_self_registrations" (
          "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "tokenHash"          TEXT NOT NULL,
          "companyDraft"       JSONB,
          "uploadedFiles"      JSONB NOT NULL DEFAULT '[]'::jsonb,
          "status"             "CompanySelfRegStatus" NOT NULL DEFAULT 'ACTIVE',
          "expiresAt"          TIMESTAMP(3) NOT NULL,
          "openedCount"        INTEGER NOT NULL DEFAULT 0,
          "submittedAt"        TIMESTAMP(3),
          "submittedCompanyId" TEXT,
          "createdByUserId"    TEXT,
          "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt"          TIMESTAMP(3) NOT NULL,
          CONSTRAINT "company_self_registrations_pkey" PRIMARY KEY ("id")
        )
      `)
      console.log("  ✓ Tabla company_self_registrations creada")
    } else {
      console.log("  ⊙ Tabla company_self_registrations ya existe")
    }
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "company_self_registrations_tokenHash_key" ON "company_self_registrations"("tokenHash")`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "company_self_registrations_submittedCompanyId_key" ON "company_self_registrations"("submittedCompanyId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "company_self_registrations_status_idx" ON "company_self_registrations"("status")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "company_self_registrations_expiresAt_idx" ON "company_self_registrations"("expiresAt")`)
    if (!(await checkConstraint("company_self_registrations_submittedCompanyId_fkey", "company_self_registrations"))) {
      await prisma.$executeRaw`ALTER TABLE "company_self_registrations" ADD CONSTRAINT "company_self_registrations_submittedCompanyId_fkey" FOREIGN KEY ("submittedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    }
    if (!(await checkConstraint("company_self_registrations_createdByUserId_fkey", "company_self_registrations"))) {
      await prisma.$executeRaw`ALTER TABLE "company_self_registrations" ADD CONSTRAINT "company_self_registrations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    }
    console.log("  ✓ Tabla company_self_registrations completa")

    if (!(await checkTable("estados_mexico"))) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "estados_mexico" (
          "id"        INTEGER NOT NULL,
          "nombre"    TEXT NOT NULL,
          "municipios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
          CONSTRAINT "estados_mexico_pkey" PRIMARY KEY ("id")
        )
      `)
      console.log("  ✓ Tabla estados_mexico creada")
    } else {
      console.log("  ⊙ Tabla estados_mexico ya existe")
    }

    await prisma.$executeRaw`ALTER TABLE "company_self_registrations" ADD COLUMN IF NOT EXISTS "channel" TEXT DEFAULT 'VENDOR_LINK'`
    console.log("  ✓ Columna channel agregada/verificada")
  } catch (e) {
    console.error("  ✗ Error:", (e as Error).message)
    throw e
  }
  console.log()

  // 4. SINCRONIZAR _prisma_migrations
  console.log("--- 4. Sincronizando _prisma_migrations ---")
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
          "id"                  VARCHAR(36)  NOT NULL,
          "checksum"            VARCHAR(64)  NOT NULL,
          "finished_at"         TIMESTAMPTZ,
          "migration_name"      VARCHAR(255) NOT NULL,
          "logs"                TEXT,
          "rolled_back_at"      TIMESTAMPTZ,
          "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "applied_steps_count" INTEGER      NOT NULL DEFAULT 0,
          CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
      )
    `)
    await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations"
      WHERE "migration_name" IN (
          '20260527121500_add_intake_trace_to_medical_event',
          '20260623170000_company_v2_vendedor_historial_link_publico',
          '20260624120000_company_self_reg_channel'
      )
    `
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
      VALUES
          (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260527121500_add_intake_trace_to_medical_event', NOW(), 1),
          (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260623170000_company_v2_vendedor_historial_link_publico', NOW(), 1),
          (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260624120000_company_self_reg_channel', NOW(), 1)
      ON CONFLICT ("migration_name") DO UPDATE SET
          "finished_at" = NOW(),
          "rolled_back_at" = NULL,
          "applied_steps_count" = 1
    `)
    console.log("  ✓ _prisma_migrations sincronizado")
  } catch (e) {
    console.error("  ✗ Error:", (e as Error).message)
    throw e
  }
  console.log()

  // 5. Verificación final
  console.log("--- 5. Verificación final ---")
  const appliedCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::int AS count FROM "_prisma_migrations"
    WHERE "migration_name" IN (
      '20260527121500_add_intake_trace_to_medical_event',
      '20260623170000_company_v2_vendedor_historial_link_publico',
      '20260624120000_company_self_reg_channel'
    ) AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
  `
  const finalDiag: CheckResult[] = [
    { name: "companies.sellerId existe", exists: await checkColumn("companies", "sellerId") },
    { name: "IntakeSource existe", exists: await checkType("IntakeSource") },
    { name: "company_self_registrations existe", exists: await checkTable("company_self_registrations") },
    { name: "company_seller_history existe", exists: await checkTable("company_seller_history") },
    { name: "estados_mexico existe", exists: await checkTable("estados_mexico") },
    { name: "company_self_registrations.channel existe", exists: await checkColumn("company_self_registrations", "channel") },
  ]
  finalDiag.forEach((r) => console.log(`  ${r.exists ? "✓" : "✗"} ${r.name}`))

  const count = Number(appliedCount[0]?.count ?? 0)
  console.log(`\n  Migraciones aplicadas: ${count} / 3`)

  if (count === 3 && finalDiag.every((r) => r.exists)) {
    console.log("\n✅ OK: La DB está sincronizada. Refresca /workers y /companies en el navegador.")
  } else {
    console.log("\n❌ INCOMPLETO: Revisa los mensajes de error arriba.")
  }
  console.log("\n=== FIN ===")
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("ERROR FATAL:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
