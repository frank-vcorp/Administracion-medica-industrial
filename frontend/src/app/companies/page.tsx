/**
 * @file Listado de Empresas con filtros (estado, origen, vendedor, búsqueda).
 * @id IMPL-20260623-03
 * @fix  FIX-FRANK-20260731-05 — Vista cambiada a tabla densa (era grid de cards).
 * @spec context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 *
 * Server component. Lee `searchParams` (Promise en Next.js 16+), los parsea
 * a los enums de Prisma (`CompanyStatus`, `CompanyOrigin`) y delega en
 * `listCompaniesWithFilters` (server action que valida sesión).
 * El formulario se envía por GET a `/companies`, recargando la página
 * con los nuevos query params.
 *
 * FIX-FRANK-20260731-05: Vista anterior era grid 3 columnas. Con 1 sola
 * empresa o pocas empresas el grid se veía torpe (1 card minúscula en
 * esquina con mucho espacio vacío). Reemplazado por tabla densa.
 * - Para SUPERADMIN: `CompanyBulkDeleteShell` (tabla + barra inferior).
 * - Para otros roles: tabla plana (sin checkboxes) usando el mismo shape
 *   que `CompanySelectableGrid` legacy, ahora desde `CompanySelectableTable`.
 */
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CompanyStatus, CompanyOrigin } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import {
  getCompanies,
  listCompaniesWithFilters,
  listActiveSellersAction,
} from '@/actions/company.actions'
import CompanyFormModal from '@/components/CompanyFormModal'
import CompanyBulkDeleteShell from '@/components/companies/CompanyBulkDeleteShell'
import CompanySelectableTable, {
  type SelectableCompany,
} from '@/components/companies/CompanySelectableTable'

const ESTADO_OPTIONS: CompanyStatus[] = [
  'PENDIENTE_REVISION',
  'HABILITADO',
  'DESHABILITADO',
]
const ORIGEN_OPTIONS: CompanyOrigin[] = ['MANUAL', 'AUTO_ALTA']

interface PageProps {
  searchParams: Promise<{
    estado?: string
    origen?: string
    sellerId?: string
    q?: string
  }>
}

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[]
): T | undefined {
  if (!value) return undefined
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  const sp = await searchParams

  const estado = parseEnum(sp.estado, ESTADO_OPTIONS)
  const origen = parseEnum(sp.origen, ORIGEN_OPTIONS)
  const sellerId = sp.sellerId && sp.sellerId.length > 0 ? sp.sellerId : undefined
  const q = sp.q && sp.q.trim().length > 0 ? sp.q.trim() : undefined

  const filtersActive = Boolean(estado || origen || sellerId || q)

  // IMPL-20260730-01 (ARCH-20260730-01): identificar rol para mostrar controles
  // de eliminación masiva. Solo SUPERADMIN ve los checkboxes y la barra inferior.
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string } | undefined)?.role
  const canDelete = role === 'SUPERADMIN'

  const [companies, sellers] = await Promise.all([
    filtersActive
      ? listCompaniesWithFilters({ estado, origen, sellerId, search: q })
      : getCompanies(),
    listActiveSellersAction().catch(() => []),
  ])

  // Saneamos la lista al shape que esperan los componentes cliente.
  // FIX-20260808-02 (DIAG-20260808-02): también propagamos `allowedBranches`
  // para soportar el fallback de la columna Sucursal cuando defaultBranch es null.
  const selectableCompanies: SelectableCompany[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    rfc: c.rfc ?? null,
    contactName: c.contactName ?? null,
    email: c.email ?? null,
    defaultBranch: c.defaultBranch
      ? { id: c.defaultBranch.id, name: c.defaultBranch.name }
      : null,
    allowedBranches:
      'allowedBranches' in c && Array.isArray(c.allowedBranches)
        ? c.allowedBranches.map((b) => ({ id: b.id, name: b.name }))
        : [],
    estado: (c.estado ?? 'HABILITADO') as CompanyStatus,
    origen: (c.origen ?? 'MANUAL') as CompanyOrigin,
    seller:
      'seller' in c && c.seller && typeof (c.seller as { fullName?: string }).fullName === 'string'
        ? { fullName: (c.seller as { fullName?: string }).fullName ?? '' }
        : null,
  }))

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Directorio de Empresas
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Gestión de clientes corporativos y convenios activos.
            {canDelete && (
              <span className="ml-2 text-red-600 font-bold">
                · Selecciona empresas para eliminar (SUPERADMIN)
              </span>
            )}
          </p>
        </div>

        <CompanyFormModal />
      </div>

      {/* IMPL-20260623-03: Barra de filtros (estado, origen, vendedor, búsqueda) */}
      <form
        method="get"
        action="/companies"
        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-3"
      >
        <div>
          <label
            htmlFor="filter-estado"
            className="text-[11px] font-bold text-slate-500 uppercase"
          >
            Estado
          </label>
          <select
            id="filter-estado"
            name="estado"
            defaultValue={estado ?? ''}
            className="w-full bg-slate-50 ring-1 ring-slate-200 rounded-lg p-2 text-sm mt-1"
          >
            <option value="">Todos</option>
            <option value="PENDIENTE_REVISION">Pendiente</option>
            <option value="HABILITADO">Habilitado</option>
            <option value="DESHABILITADO">Deshabilitado</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="filter-origen"
            className="text-[11px] font-bold text-slate-500 uppercase"
          >
            Origen
          </label>
          <select
            id="filter-origen"
            name="origen"
            defaultValue={origen ?? ''}
            className="w-full bg-slate-50 ring-1 ring-slate-200 rounded-lg p-2 text-sm mt-1"
          >
            <option value="">Todos</option>
            <option value="MANUAL">Manual</option>
            <option value="AUTO_ALTA">Auto-Alta</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="filter-seller"
            className="text-[11px] font-bold text-slate-500 uppercase"
          >
            Vendedor
          </label>
          <select
            id="filter-seller"
            name="sellerId"
            defaultValue={sellerId ?? ''}
            className="w-full bg-slate-50 ring-1 ring-slate-200 rounded-lg p-2 text-sm mt-1"
          >
            <option value="">Todos</option>
            {sellers.map((s: { id: string; fullName: string }) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="filter-q"
            className="text-[11px] font-bold text-slate-500 uppercase"
          >
            Buscar
          </label>
          <input
            id="filter-q"
            name="q"
            type="text"
            defaultValue={q ?? ''}
            placeholder="Razón social o RFC"
            className="w-full bg-slate-50 ring-1 ring-slate-200 rounded-lg p-2 text-sm mt-1"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg"
          >
            Aplicar
          </button>
          {filtersActive && (
            <Link
              href="/companies"
              className="text-xs font-bold text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100"
            >
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {canDelete ? (
        <CompanyBulkDeleteShell companies={selectableCompanies} />
      ) : (
        <CompanySelectableTable
          companies={selectableCompanies}
          selectable={false}
          selectedIds={new Set()}
          onSelectionChange={() => {
            /* no-op: tabla plana para roles no-SUPERADMIN */
          }}
        />
      )}
    </div>
  )
}
