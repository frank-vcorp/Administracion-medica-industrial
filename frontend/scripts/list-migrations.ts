import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const rows: any[] = await prisma.$queryRaw`
    SELECT migration_name,
           finished_at IS NOT NULL as finished,
           rolled_back_at IS NOT NULL as rolled_back
    FROM _prisma_migrations
    ORDER BY started_at NULLS LAST, migration_name
  `;
  console.log(`Total: ${rows.length}`);
  for (const r of rows) {
    console.log(`  ${r.finished ? '✓' : r.rolled_back ? '↩' : '·'} ${r.migration_name}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());