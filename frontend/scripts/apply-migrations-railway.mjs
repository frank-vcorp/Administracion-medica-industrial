// @ts-check
/**
 * Script JS ejecutable con Node para aplicar migraciones pendientes a Railway.
 * Se ejecuta con: railway run --service frontend node ./scripts/apply-migrations-railway.mjs
 *
 * Usa el cliente Prisma del proyecto. Es idempotente.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const log = (msg) => console.log(msg)
const ok = (msg) => console.log(`  ✓ ${msg}`)
const skip = (msg) => console.log(`  ⊙ ${msg}`)
const fail = (msg) => console.error(`  ✗ ${msg}`)

async function checkTable(name) {
  const r = await prisma.$queryRaw`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${name}) AS exists`
  return Boolean(r[0]?.exists)
}

async function checkColumn(table, column) {
  const r = await prisma.$queryRaw`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}) AS exists`
  return Boolean(r[0]?.exists)
}

async function checkType(name) {
  const r = await prisma.$queryRaw`SELECT EXISTS (SELECT FROM pg_type WHERE typname = ${name}) AS exists`
  return Boolean(r[0]?.exists)
}

async function checkEnumValue(enumName, value) {
  const r = await prisma.$queryRaw`SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = ${value} AND enumtypid = (SELECT oid FROM pg_type WHERE typname = ${enumName})) AS exists`
  return Boolean(r[0]?.exists)
}

async function checkConstraint(constraintName, table) {
  const r = await prisma.$queryRaw`SELECT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = ${constraintName} AND table_name = ${table}) AS exists`
  return Boolean(r[0]?.exists)
}

async function run() {
  log("=== INICIO: Aplicación de migraciones pendientes ===\n")

  // 0. Diagnóstico
  log("--- 0. Diagnóstico inicial ---")
  const checks = {
    migrations: await checkTable("_prisma_migrations"),
    intakeSource: await checkType("IntakeSource"),
    me_intakeSource: await checkColumn("medical_events", "intakeSource"),
    me_projectId: await checkColumn("medical_events", "projectId"),
    me_intakeCreatedBy: await checkColumn("medical_events", "intakeCreatedByUserId"),
    userRoleVendedor: await checkEnumValue("UserRole", "VENDEDOR"),
    companyStatus: await checkType("CompanyStatus"),
    companyOrigin: await checkType("CompanyOrigin"),
    companySelfRegStatus: await checkType("CompanySelfRegStatus"),
    cfdiUso: await checkType("CfdiUso"),
    co_sellerId: await checkColumn("companies", "sellerId"),
    co_origen: await checkColumn("companies", "origen"),
    co_estado: await checkColumn("companies", "estado"),
    sellerHistory: await checkTable("company_seller_history"),
    selfReg: await checkTable("company_self_registrations"),
    estadosMexico: await checkTable("estados_mexico"),
    selfRegChannel: await checkColumn("company_self_registrations", "channel"),
  }
  Object.entries(checks).forEach(([k, v]) => log(`  ${v ? "✓" : "✗"} ${k}`))
  log("")

  // 1. MIGRACIÓN 20260527121500
  log("--- 1. MIGRACIÓN 20260527121500_add_intake_trace_to_medical_event ---")
  try {
    if (!checks.intakeSource) {
      await prisma.$executeRaw`CREATE TYPE "IntakeSource" AS ENUM ('APPOINTMENT', 'PROJECT_PRE_REGISTERED', 'PROJECT_SAME_DAY', 'EXTERNAL_WALK_IN', 'DIRECT_RECEPTION')`
      ok("Creado enum IntakeSource")
    } else {
      skip("Enum IntakeSource ya existe")
    }

    await prisma.$executeRaw`ALTER TABLE "medical_events" ADD COLUMN IF NOT EXISTS "intakeSource" "IntakeSource", ADD COLUMN IF NOT EXISTS "projectId" TEXT, ADD COLUMN IF NOT EXISTS "intakeCreatedByUserId" TEXT`
    ok("Columnas en medical_events verificadas")

    if (!(await checkConstraint("medical_events_projectId_fkey", "medical_events"))) {
      await prisma.$executeRaw`ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE`
      ok("FK medical_events_projectId_fkey creada")
    } else skip("FK medical_events_projectId_fkey ya existe")

    if (!(await checkConstraint("medical_events_intakeCreatedByUserId_fkey", "medical_events"))) {
      await prisma.$executeRaw`ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_intakeCreatedByUserId_fkey" FOREIGN KEY ("intakeCreatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`
      ok("FK medical_events_intakeCreatedByUserId_fkey creada")
    } else skip("FK medical_events_intakeCreatedByUserId_fkey ya existe")

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "medical_events_projectId_idx" ON "medical_events"("projectId")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "medical_events_intakeCreatedByUserId_idx" ON "medical_events"("intakeCreatedByUserId")`
    ok("Índices verificados")
  } catch (e) {
    fail(`Error: ${e.message}`)
    throw e
  }
  log("")

  // 2. MIGRACIÓN 20260623170000 (parte A)
  log("--- 2. MIGRACIÓN 20260623170000 (PARTE A: enums + companies) ---")
  try {
    if (!checks.userRoleVendedor) {
      await prisma.$executeRaw`ALTER TYPE "UserRole" ADD VALUE 'VENDEDOR' AFTER 'COMPANY_CLIENT'`
      ok("VENDEDOR agregado a UserRole")
    } else skip("VENDEDOR ya existe en UserRole")

    for (const def of [
      { name: "CompanyStatus", sql: `CREATE TYPE "CompanyStatus" AS ENUM ('PENDIENTE_REVISION', 'HABILITADO', 'DESHABILITADO')` },
      { name: "CompanyOrigin", sql: `CREATE TYPE "CompanyOrigin" AS ENUM ('MANUAL', 'AUTO_ALTA')` },
      { name: "CompanySelfRegStatus", sql: `CREATE TYPE "CompanySelfRegStatus" AS ENUM ('ACTIVE', 'SUBMITTED', 'EXPIRED', 'CANCELLED')` },
      { name: "CfdiUso", sql: `CREATE TYPE "CfdiUso" AS ENUM ('G01','G02','G03','B01','B02','B03','B04','B05','B06','B07','B08','B09','B10','B11','B12','B13','B14','B15','B16','B17','B18','B19','B20','P01','S01','CP01','CN01')` },
    ]) {
      if (!checks[def.name === "CompanyStatus" ? "companyStatus" : def.name === "CompanyOrigin" ? "companyOrigin" : def.name === "CompanySelfRegStatus" ? "companySelfRegStatus" : "cfdiUso"]) {
        await prisma.$executeRawUnsafe(def.sql)
        ok(`Creado enum ${def.name}`)
      } else {
        skip(`Enum ${def.name} ya existe`)
      }
    }

    await prisma.$executeRaw`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "sellerId" TEXT, ADD COLUMN IF NOT EXISTS "sellerAssignedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "origen" "CompanyOrigin" NOT NULL DEFAULT 'MANUAL', ADD COLUMN IF NOT EXISTS "estado" "CompanyStatus" NOT NULL DEFAULT 'HABILITADO', ADD COLUMN IF NOT EXISTS "enabledAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "enabledByUserId" TEXT, ADD COLUMN IF NOT EXISTS "fiscalData" JSONB, ADD COLUMN IF NOT EXISTS "repLegalData" JSONB, ADD COLUMN IF NOT EXISTS "rhData" JSONB, ADD COLUMN IF NOT EXISTS "cuentasPagarData" JSONB, ADD COLUMN IF NOT EXISTS "referenciasData" JSONB, ADD COLUMN IF NOT EXISTS "terminosAceptados" BOOLEAN, ADD COLUMN IF NOT EXISTS "documentosAdjuntos" JSONB`
    ok("Columnas en companies verificadas")

    await prisma.$executeRaw`UPDATE "companies" SET "origen" = 'MANUAL', "estado" = 'HABILITADO', "enabledAt" = COALESCE("enabledAt", NOW()) WHERE "origen" IS NULL OR "estado" IS NULL`
    await prisma.$executeRaw`UPDATE "companies" c SET "enabledByUserId" = (SELECT u.id FROM "users" u WHERE u.role = 'ADMIN' ORDER BY u."createdAt" ASC LIMIT 1) WHERE c."enabledByUserId" IS NULL`
    ok("Backfill de companies ejecutado")

    if (!(await checkConstraint("companies_sellerId_fkey", "companies"))) {
      await prisma.$executeRaw`ALTER TABLE "companies" ADD CONSTRAINT "companies_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`
      ok("FK companies_sellerId_fkey creada")
    } else skip("FK companies_sellerId_fkey ya existe")

    if (!(await checkConstraint("companies_enabledByUserId_fkey", "companies"))) {
      await prisma.$executeRaw`ALTER TABLE "companies" ADD CONSTRAINT "companies_enabledByUserId_fkey" FOREIGN KEY ("enabledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`
      ok("FK companies_enabledByUserId_fkey creada")
    } else skip("FK companies_enabledByUserId_fkey ya existe")

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "companies_sellerId_idx" ON "companies"("sellerId")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "companies_estado_idx" ON "companies"("estado")`
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "companies_origen_idx" ON "companies"("origen")`
    ok("Índices de companies verificados")
  } catch (e) {
    fail(`Error: ${e.message}`)
    throw e
  }
  log("")

  // 3. MIGRACIÓN 20260623170000 (parte B) + 20260624120000
  log("--- 3. MIGRACIÓN 20260623170000 (PARTE B) + 20260624120000 ---")
  try {
    if (!checks.sellerHistory) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "company_seller_history" ("id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "companyId" TEXT NOT NULL, "previousSellerId" TEXT, "newSellerId" TEXT, "changedByUserId" TEXT NOT NULL, "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reason" TEXT, CONSTRAINT "company_seller_history_pkey" PRIMARY KEY ("id"))`)
      ok("Tabla company_seller_history creada")
    } else skip("Tabla company_seller_history ya existe")

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "company_seller_history_companyId_changedAt_idx" ON "company_seller_history"("companyId", "changedAt")`

    const sellerFks = [
      { name: "company_seller_history_companyId_fkey", sql: `ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE` },
      { name: "company_seller_history_previousSellerId_fkey", sql: `ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_previousSellerId_fkey" FOREIGN KEY ("previousSellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE` },
      { name: "company_seller_history_newSellerId_fkey", sql: `ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_newSellerId_fkey" FOREIGN KEY ("newSellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE` },
      { name: "company_seller_history_changedByUserId_fkey", sql: `ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE` },
    ]
    for (const fk of sellerFks) {
      if (!(await checkConstraint(fk.name, "company_seller_history"))) {
        await prisma.$executeRawUnsafe(fk.sql)
        ok(`FK ${fk.name} creada`)
      } else skip(`FK ${fk.name} ya existe`)
    }

    if (!checks.selfReg) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "company_self_registrations" ("id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "tokenHash" TEXT NOT NULL, "companyDraft" JSONB, "uploadedFiles" JSONB NOT NULL DEFAULT '[]'::jsonb, "status" "CompanySelfRegStatus" NOT NULL DEFAULT 'ACTIVE', "expiresAt" TIMESTAMP(3) NOT NULL, "openedCount" INTEGER NOT NULL DEFAULT 0, "submittedAt" TIMESTAMP(3), "submittedCompanyId" TEXT, "createdByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "company_self_registrations_pkey" PRIMARY KEY ("id"))`)
      ok("Tabla company_self_registrations creada")
    } else skip("Tabla company_self_registrations ya existe")

    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "company_self_registrations_tokenHash_key" ON "company_self_registrations"("tokenHash")`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "company_self_registrations_submittedCompanyId_key" ON "company_self_registrations"("submittedCompanyId")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "company_self_registrations_status_idx" ON "company_self_registrations"("status")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "company_self_registrations_expiresAt_idx" ON "company_self_registrations"("expiresAt")`)

    const selfRegFks = [
      { name: "company_self_registrations_submittedCompanyId_fkey", sql: `ALTER TABLE "company_self_registrations" ADD CONSTRAINT "company_self_registrations_submittedCompanyId_fkey" FOREIGN KEY ("submittedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE` },
      { name: "company_self_registrations_createdByUserId_fkey", sql: `ALTER TABLE "company_self_registrations" ADD CONSTRAINT "company_self_registrations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE` },
    ]
    for (const fk of selfRegFks) {
      if (!(await checkConstraint(fk.name, "company_self_registrations"))) {
        await prisma.$executeRawUnsafe(fk.sql)
        ok(`FK ${fk.name} creada`)
      } else skip(`FK ${fk.name} ya existe`)
    }

    if (!checks.estadosMexico) {
      await prisma.$executeRawUnsafe(`CREATE TABLE "estados_mexico" ("id" INTEGER NOT NULL, "nombre" TEXT NOT NULL, "municipios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], CONSTRAINT "estados_mexico_pkey" PRIMARY KEY ("id"))`)
      ok("Tabla estados_mexico creada")
    } else skip("Tabla estados_mexico ya existe")

    await prisma.$executeRaw`ALTER TABLE "company_self_registrations" ADD COLUMN IF NOT EXISTS "channel" TEXT DEFAULT 'VENDOR_LINK'`
    ok("Columna channel verificada")
  } catch (e) {
    fail(`Error: ${e.message}`)
    throw e
  }
  log("")

  // 4. SINCRONIZAR _prisma_migrations
  log("--- 4. Sincronizando _prisma_migrations ---")
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" ("id" VARCHAR(36) NOT NULL, "checksum" VARCHAR(64) NOT NULL, "finished_at" TIMESTAMPTZ, "migration_name" VARCHAR(255) NOT NULL, "logs" TEXT, "rolled_back_at" TIMESTAMPTZ, "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "applied_steps_count" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id"))`)
    await prisma.$executeRaw`DELETE FROM "_prisma_migrations" WHERE "migration_name" IN ('20260527121500_add_intake_trace_to_medical_event', '20260623170000_company_v2_vendedor_historial_link_publico', '20260624120000_company_self_reg_channel')`
    await prisma.$executeRawUnsafe(`INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count") VALUES (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260527121500_add_intake_trace_to_medical_event', NOW(), 1), (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260623170000_company_v2_vendedor_historial_link_publico', NOW(), 1), (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260624120000_company_self_reg_channel', NOW(), 1) ON CONFLICT ("migration_name") DO UPDATE SET "finished_at" = NOW(), "rolled_back_at" = NULL, "applied_steps_count" = 1`)
    ok("_prisma_migrations sincronizado")
  } catch (e) {
    fail(`Error: ${e.message}`)
    throw e
  }
  log("")

  // 5. Verificación final
  log("--- 5. Verificación final ---")
  const finalChecks = {
    companiesSellerId: await checkColumn("companies", "sellerId"),
    intakeSource: await checkType("IntakeSource"),
    selfReg: await checkTable("company_self_registrations"),
    sellerHistory: await checkTable("company_seller_history"),
    estadosMexico: await checkTable("estados_mexico"),
    selfRegChannel: await checkColumn("company_self_registrations", "channel"),
  }
  Object.entries(finalChecks).forEach(([k, v]) => log(`  ${v ? "✓" : "✗"} ${k}`))

  const count = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE "migration_name" IN ('20260527121500_add_intake_trace_to_medical_event', '20260623170000_company_v2_vendedor_historial_link_publico', '20260624120000_company_self_reg_channel') AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`
  const appliedCount = Number(count[0]?.count ?? 0)
  log(`\n  Migraciones aplicadas: ${appliedCount} / 3`)

  if (appliedCount === 3 && Object.values(finalChecks).every(Boolean)) {
    log("\n✅ OK: La DB está sincronizada. Refresca /workers y /companies en el navegador.")
  } else {
    log("\n❌ INCOMPLETO: Revisa los mensajes de error arriba.")
  }
  log("\n=== FIN ===")
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("ERROR FATAL:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
