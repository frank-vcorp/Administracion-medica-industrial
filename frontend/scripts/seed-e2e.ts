/**
 * @file Seed mínimo E2E para Playwright (compatible con schema Prisma real).
 * @id IMPL-20260804-05 — O1 (CIERRE) — rev. 2 (fix GEMINI F3)
 * @backup context/SPECs/SPEC_ARCH-20260804-04-BLOQUEO-ASIMETRICO-CONFLICTOS.md
 *
 * Garantiza un estado base estable y conocido para los tests e2e:
 *  - 1 Tenant (id fijo "e2e-tenant") — Branch.tenantId es FK a Tenant.
 *  - 1 Branch apuntando al tenant.
 *  - 1 Company (busca por name; rfc NO es unique en el schema).
 *  - 1 usuario ADMIN con credenciales conocidas (idempotente: NO rota password).
 *  - 6 unidades móviles (Unidad Móvil 1..6).
 *
 * Uso:
 *  - Como `globalSetup` de Playwright (configurado en playwright.config.ts).
 *  - Manual: `pnpm tsx scripts/seed-e2e.ts`
 *
 * Restricciones:
 *  - Solo upsert / create idempotente.
 *  - NO usa `as never` (los typechecks fallidos indicaban incompatibilidad real).
 *  - NO usa fallbacks silenciosos: cualquier error aborta.
 */
import { PrismaClient, UserRole, MobileUnitStatus } from "@prisma/client"
import bcryptjs from "bcryptjs"

const prisma = new PrismaClient()

const ADMIN_EMAIL = "e2e-admin@ami.test"
const ADMIN_PASSWORD = "E2eAdmin!2026"
const ADMIN_NAME = "E2E Admin (Playwright)"

const TENANT_ID = "e2e-tenant"
const TENANT_NAME = "E2E Tenant"

const BRANCH_NAME = "E2E Sucursal Matriz"

const COMPANY_NAME = "E2E Empresa AMI"
const COMPANY_RFC = "E2E000000AAA"

interface SeedUnit {
  name: string
  plate: string
  capacity: number
}

const SEED_UNITS: SeedUnit[] = [
  { name: "Unidad Móvil 1", plate: "ABC-123", capacity: 50 },
  { name: "Unidad Móvil 2", plate: "DEF-456", capacity: 50 },
  { name: "Unidad Móvil 3", plate: "GHI-789", capacity: 40 },
  { name: "Unidad Móvil 4", plate: "JKL-012", capacity: 40 },
  { name: "Unidad Móvil 5", plate: "MNO-345", capacity: 30 },
  { name: "Unidad Móvil 6", plate: "PQR-678", capacity: 30 },
]

async function seedTenant(): Promise<void> {
  // Tenant usa id fijo y estable; upsert por id.
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: { name: TENANT_NAME },
    create: { id: TENANT_ID, name: TENANT_NAME },
  })
  console.log(`[seed-e2e] Tenant upserted: ${TENANT_ID}`)
}

async function seedAdminUser(): Promise<void> {
  // Crea con password hasheado si no existe; actualiza metadatos si ya existe.
  // No rotamos password para no invalidar storageState cacheado.
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!existing) {
    const hashedPassword = await bcryptjs.hash(ADMIN_PASSWORD, 10)
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        hashedPassword,
        fullName: ADMIN_NAME,
        role: UserRole.ADMIN,
        isActive: true,
      },
    })
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: { fullName: ADMIN_NAME, role: UserRole.ADMIN, isActive: true },
    })
  }
  console.log(`[seed-e2e] ADMIN user upserted: ${ADMIN_EMAIL}`)
}

async function seedBranch(): Promise<string> {
  // Buscar por (tenantId + name); si no existe, crear.
  const existing = await prisma.branch.findFirst({
    where: { tenantId: TENANT_ID, name: BRANCH_NAME },
    select: { id: true },
  })
  if (existing) {
    console.log(`[seed-e2e] Branch reused: ${existing.id}`)
    return existing.id
  }
  const created = await prisma.branch.create({
    data: { name: BRANCH_NAME, tenantId: TENANT_ID },
    select: { id: true },
  })
  console.log(`[seed-e2e] Branch created: ${created.id}`)
  return created.id
}

async function seedCompany(branchId: string): Promise<string> {
  // Company.rfc NO es unique en schema; buscamos por name para idempotencia.
  const existing = await prisma.company.findFirst({
    where: { name: COMPANY_NAME },
    select: { id: true },
  })
  if (existing) {
    // Asegurar defaultBranchId para que el formulario de proyectos la muestre
    // sin pedir re-selección.
    await prisma.company.update({
      where: { id: existing.id },
      data: { defaultBranchId: branchId },
    })
    console.log(`[seed-e2e] Company reused: ${existing.id}`)
    return existing.id
  }
  const created = await prisma.company.create({
    data: {
      name: COMPANY_NAME,
      rfc: COMPANY_RFC,
      defaultBranchId: branchId,
    },
    select: { id: true },
  })
  console.log(`[seed-e2e] Company created: ${created.id}`)
  return created.id
}

async function seedMobileUnits(): Promise<void> {
  let created = 0
  let updated = 0
  let skipped = 0
  for (const unit of SEED_UNITS) {
    const existing = await prisma.mobileUnit.findUnique({
      where: { name: unit.name },
    })
    if (!existing) {
      await prisma.mobileUnit.create({
        data: {
          name: unit.name,
          plate: unit.plate,
          capacity: unit.capacity,
          status: MobileUnitStatus.ACTIVA,
        },
      })
      created++
    } else {
      const needsUpdate =
        existing.plate !== unit.plate || existing.capacity !== unit.capacity
      if (needsUpdate) {
        await prisma.mobileUnit.update({
          where: { id: existing.id },
          data: { plate: unit.plate, capacity: unit.capacity },
        })
        updated++
      } else {
        skipped++
      }
    }
  }
  console.log(
    `[seed-e2e] Mobile units: ${created} creadas, ${updated} actualizadas, ${skipped} sin cambios`
  )
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL no está definida. El globalSetup de Playwright debe cargar .env antes de invocar este script."
    )
  }
  await seedTenant()
  await seedAdminUser()
  const branchId = await seedBranch()
  await seedCompany(branchId)
  await seedMobileUnits()
  console.log("[seed-e2e] ✅ Seed E2E completo")
}

main()
  .catch((err: unknown) => {
    console.error("[seed-e2e] ❌ Error:", err)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })

export { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME }