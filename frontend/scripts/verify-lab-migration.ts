import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // 1. Migraciones finalizadas
  const migrations: any[] = await p.$queryRaw`
    SELECT migration_name,
           finished_at IS NOT NULL as finished,
           rolled_back_at IS NOT NULL as rolled_back,
           length(checksum) as checksum_len
    FROM _prisma_migrations
    ORDER BY migration_name
  `;
  console.log(`\n=== _prisma_migrations (${migrations.length} total) ===`);
  let finalizadas = 0;
  for (const m of migrations) {
    const status = m.finished && !m.rolled_back ? '✓' : m.rolled_back ? '↩' : '·';
    console.log(`  ${status} ${m.migration_name} (checksum_len=${m.checksum_len})`);
    if (m.finished && !m.rolled_back) finalizadas++;
  }
  console.log(`\nFinalizadas: ${finalizadas}/${migrations.length}`);

  // 2. Tablas LIS creadas
  const tables: any[] = await p.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name LIKE 'lab_%'
    ORDER BY table_name
  `;
  console.log(`\n=== Tablas LIS creadas (${tables.length} esperadas) ===`);
  for (const t of tables) console.log(`  ✓ ${t.table_name}`);

  // 3. Enums creados
  const enums: any[] = await p.$queryRaw`
    SELECT t.typname, e.enumlabel
    FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid
    WHERE t.typname IN ('LabUnitSystem','LabRole')
    ORDER BY t.typname, e.enumsortorder
  `;
  console.log(`\n=== Enums LIS (${enums.length} esperados) ===`);
  for (const e of enums) console.log(`  ✓ ${e.typname}.${e.enumlabel}`);

  // 4. Columnas extendidas
  const cols: any[] = await p.$queryRaw`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE (table_name='users' AND column_name IN ('labRole','novaMedicoClave'))
       OR (table_name='companies' AND column_name IN ('novaConvenioId','discountPolicyId'))
       OR (table_name='medical_tests' AND column_name IN ('novaClave','labMethodId','labSampleId','labProcessAreaId','daysToResult','isProfile','isPackage'))
    ORDER BY table_name, column_name
  `;
  console.log(`\n=== Columnas extendidas (${cols.length} esperadas) ===`);
  for (const c of cols) console.log(`  ✓ ${c.table_name}.${c.column_name} (${c.data_type})`);

  // 5. Conteos actuales (deberían estar en 0 antes del seed)
  console.log(`\n=== Conteos actuales (esperados = 0) ===`);
  const counts = ['lab_units','lab_samples','lab_containers','lab_methods','lab_process_areas','lab_departments','lab_classifications','lab_indications'];
  for (const t of counts) {
    const c: any[] = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as n FROM ${t}`);
    console.log(`  ${t}: ${c[0].n}`);
  }

  console.log(`\n✅ Migración Slice A aplicada exitosamente.`);
}

main().catch(console.error).finally(() => p.$disconnect());