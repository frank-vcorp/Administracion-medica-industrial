/**
 * @file /branches — Lista de sucursales (Server Component).
 * @id IMPL-20260730-04 (PR-2 de ARCH-20260730-01)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §7.1
 *
 * Refactor de la versión legacy que:
 *   - Usaba `admin.actions.ts:97-125` (FormData-based + sin Zod server-side).
 *   - Tenía un modal con peer-checkbox hack (inamovible + sin focus trap).
 *   - Mostraba siempre "Activa" hardcodeada sin distinguir soft-disabled.
 *
 * Esta versión:
 *   - Server Component que pre-renderiza la lista con `getBranches({includeInactive})`.
 *   - Next.js 16: `searchParams` es Promise → `const params = await searchParams`
 *     (OBLIGATORIO; no es warning, es cambio de API).
 *   - Pasa cada sucursal con `_count` al componente cliente `BranchCard`
 *     (los tipos Prisma + `_count` son serializables sin coste).
 *   - Dispara `BranchCreateModal` (Client) controlado con `useState` + Zod
 *     client-side pre-flight.
 *   - Filtra por `?includeInactive=true` (searchParam, link derecho arriba).
 */
import Link from 'next/link'
import { getBranches } from '@/actions/branch.actions'
import { BranchCard } from './_components/BranchCard'
import { BranchCreateModal } from './_components/BranchCreateModal'

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ includeInactive?: string }>
}) {
  const params = await searchParams
  const includeInactive = params.includeInactive === 'true'
  const branches = await getBranches({ includeInactive })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Sucursales AMI</h2>
          <p className="text-sm text-slate-500">
            Gestión de sedes y puntos de atención
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={
              includeInactive
                ? '/branches'
                : '/branches?includeInactive=true'
            }
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            {includeInactive ? 'Ocultar inactivas' : 'Mostrar inactivas'}
          </Link>
          <BranchCreateModal />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-600 bg-amber-50 rounded-xl border border-amber-300">
            <p className="font-medium mb-2">No hay sucursales registradas.</p>
            <p className="text-xs">
              Si esperas ver sucursales, verifica que:
              <br />
              (a) tu sesión tenga permisos ADMIN o SUPERADMIN,
              <br />
              (b) las sucursales estén activas (toggle "Mostrar inactivas" arriba).
            </p>
          </div>
        )}
        {branches.map((b) => (
          <BranchCard key={b.id} branch={b} />
        ))}
      </div>
    </div>
  )
}
