/**
 * @file BranchDetailTabs — Tabs (General/Operación/Empresas/Uso) en /branches/[id].
 * @id IMPL-20260730-05 (PR-3 de ARCH-20260730-01)
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §7.2
 *
 * Client Component con state local (`useState`) que decide qué sub-form
 * mostrar. Recibe la sucursal serializada del Server Component padre.
 *
 * Cada tab es un sub-componente independiente (BranchEditForm,
 * BranchOperationTab, BranchCompanyAssignment, BranchUsageStats) para
 * minimizar re-renders y mantener responsabilidades aisladas.
 */
'use client'

import { useState } from 'react'
import { BranchEditForm } from './BranchEditForm'
import { BranchOperationTab } from './BranchOperationTab'
import { BranchCompanyAssignment } from './BranchCompanyAssignment'
import { BranchUsageStats } from './BranchUsageStats'
import type { Branch } from '@prisma/client'

type BranchDetail = Branch & {
  allowedByCompanies: { id: string; name: string; rfc: string | null }[]
  companies: { id: string; name: string }[]
  _count: {
    // IMPL-20260730-06 (PR-4): conteos ampliados para BranchDeleteGuardModal.
    appointments: number
    events: number
    workers: number
    projects: number
    allowedByCompanies: number
    companies: number
  }
  tenant: { id: string; name: string }
}

type TabId = 'general' | 'operacion' | 'empresas' | 'uso'

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'operacion', label: 'Operación' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'uso', label: 'Uso' },
]

export function BranchDetailTabs({
  branch,
  availableCompanies,
}: {
  branch: BranchDetail
  availableCompanies: { id: string; name: string; rfc: string | null }[]
}) {
  const [tab, setTab] = useState<TabId>('general')

  return (
    <div>
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                tab === t.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {tab === 'general' && <BranchEditForm branch={branch} />}
        {tab === 'operacion' && <BranchOperationTab branch={branch} />}
        {tab === 'empresas' && (
          <BranchCompanyAssignment
            branch={branch}
            availableCompanies={availableCompanies}
          />
        )}
        {tab === 'uso' && <BranchUsageStats branch={branch} />}
      </div>
    </div>
  )
}

// Re-exportado para que los sub-componentes (BranchEditForm, etc.) puedan
// usar el mismo type sin redeclararlo. No se exporta desde page.tsx para no
// contaminar el barrel.
export type { BranchDetail }