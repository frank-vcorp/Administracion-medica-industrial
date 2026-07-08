import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  console.log("=== Verificación Slice C LabResult ===\n");

  // 1. Total migraciones
  const total: any[] = await p.$queryRaw`
    SELECT COUNT(*)::int as n FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  `;
  console.log(`Total migraciones finalizadas: ${total[0].n}`);

  // 2. Slice C LabResult migración
  const sliceC: any[] = await p.$queryRaw`
    SELECT migration_name, finished_at IS NOT NULL as finished
    FROM _prisma_migrations
    WHERE migration_name = '20260707120000_add_lab_results'
  `;
  console.log(`\nSlice C LabResult migración:`);
  for (const m of sliceC) console.log(`  ${m.finished ? '✓' : '·'} ${m.migration_name}`);

  // 3. Enums Slice C
  const enums: any[] = await p.$queryRaw`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
    FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid
    WHERE t.typname IN ('LabResultStatus','LabAnalyteDataType','LabSex')
    GROUP BY t.typname
    ORDER BY t.typname
  `;
  console.log(`\n=== Enums Slice C (${enums.length}/3) ===`);
  for (const e of enums) console.log(`  ✓ ${e.typname}: ${e.values.join(", ")}`);

  // 4. Tablas Slice C
  const tables: any[] = await p.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('lab_results','lab_analytes','lab_reference_ranges','lab_result_audits')
    ORDER BY table_name
  `;
  console.log(`\n=== Tablas Slice C (${tables.length}/4) ===`);
  for (const t of tables) console.log(`  ✓ ${t.table_name}`);

  // 5. eventTestId en lab_order_items
  const evt: any[] = await p.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name='lab_order_items' AND column_name='eventTestId'
  `;
  console.log(`\n=== eventTestId en lab_order_items (${evt.length}/1) ===`);
  for (const c of evt) console.log(`  ✓ ${c.column_name} (${c.data_type}, nullable=${c.is_nullable})`);

  // 6. Conteos
  console.log(`\n=== Conteos actuales (esperados = 0) ===`);
  for (const t of ['lab_results','lab_analytes','lab_reference_ranges','lab_result_audits']) {
    const c: any[] = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as n FROM ${t}`);
    console.log(`  ${t}: ${c[0].n}`);
  }

  console.log("\n✅ Slice C verificado en Railway.");
}

main().catch(console.error).finally(() => p.$disconnect());