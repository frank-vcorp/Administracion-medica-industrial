/**
 * @file WorkersPageClient — wrapper client-component para /workers.
 * @id IMPL-20260730-07
 * @spec context/SPECs/SPEC_FIX-20260730-06-DELETE-WORKERS-SUPERADMIN.md
 */
'use client'

import { useCallback, useMemo, useState } from 'react'
import WorkerSelectableGrid, {
  type SelectableWorker,
} from './WorkerSelectableGrid'
import DeleteWorkersButton from './DeleteWorkersButton'

interface Props {
  workers: SelectableWorker[]
  companies: Array<{ id: string; name: string; defaultBranchId: string | null }>
  medicalProfiles: Array<{ id: string; name: string; companyId: string | null }>
  initialEditWorkerId?: string
  isSuperAdmin: boolean
  /** Oculta columna Empresa (p. ej. pantalla Público General). */
  hideCompanyColumn?: boolean
}

export default function WorkersPageClient({
  workers,
  companies,
  medicalProfiles,
  initialEditWorkerId,
  isSuperAdmin,
  hideCompanyColumn = false,
}: Props) {
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

  return (
    <>
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

      {selectable && (
        <DeleteWorkersButton
          selectedNames={selectedNames}
          onClearSelection={clearSelection}
        />
      )}
    </>
  )
}
