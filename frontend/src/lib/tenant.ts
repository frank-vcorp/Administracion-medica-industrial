/**
 * @file Helper centralizado para resolver tenant actual.
 * @id IMPL-20260730-02 (ARCH-20260730-01) — PR-1
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §5.1
 *
 * Hoy el sistema es monotenant en la práctica (un único `Tenant` por
 * despliegue, ver SPEC §4 / Riesgo R1). Este helper centraliza la resolución
 * para que cuando se migre a multi-tenant real, solo se cambie aquí y todos
 * los call-sites se beneficien.
 *
 * `getDefaultTenant()`:
 *   1. Lee el primer tenant por createdAt ascendente.
 *   2. Si no existe ninguno, crea "Default Tenant" y lo devuelve.
 *   3. Si existieran múltiples tenants, devuelve el más antiguo (orden estable).
 *
 * Refactor de los `prisma.tenant.findFirst()` repetidos en `admin.actions.ts`
 * y `branch.actions.ts`. La acción deprecated `createBranch` en admin.actions.ts
 * se migrará a este helper en PR-2.
 */
import prisma from '@/lib/prisma'

/**
 * Resuelve el tenant actual. Si no existe ninguno, crea uno por defecto y
 * lo devuelve. Idempotente y barato (cached a nivel Prisma si se persiste).
 */
export async function getDefaultTenant() {
  const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' },
  })
  if (!tenant) {
    return await prisma.tenant.create({
      data: { name: 'Default Tenant' },
    })
  }
  return tenant
}
