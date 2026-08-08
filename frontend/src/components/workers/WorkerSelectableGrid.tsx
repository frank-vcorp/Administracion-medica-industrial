/**
 * @file WorkerSelectableGrid — tabla de pacientes con checkboxes condicionales.
 * @id IMPL-20260730-07
 * @spec context/SPECs/SPEC_FIX-20260730-06-DELETE-WORKERS-SUPERADMIN.md
 *
 * Client component. Sólo SUPERADMIN recibe checkboxes de selección. Para
 * otros roles el render es idéntico a la tabla anterior.
 *
 * La selección se eleva al padre vía callback `onSelectionChange(ids, names)`
 * para que `DeleteWorkersButton` pueda consumirla desde un componente
 * hermano en la misma página.
 *
 * Estructura idéntica a `WorkersTable` pero con columna adicional de checkbox
 * en el extremo izquierdo cuando `selectable=true`. El header incluye
 * "select all" para los visibles.
 */
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import WorkerFormModal, { WorkerForEdit } from '@/components/WorkerFormModal'

export interface SelectableWorker {
  id: string
  universalId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  dob: Date | null
  companyId: string | null
  jobPositionId: string | null
  company: { name: string; defaultBranchId: string | null } | null
  jobPosition: { id: string; name: string; defaultProfileId: string | null } | null
}

interface CompanyOption { id: string; name: string }
interface JobPositionOption { id: string; name: string; companyId: string | null }

interface Props {
  workers: SelectableWorker[]
  companies: CompanyOption[]
  jobPositions: JobPositionOption[]
  initialEditWorkerId?: string
  /** Si true, renderiza checkboxes y permite selección. */
  selectable: boolean
  selectedIds: Set<string>
  onSelectionChange: (
    next: Set<string>,
    meta: {
      selectedNames: Array<{ id: string; fullName: string; universalId: string }>
    }
  ) => void
}

export default function WorkerSelectableGrid({
  workers,
  companies,
  jobPositions,
  initialEditWorkerId,
  selectable,
  selectedIds,
  onSelectionChange,
}: Props) {
  const [workerToEdit, setWorkerToEdit] = useState<WorkerForEdit | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  function toEditPayload(w: SelectableWorker): WorkerForEdit {
    return {
      id: w.id,
      firstName: w.firstName,
      lastName: w.lastName,
      dob: w.dob,
      email: w.email,
      phone: w.phone,
      companyId: w.companyId,
      jobPositionId: w.jobPositionId,
    }
  }

  // ARCH-20260318-09: apertura automática por query param ?edit= para resolver duplicate_found.
  useEffect(() => {
    if (!initialEditWorkerId) return

    const matchedWorker = workers.find((worker) => worker.id === initialEditWorkerId)
    if (!matchedWorker) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre modal automáticamente si initialEditWorkerId viene por query string.
    setWorkerToEdit(toEditPayload(matchedWorker))
    router.replace(pathname)
  }, [initialEditWorkerId, pathname, router, workers])

  function handleCloseEditModal() {
    setWorkerToEdit(null)
    router.replace(pathname)
  }

  const toggleOne = useCallback(
    (id: string) => {
      const next = new Set(selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      const selectedNames = workers
        .filter((w) => next.has(w.id))
        .map((w) => ({
          id: w.id,
          fullName: `${w.firstName} ${w.lastName}`,
          universalId: w.universalId,
        }))
      onSelectionChange(next, { selectedNames })
    },
    [workers, onSelectionChange, selectedIds]
  )

  const toggleAll = useCallback(() => {
    const allSelected = workers.every((w) => selectedIds.has(w.id))
    const next = allSelected ? new Set<string>() : new Set(workers.map((w) => w.id))
    const selectedNames = allSelected
      ? []
      : workers.map((w) => ({
          id: w.id,
          fullName: `${w.firstName} ${w.lastName}`,
          universalId: w.universalId,
        }))
    onSelectionChange(next, { selectedNames })
  }, [workers, onSelectionChange, selectedIds])

  const allSelected = workers.length > 0 && workers.every((w) => selectedIds.has(w.id))

  return (
    <>
      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
            <tr>
              {selectable && (
                <th className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos"
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
              )}
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Nombre Completo</th>
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">Puesto</th>
              <th className="px-6 py-4">Correo</th>
              <th className="px-6 py-4">Teléfono</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {workers.length === 0 && (
              <tr>
                <td
                  colSpan={selectable ? 8 : 7}
                  className="p-8 text-center text-slate-400"
                >
                  Sin trabajadores registrados
                </td>
              </tr>
            )}
            {workers.map((w) => {
              const selected = selectedIds.has(w.id)
              return (
                <tr
                  key={w.id}
                  className={
                    'hover:bg-slate-50 transition-colors ' +
                    (selected && selectable ? 'bg-red-50/40' : '')
                  }
                >
                  {selectable && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${w.firstName} ${w.lastName}`}
                        className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        checked={selected}
                        onChange={() => toggleOne(w.id)}
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{w.universalId}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {w.firstName} {w.lastName}
                  </td>
                  <td className="px-6 py-4">
                    {w.company ? (
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold border border-blue-100 w-fit inline-block">
                        {w.company.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Sin Empresa</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {w.jobPosition ? (
                      <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-bold border border-amber-100 w-fit inline-block">
                        {w.jobPosition.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {w.email || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {w.phone || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setWorkerToEdit(toEditPayload(w))}
                        className="text-amber-600 hover:text-amber-800 text-xs font-semibold hover:underline"
                      >
                        Editar
                      </button>
                      {/* IMPL-20260808-03: acceso directo a agendar cita desde el listado de pacientes.
                          Reaprovecha el flujo ?action=new-appointment&workerId=...&companyId=... ya existente en AppointmentFormModal. */}
                      <Link
                        href={`/appointments?action=new-appointment&workerId=${w.id}${w.companyId ? `&companyId=${w.companyId}` : ''}`}
                        className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold hover:underline"
                        title="Agendar cita para este paciente"
                      >
                        + Cita
                      </Link>
                      <Link
                        href={`/history/${w.id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Historial
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {workerToEdit && (
        <WorkerFormModal
          companies={companies}
          jobPositions={jobPositions}
          workerToEdit={workerToEdit}
          isOpen={true}
          onClose={handleCloseEditModal}
        />
      )}
    </>
  )
}