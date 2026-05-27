/**
 * @file Detalle de Empresa — Puestos de Trabajo
 * @description Página de detalle de empresa con gestión de puestos, perfiles médicos y sucursales B2B.
 * @id IMPL-20260527-01
 * @backup context/SPECs/SPEC_ARCH-20260527-04-PERFILES-MEDICOS-EN-EMPRESA-Y-ASIGNACION-A-PUESTOS.md
 * @see context/SPECs/SPEC_ARCH-20260527-04-PERFILES-MEDICOS-EN-EMPRESA-Y-ASIGNACION-A-PUESTOS.md
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCompanyById } from '@/actions/company.actions'
import { getJobPositionsByCompany } from '@/actions/job-positions.actions'
import { getMedicalProfilesForCompany, getMedicalTests } from '@/actions/medical-profiles'
import { getBranches } from '@/actions/admin.actions'
import JobPositionsPanel from './JobPositionsPanel'
import AllowedBranchesPanel from './AllowedBranchesPanel'
import CompanyMedicalProfilesPanel from './CompanyMedicalProfilesPanel'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const { id } = await params

  const [company, jobPositions, profiles, branches, availableTests] = await Promise.all([
    getCompanyById(id),
    getJobPositionsByCompany(id),
    getMedicalProfilesForCompany(id),
    getBranches(),
    getMedicalTests(),
  ])

  if (!company) notFound()

  const companyProfiles = profiles.filter((profile) => profile.companyId === id)

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
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            {company.rfc && (
              <p className="text-sm font-mono text-slate-500 mt-0.5">RFC: {company.rfc}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
              {company.contactName && (
                <span>👤 {company.contactName}</span>
              )}
              {company.email && (
                <span>✉️ {company.email}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* IMPL-20260318-09: Panel Sucursales Permitidas (multi-sucursal con checkboxes) */}
      <AllowedBranchesPanel
        companyId={id}
        allBranches={branches.map(b => ({ id: b.id, name: b.name }))}
        initialAllowedIds={(company.allowedBranches ?? []).map((b: { id: string }) => b.id)}
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
