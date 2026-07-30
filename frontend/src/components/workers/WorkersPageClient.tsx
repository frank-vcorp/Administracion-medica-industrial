/**
 * @file WorkersPageClient — wrapper client-component para /workers.
 * @id IMPL-20260730-07
 * @spec context/SPECs/SPEC_FIX-20260730-06-DELETE-WORKERS-SUPERADMIN.md
 *
 * La página /workers es server-component (carga datos con getWorkers()). La
 * selección requiere useState, por lo que se delega a este wrapper que
 * renderiza:
 *   - WorkerSelectableGrid (con o sin checkboxes según isSuperAdmin)
 *   - DeleteWorkersButton (solo visible si isSuperAdmin y hay selección)
 *
 * El server-component padre (/workers/page.tsx) pasa:
 *   - workers, companies, jobPositions: datos pre-cargados
 *   - initialEditWorkerId: ?edit=... query param (preserva behavior de ARCH-20260318-09)
 *   - isSuperAdmin: boolean derivado de session.user.role
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
  jobPositions: Array<{ id: string; name: string; companyId: string | null }>
  initialEditWorkerId?: string
  isSuperAdmin: boolean
}

export default function WorkersPageClient({
  workers,
  companies,
  jobPositions,
  initialEditWorkerId,
  isSuperAdmin,
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

  // Solo SUPERADMIN ve checkboxes y la barra inferior.
  const selectable = isSuperAdmin

  // Company/jobPosition reducidos a la forma mínima que consume
  // WorkerSelectableGrid / WorkerFormModal.
  const companyOptions = useMemo(
    () => companies.map((c) => ({ id: c.id, name: c.name })),
    [companies]
  )
  const jobPositionOptions = useMemo(
    () => jobPositions.map((j) => ({ id: j.id, name: j.name, companyId: null })),
    [jobPositions]
  )

  return (
    <>
      <WorkerSelectableGrid
        workers={workers}
        companies={companyOptions}
        jobPositions={jobPositionOptions}
        initialEditWorkerId={initialEditWorkerId}
        selectable={selectable}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
      />

      {/* Solo SUPERADMIN ve la barra inferior + modal de confirmación. */}
      {selectable && (
        <DeleteWorkersButton
          selectedNames={selectedNames}
          onClearSelection={clearSelection}
        />
      )}
    </>
  )
}