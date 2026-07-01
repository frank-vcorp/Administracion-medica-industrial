/**
 * Sync manual de _prisma_migrations para IMPL-20260630-06 (Slice A NOVA catálogos LIS).
 *
 * Patrón validado: PROYECTO.md 2026-06-24 (ARCH-20260624-03) y 2026-06-30 (IMPL-20260630-03).
 *
 * Uso:
 *   railway run --service 'Administracion-medica-industrial' \
 *     npx tsx scripts/sync-prisma-migrations-lab-catalogs.ts
 *
 * Idempotente: si la migración ya está aplicada, no hace nada.
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const MIGRATION_NAME = "20260701000000_add_lab_catalogs"

async function run() {
  console.log("=== Sync manual: IMPL-20260630-06 Slice A NOVA catálogos ===\n")

  // 1. Verificar si ya está registrada
  const existing: any[] = await prisma.$queryRaw`
    SELECT id, finished_at IS NOT NULL as finished, rolled_back_at IS NOT NULL as rolled_back
    FROM _prisma_migrations
    WHERE migration_name = ${MIGRATION_NAME}
    LIMIT 1
  `

  if (existing.length > 0) {
    const r = existing[0]
    if (r.finished && !r.rolled_back) {
      console.log(`  ⊙ ${MIGRATION_NAME}: ya existe y está aplicada`)
      console.log("\n✅ Nada que hacer.")
      return
    } else if (r.rolled_back) {
      console.log(`  ⟳ ${MIGRATION_NAME}: existe como rolled_back, actualizando a aplicada...`)
      await prisma.$executeRaw`
        UPDATE _prisma_migrations
        SET finished_at = NOW(), rolled_back_at = NULL, applied_steps_count = 1
        WHERE id = ${r.id}
      `
      console.log(`  ✓ ${MIGRATION_NAME}: marcada como aplicada`)
      return
    }
  }

  // 2. Registrar la migración como aplicada
  console.log(`  + Registrando ${MIGRATION_NAME} en _prisma_migrations...`)
  await prisma.$executeRaw`
    INSERT INTO _prisma_migrations (id, migration_name, finished_at, applied_steps_count)
    VALUES (gen_random_uuid()::text, ${MIGRATION_NAME}, NOW(), 1)
    ON CONFLICT (migration_name) DO UPDATE SET
      finished_at = NOW(),
      applied_steps_count = 1
  `
  console.log(`  ✓ ${MIGRATION_NAME}: registrada`)
  console.log("\n✅ Sync completo. Verifica con check-migrations-state.ts.")
}

run()
  .catch((e) => {
    console.error("❌ Error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())