/**
 * Sync manual de _prisma_migrations para IMPL-20260630-06 (Slice A NOVA catálogos LIS).
 *
 * Marca todas las migraciones Prisma que ya están aplicadas en DB como finalizadas
 * en _prisma_migrations, para que `prisma migrate deploy` pueda continuar sin tropezar.
 *
 * Patrón: PROYECTO.md 2026-06-24 (ARCH-20260624-03), 2026-06-30 (IMPL-20260630-03).
 *
 * Uso:
 *   railway run --service 'Administracion-medica-industrial' \
 *     npx tsx scripts/sync-prisma-migrations-lab-catalogs.ts
 *
 * O en local con DATABASE_URL apuntando a Railway:
 *   DATABASE_URL=... npx tsx scripts/sync-prisma-migrations-lab-catalogs.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/** Migraciones Prisma que sabemos aplicadas en DB pero no registradas (o registradas como pendientes). */
const MIGRATIONS_TO_SYNC = [
  "20260527121500_add_intake_trace_to_medical_event",     // registrada como pendiente, en realidad aplicada
  "20260527133500_project_worker_reception_queue",         // aplicada en DB, no registrada
  "20260623170000_company_v2_vendedor_historial_link_publico", // aplicada en DB, no registrada
  "20260624120000_company_self_reg_channel",               // aplicada en DB, no registrada
  "20260624214342_add_target_company_id_to_self_reg",      // aplicada en DB, no registrada
  "20260630140000_add_payment_record",                     // aplicada en DB, no registrada
  "20260630150000_add_whatsapp_receipt_fields",            // aplicada en DB, no registrada
];

async function run() {
  console.log("=== Sync manual: IMPL-20260630-06 Slice A NOVA catálogos ===\n");

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const name of MIGRATIONS_TO_SYNC) {
    try {
      const existing: any[] = await prisma.$queryRaw`
        SELECT id, finished_at IS NOT NULL as finished, rolled_back_at IS NOT NULL as rolled_back
        FROM _prisma_migrations
        WHERE migration_name = ${name}
        LIMIT 1
      `;

      if (existing.length === 0) {
        // No existe → insertar como finalizada
        console.log(`  + ${name}: insertando como finalizada...`);
        await prisma.$executeRaw`
          INSERT INTO _prisma_migrations (id, migration_name, finished_at, applied_steps_count)
          VALUES (gen_random_uuid()::text, ${name}, NOW(), 1)
          ON CONFLICT (migration_name) DO NOTHING
        `;
        synced++;
        console.log(`  ✓ ${name}: registrada`);
      } else {
        const r = existing[0];
        if (r.finished && !r.rolled_back) {
          console.log(`  ⊙ ${name}: ya finalizada (skip)`);
          skipped++;
        } else if (r.rolled_back) {
          console.log(`  ⟳ ${name}: rolled_back, reabriendo y finalizando...`);
          await prisma.$executeRaw`
            UPDATE _prisma_migrations
            SET finished_at = NOW(), rolled_back_at = NULL, applied_steps_count = 1
            WHERE id = ${r.id}
          `;
          synced++;
          console.log(`  ✓ ${name}: re-aplicada`);
        } else {
          // Sin finished_at → actualizar a finalizada
          console.log(`  ⟳ ${name}: pendiente, finalizando...`);
          await prisma.$executeRaw`
            UPDATE _prisma_migrations
            SET finished_at = NOW(), applied_steps_count = 1
            WHERE id = ${r.id}
          `;
          synced++;
          console.log(`  ✓ ${name}: finalizada`);
        }
      }
    } catch (e: any) {
      errors++;
      console.error(`  ❌ ${name}: ${e.message}`);
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`  Sincronizadas: ${synced}`);
  console.log(`  Saltadas:     ${skipped}`);
  console.log(`  Errores:      ${errors}`);
  console.log(`\n✅ Listo para ejecutar 'prisma migrate deploy'.`);
}

run()
  .catch((e) => {
    console.error("❌ Error fatal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());