/**
 * @file BranchStatusBadge — Píldora Activa/Inactiva (PR-2 de ARCH-20260730-01).
 * @id IMPL-20260730-04
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §7.1
 *
 * Componente presentacional sin estado. Se usa en `BranchCard` y en cualquier
 * otra UI que muestre el estado soft-disable de una sucursal (lista,
 * `/branches/[id]`, etc.).
 *
 * NO recibe objetos Prisma: solo el booleano `isActive`. Esto permite
 * reusarlo desde cualquier Client/Server Component sin acoplar al modelo Prisma.
 */
export function BranchStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
        isActive
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-200 text-slate-600'
      }`}
    >
      {isActive ? 'Activa' : 'Inactiva'}
    </span>
  )
}
