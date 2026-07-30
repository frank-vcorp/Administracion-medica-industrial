/**
 * @file /branches/[id] — Detalle + tabs de configuración (Server Component).
 * @id IMPL-20260730-05 (PR-3 de ARCH-20260730-01)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §7.2
 *
 * Server Component que pre-renderiza la sucursal + el pool de empresas
 * disponibles para asignación. Pasa ambos al Client Component
 * `BranchDetailTabs` que gestiona el state de tab activo.
 *
 * Next.js 16 OBLIGATORIO: `params` es Promise → `const {id} = await params`.
 * Esto NO es un warning; es cambio de API en Next 16.1.6.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getBranchById,
  getAvailableCompaniesForBranch,
} from '@/actions/branch.actions'
import { BranchDetailTabs } from '../_components/BranchDetailTabs'
import { BranchStatusBadge } from '../_components/BranchStatusBadge'

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // OBLIGATORIO Next.js 16 — await params.
  const { id } = await params

  // Carga paralela: detalle de la sucursal + pool de empresas disponibles.
  // Si el usuario no es ADMIN_LIKE, getAvailableCompaniesForBranch devuelve
  // {ok:false} pero igualmente renderizamos la página (con array vacío).
  const [branchResult, companiesResult] = await Promise.all([
    getBranchById(id),
    getAvailableCompaniesForBranch(),
  ])

  if (!branchResult.ok) {
    // getBranchById puede fallar por: no autenticado, ID inválido, no existe.
    // En todos los casos, mostramos 404 (consistente con SPEC §7.2 "no fail
    // silencioso").
    notFound()
  }

  const branch = branchResult.branch
  const availableCompanies = companiesResult.ok ? companiesResult.companies : []

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/branches"
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          ← Sucursales
        </Link>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">{branch.name}</h2>
            <BranchStatusBadge isActive={branch.isActive} />
          </div>
          <p className="text-sm text-slate-500">
            {branch.address ?? '—'}
            {branch.phone ? ` · ${branch.phone}` : ''}
          </p>
        </div>
        <div className="text-xs text-slate-400 text-right">
          <div>Tenant: {branch.tenant.name}</div>
          <div>ID: {branch.id.slice(0, 8)}…</div>
        </div>
      </div>

      <BranchDetailTabs branch={branch} availableCompanies={availableCompanies} />
    </div>
  )
}