// Script que SOLO sincroniza _prisma_migrations (las migraciones reales ya se aplicaron)
// Ejecutar con: DATABASE_URL="..." node ./scripts/sync-prisma-migrations-railway.mjs

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const MIGRATIONS = [
  '20260527121500_add_intake_trace_to_medical_event',
  '20260623170000_company_v2_vendedor_historial_link_publico',
  '20260624120000_company_self_reg_channel',
]

async function main() {
  console.log("=== Sincronizando _prisma_migrations ===\n")

  // 1. Crear tabla si no existe
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
  console.log("✓ Tabla _prisma_migrations verificada")

  // 2. DELETE registros existentes para evitar duplicados
  await prisma.$executeRawUnsafe(`
    DELETE FROM "_prisma_migrations"
    WHERE "migration_name" IN ('20260527121500_add_intake_trace_to_medical_event', '20260623170000_company_v2_vendedor_historial_link_publico', '20260624120000_company_self_reg_channel')
  `)
  console.log("✓ Registros existentes eliminados")

  // 3. INSERT uno por uno (sin ON CONFLICT para evitar problemas)
  for (const migrationName of MIGRATIONS) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
      VALUES (gen_random_uuid()::text, 'manual-railway-fix', NOW(), $1, NOW(), 1)
    `, migrationName)
    console.log(`✓ Insertada: ${migrationName}`)
  }

  // 4. Verificar
  const count = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count FROM "_prisma_migrations"
    WHERE "migration_name" IN ('20260527121500_add_intake_trace_to_medical_event', '20260623170000_company_v2_vendedor_historial_link_publico', '20260624120000_company_self_reg_channel')
    AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
  `
  const appliedCount = Number(count[0]?.count ?? 0)
  console.log(`\nMigraciones aplicadas: ${appliedCount} / 3`)

  if (appliedCount === 3) {
    console.log("\n✅ OK: _prisma_migrations sincronizado. Refresca /workers y /companies en el navegador.")
  } else {
    console.log("\n❌ INCOMPLETO")
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("ERROR:", e.message)
    await prisma.$disconnect()
    process.exit(1)
  })
