/**
 * Script rápido para diagnosticar el estado de _prisma_migrations
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function run() {
  console.log("=== Diagnóstico de _prisma_migrations ===\n")

  // 1. Verificar constraint UNIQUE en migration_name
  const constraints: any[] = await prisma.$queryRaw`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = '_prisma_migrations'
    ORDER BY constraint_type, constraint_name
  `
  console.log("Constraints en _prisma_migrations:")
  if (constraints.length === 0) {
    console.log("  (tabla no existe)")
  } else {
    constraints.forEach((c: any) => console.log(`  ${c.constraint_type}: ${c.constraint_name}`))
  }
  console.log()

  // 2. Verificar registros existentes
  const records: any[] = await prisma.$queryRaw`
    SELECT migration_name,
           finished_at IS NOT NULL as finished,
           rolled_back_at IS NOT NULL as rolled_back
    FROM _prisma_migrations
    ORDER BY started_at
  `
  console.log(`Registros: ${records.length}`)
  records.forEach((r: any) => console.log(`  ${r.migration_name} | finished=${r.finished} | rolled_back=${r.rolled_back}`))
  console.log()

  // 3. Verificar la nueva migración targetCompanyId
  const colCheck: any[] = await prisma.$queryRaw`
    SELECT EXISTS (SELECT FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'company_self_registrations'
                    AND column_name = 'targetCompanyId') as exists
  `
  console.log(`Columna company_self_registrations.targetCompanyId: ${colCheck[0]?.exists ? "✓ EXISTE" : "✗ NO EXISTE"}`)

  const idxCheck: any[] = await prisma.$queryRaw`
    SELECT EXISTS (SELECT FROM pg_indexes
                    WHERE schemaname = 'public' AND tablename = 'company_self_registrations'
                    AND indexname = 'company_self_registrations_targetCompanyId_idx') as exists
  `
  console.log(`Índice company_self_registrations_targetCompanyId_idx: ${idxCheck[0]?.exists ? "✓ EXISTE" : "✗ NO EXISTE"}`)

  const fkCheck: any[] = await prisma.$queryRaw`
    SELECT EXISTS (SELECT FROM information_schema.table_constraints
                    WHERE constraint_name = 'company_self_registrations_targetCompanyId_fkey'
                      AND table_name = 'company_self_registrations') as exists
  `
  console.log(`FK company_self_registrations_targetCompanyId_fkey: ${fkCheck[0]?.exists ? "✓ EXISTE" : "✗ NO EXISTE"}`)

  await prisma.$disconnect()
}

run().catch(async (e) => { console.error("ERROR:", e); await prisma.$disconnect(); process.exit(1) })
