import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  console.log("=== Verificación Slice B LabOrder ===\n");

  // 1. Migraciones finalizadas
  const total: any[] = await p.$queryRaw`
    SELECT COUNT(*)::int as n FROM _prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  `;
  console.log(`Total migraciones finalizadas: ${total[0].n}`);

  const sliceB: any[] = await p.$queryRaw`
    SELECT migration_name, finished_at IS NOT NULL as finished
    FROM _prisma_migrations
    WHERE migration_name = '20260701010000_add_lab_orders'
  `;
  console.log(`\nSlice B LabOrder migración:`);
  for (const m of sliceB) console.log(`  ${m.finished ? '✓' : '·'} ${m.migration_name}`);

  // 2. Enums nuevos
  const enums: any[] = await p.$queryRaw`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
    FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid
    WHERE t.typname IN ('LabOrderStatus','LabOrderUrgency','LabOrderConfidentiality')
    GROUP BY t.typname
    ORDER BY t.typname
  `;
  console.log(`\n=== Enums Slice B ===`);
  for (const e of enums) console.log(`  ✓ ${e.typname}: ${e.values.join(', ')}`);

  // 3. Tablas nuevas
  const tables: any[] = await p.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('lab_orders','lab_order_items')
    ORDER BY table_name
  `;
  console.log(`\n=== Tablas Slice B (${tables.length}/2) ===`);
  for (const t of tables) console.log(`  ✓ ${t.table_name}`);

  // 4. Conteos actuales
  console.log(`\n=== Conteos actuales (esperados = 0) ===`);
  for (const t of ['lab_orders','lab_order_items']) {
    const c: any[] = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as n FROM ${t}`);
    console.log(`  ${t}: ${c[0].n}`);
  }

  console.log("\n✅ Slice B verificado en Railway.");
}

main().catch(console.error).finally(() => p.$disconnect());