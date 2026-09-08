/**
 * @file WorkersPageClient — wrapper client-component para /workers.
 * @id IMPL-20260730-07
 * @spec context/SPECs/SPEC_FIX-20260730-06-DELETE-WORKERS-SUPERADMIN.md
 */
'use client'

import { useCallback, useMemo, useState } from 'react'
import type { PatientExpedienteListRow } from '@/actions/patient-expediente.actions'
import UnifiedPatientExpedienteTable from './UnifiedPatientExpedienteTable'
import WorkerSelectableGrid, {
  type SelectableWorker,
} from './WorkerSelectableGrid'
import DeleteWorkersButton from './DeleteWorkersButton'

interface Props {
  expedienteRows?: PatientExpedienteListRow[]
  padronOnlyRows?: PatientExpedienteListRow[]
  workers: SelectableWorker[]
  companies: Array<{ id: string; name: string; defaultBranchId: string | null }>
  medicalProfiles: Array<{ id: string; name: string; companyId: string | null }>
  initialEditWorkerId?: string
  isSuperAdmin: boolean
  /** Oculta columna Empresa (p. ej. pantalla Público General). */
  hideCompanyColumn?: boolean
}

export default function WorkersPageClient({
  expedienteRows = [],
  padronOnlyRows = [],
  workers,
  companies,
  medicalProfiles,
  initialEditWorkerId,
  isSuperAdmin,
  hideCompanyColumn = false,
}: Props) {
  const [viewMode, setViewMode] = useState<'atenciones' | 'padron'>(
    expedienteRows.length > 0 ? 'atenciones' : 'padron',
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedNames, setSelectedNames] = useState<
    Array<{ id: string; fullName: string; universalId: string }>
  >([])

  const handleSelectionChange = useCallback(
    (
      next: Set<string>,
      meta: {
        selectedNames: Array<{ id: string; fullName: string; universalId: string }>
      }
    ) => {
      setSelectedIds(next)
      setSelectedNames(meta.selectedNames)
    },
    []
  )

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectedNames([])
  }, [])

  const selectable = isSuperAdmin

  const companyOptions = useMemo(
    () => companies.map((c) => ({ id: c.id, name: c.name })),
    [companies]
  )

  const unifiedRows = useMemo(
    () => [...expedienteRows, ...padronOnlyRows],
    [expedienteRows, padronOnlyRows]
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {(expedienteRows.length > 0 || padronOnlyRows.length > 0) && (
          <button
            type="button"
            onClick={() => setViewMode('atenciones')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'atenciones'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Atenciones y expedientes
          </button>
        )}
        <button
          type="button"
          onClick={() => setViewMode('padron')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            viewMode === 'padron'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Padrón completo
        </button>
      </div>

      {viewMode === 'atenciones' ? (
        <UnifiedPatientExpedienteTable
          rows={unifiedRows}
          companies={companyOptions}
          medicalProfiles={medicalProfiles}
        />
      ) : (
        <WorkerSelectableGrid
          workers={workers}
          companies={companyOptions}
          medicalProfiles={medicalProfiles}
          initialEditWorkerId={initialEditWorkerId}
          selectable={selectable}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          hideCompanyColumn={hideCompanyColumn}
        />
      )}

      {viewMode === 'padron' && selectable && (
        <DeleteWorkersButton
          selectedNames={selectedNames}
          onClearSelection={clearSelection}
        />
      )}
    </>
  )
}
