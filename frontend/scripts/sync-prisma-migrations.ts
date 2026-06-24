/**
 * Sync manual de _prisma_migrations (las 4 migraciones del fix).
 * - Sin UNIQUE constraint en migration_name, así que verificamos antes de INSERT.
 * - Inserta las 4 migraciones como finalizadas.
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

const MIGRATIONS = [
  "20260527121500_add_intake_trace_to_medical_event",
  "20260623170000_company_v2_vendedor_historial_link_publico",
  "20260624120000_company_self_reg_channel",
  "20260624214342_add_target_company_id_to_self_reg",
] as const

async function run() {
  console.log("=== Sync manual de _prisma_migrations ===\n")

  for (const name of MIGRATIONS) {
    const existing: any[] = await prisma.$queryRaw`
      SELECT id, finished_at IS NOT NULL as finished, rolled_back_at IS NOT NULL as rolled_back
      FROM _prisma_migrations
      WHERE migration_name = ${name}
      LIMIT 1
    `

    if (existing.length > 0) {
      const r = existing[0]
      if (r.finished && !r.rolled_back) {
        console.log(`  ⊙ ${name}: ya existe y está aplicada`)
        continue
      } else if (r.rolled_back) {
        console.log(`  ⟳ ${name}: existe como rolled_back, actualizando a aplicada...`)
        await prisma.$executeRaw`
          UPDATE _prisma_migrations
          SET finished_at = NOW(), rolled_back_at = NULL, applied_steps_count = 1
          WHERE id = ${r.id}
        `
        console.log(`  ✓ ${name}: marcada como aplicada`)
        continue
      } else {
        console.log(`  ⟳ ${name}: existe sin finished, actualizando...`)
        await prisma.$executeRaw`
          UPDATE _prisma_migrations
          SET finished_at = NOW(), applied_steps_count = 1
          WHERE id = ${r.id}
        `
        console.log(`  ✓ ${name}: marcada como aplicada`)
        continue
      }
    }

    console.log(`  + Insertando ${name}...`)
    await prisma.$executeRaw`
      INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
      VALUES (gen_random_uuid()::text, 'manual-railway-fix', NOW(), ${name}, NOW(), 1)
    `
    console.log(`  ✓ ${name}: insertada como aplicada`)
  }

  console.log("\n=== Verificación final ===")
  for (const name of MIGRATIONS) {
    const r: any[] = await prisma.$queryRaw`
      SELECT finished_at IS NOT NULL as finished, rolled_back_at IS NOT NULL as rolled_back
      FROM _prisma_migrations
      WHERE migration_name = ${name}
      LIMIT 1
    `
    if (r[0]?.finished && !r[0]?.rolled_back) {
      console.log(`  ✓ ${name}: aplicada`)
    } else {
      console.log(`  ✗ ${name}: NO aplicada`)
    }
  }

  await prisma.$disconnect()
  console.log("\n=== FIN ===")
}

run().catch(async (e) => { console.error("ERROR FATAL:", e); await prisma.$disconnect(); process.exit(1) })
