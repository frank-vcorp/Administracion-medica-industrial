/**
 * @file Detalle de Empresa — Puestos de Trabajo + Ficha Cliente v2.
 * @description Página de detalle de empresa con gestión de puestos, perfiles médicos,
 *              sucursales B2B, historial de vendedor, formulario fiscal completo
 *              y acciones operativas (cambiar vendedor / toggle / revisar).
 * @id IMPL-20260527-01 (núcleo) + IMPL-20260623-03 (integración Ficha v2)
 * @see context/SPECs/SPEC_ARCH-20260527-04-PERFILES-MEDICOS-EN-EMPRESA-Y-ASIGNACION-A-PUESTOS.md
 * @see context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { getCompanyById, listActiveSellersAction } from '@/actions/company.actions'
import { getJobPositionsByCompany } from '@/actions/job-positions.actions'
import { getMedicalProfilesForCompany, getMedicalTests } from '@/actions/medical-profiles'
import { getBranches } from '@/actions/admin.actions'
import JobPositionsPanel from './JobPositionsPanel'
import AllowedBranchesPanel from './AllowedBranchesPanel'
import CompanyMedicalProfilesPanel from './CompanyMedicalProfilesPanel'
import { CompanyStatusBadge } from '@/components/companies/CompanyStatusBadge'
import CompanySellerHistoryPanel from '@/components/companies/CompanySellerHistoryPanel'
import CompanyFullFormView from '@/components/companies/CompanyFullFormView'
import CompanyActionsPanel, { type SellerOption } from '@/components/companies/CompanyActionsPanel'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const { id } = await params

  const session = await getServerSession(authOptions)
  const role = (session?.user?.role as string | undefined) ?? 'COMPANY_CLIENT'

  const [company, jobPositions, profiles, branches, availableTests, sellersRaw] =
    await Promise.all([
      getCompanyById(id),
      getJobPositionsByCompany(id),
      getMedicalProfilesForCompany(id),
      getBranches(),
      getMedicalTests(),
      // La server action valida sesión; aquí ya estamos autenticados
      listActiveSellersAction().catch(() => []),
    ])

  if (!company) notFound()

  // company.id === id por construcción (company ya validado como !null arriba).
  // Usar company.id deja a TS inferir el tipo real de profile (companyId: string | null)
  // y la comparación string | null === string es válida (sin warnings de lint).
  const companyProfiles = profiles.filter((profile) => profile.companyId === company.id)

  // Normalizar a la forma que consume el panel client
  const sellers: SellerOption[] = (sellersRaw ?? []).map((s: { id: string; fullName: string; email: string }) => ({
    id: s.id,
    fullName: s.fullName,
    email: s.email,
  }))

  // El campo "estado" y "origen" vienen del modelo Company (Prisma)
  const estado = (company as { estado?: 'PENDIENTE_REVISION' | 'HABILITADO' | 'DESHABILITADO' }).estado ?? 'HABILITADO'
  const origen = (company as { origen?: 'MANUAL' | 'AUTO_ALTA' }).origen ?? 'MANUAL'
  const sellerId = (company as { sellerId?: string | null }).sellerId ?? null

  const canEdit = role !== 'COMPANY_CLIENT' && estado === 'HABILITADO'

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/companies" className="hover:text-slate-800 transition-colors">
          Empresas Cliente
        </Link>
        <span>›</span>
        <span className="text-slate-800 font-medium">{company.name}</span>
      </nav>

      {/* Encabezado Empresa */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl flex-shrink-0">
            🏢
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
              <CompanyStatusBadge estado={estado} origen={origen} size="md" />
            </div>
            {company.rfc && (
              <p className="text-sm font-mono text-slate-500 mt-0.5">RFC: {company.rfc}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
              {company.contactName && <span>👤 {company.contactName}</span>}
              {company.email && <span>✉️ {company.email}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* IMPL-20260623-03: Acciones operativas (cambiar vendedor, toggle, revisar) */}
      <CompanyActionsPanel
        companyId={id}
        estado={estado}
        currentSellerId={sellerId}
        sellers={sellers}
        role={role}
      />

      {/* IMPL-20260623-03: Historial de vendedor (el panel hace fetch interno) */}
      <CompanySellerHistoryPanel companyId={id} />

      {/* IMPL-20260623-03: Formulario fiscal completo (10 secciones) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Ficha fiscal completa
          </h2>
          {!canEdit && estado === 'PENDIENTE_REVISION' && (
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              Solo revisión
            </span>
          )}
        </div>
        <CompanyFullFormView
          company={
            company as unknown as React.ComponentProps<typeof CompanyFullFormView>['company']
          }
          mode={canEdit ? 'editable' : 'readonly'}
        />
      </div>

      {/* IMPL-20260527-01: Panel Sucursales Permitidas (multi-sucursal con checkboxes) */}
      <AllowedBranchesPanel
        companyId={id}
        allBranches={branches.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))}
        initialAllowedIds={(company.allowedBranches ?? []).map(
          (b: { id: string }) => b.id
        )}
      />

      <CompanyMedicalProfilesPanel
        companyId={id}
        companyName={company.name}
        companyProfiles={companyProfiles}
        availableTests={availableTests}
      />

      {/* Panel Puestos de Trabajo */}
      <JobPositionsPanel
        companyId={id}
        jobPositions={jobPositions}
        profiles={profiles}
      />
    </div>
  )
}
