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
 *
 * IMPL-20260808-04 (Opción A — lazy loading): la columna "Identificación" ya
 * NO carga la imagen base64 de la INE en el listado (≈1MB c/u). Cuando el
 * worker tiene `lastIdentityDocumentType` se muestra un placeholder
 * "🪪 Ver INE" clickable que invoca `getWorkerIdentityImage(workerId)`
 * on-demand y abre el `IdentityLightbox` con los datos recibidos. Si el
 * worker nunca ha registrado INE, fallback al avatar de iniciales.
 */
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import WorkerFormModal, { WorkerForEdit } from '@/components/WorkerFormModal'
import IdentityLightbox from '@/components/IdentityLightbox'
import { getWorkerIdentityImage } from '@/actions/worker.actions'

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
  // IMPL-20260808-04: campos de última identificación (persistidos en
  // closeReceptionCorroboration). Opcionales para no romper consumidores
  // legados. En el listado `getWorkers()` actual siempre retorna
  // `lastIdentityDocumentType` y `lastIdentityVerifiedAt`, pero los dataURL
  // (`lastIdentityFrontFileUrl`, `lastIdentityBackFileUrl`) llegan como
  // `null` desde el listado — se cargan on-demand vía
  // `getWorkerIdentityImage(workerId)`.
  lastIdentityDocumentType?: string | null
  lastIdentityFrontFileUrl?: string | null
  lastIdentityBackFileUrl?: string | null
  lastIdentityVerifiedAt?: string | Date | null
}

interface CompanyOption { id: string; name: string }
interface JobPositionOption { id: string; name: string; companyId: string | null }

// IMPL-20260808-04 (Opción A): shape de los datos que necesita el lightbox.
// Se construyen tras la respuesta de `getWorkerIdentityImage`.
interface IdentityLightboxState {
  frontFileUrl: string
  backFileUrl: string | null
  documentType: string | null
  fullName: string
}

// IMPL-20260808-04 (Opción A): etiquetas legibles para el subtítulo del
// lightbox. Mantenemos paridad con `WorkerIdentityCard.tsx`.
const DOC_TYPE_LABELS: Record<string, string> = {
  INE: 'INE',
  PASAPORTE: 'Pasaporte',
  LICENCIA: 'Licencia de conducir',
  OTRA_IDENTIFICACION_OFICIAL: 'Otra identificación oficial',
}

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
  // IMPL-20260808-04 (Opción A): el lightbox ahora se alimenta de los datos
  // recibidos por `getWorkerIdentityImage`, no de un `SelectableWorker` local.
  // `null` cuando esta cerrado.
  const [identityLightbox, setIdentityLightbox] = useState<IdentityLightboxState | null>(null)
  // ID del worker cuya imagen estamos cargando; sirve para mostrar un
  // spinner en el placeholder durante el fetch on-demand.
  const [loadingIdentityId, setLoadingIdentityId] = useState<string | null>(null)
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

  // IMPL-20260808-04 (Opción A): handler del placeholder "🪪 Ver INE".
  // Llama al server action `getWorkerIdentityImage` on-demand, valida la
  // respuesta y, si trae datos, abre el lightbox. Si falla, muestra un
  // mensaje y mantiene el placeholder visible (no aborta la tabla).
  const handleIdentityClick = useCallback(async (worker: SelectableWorker) => {
    setLoadingIdentityId(worker.id)
    try {
      const result = await getWorkerIdentityImage(worker.id)
      if (result.success && result.data) {
        setIdentityLightbox({
          frontFileUrl: result.data.frontFileUrl,
          backFileUrl: result.data.backFileUrl,
          documentType: result.data.documentType,
          fullName: `${worker.firstName} ${worker.lastName}`,
        })
      } else {
        window.alert(result.error ?? 'No se pudo cargar la identificación')
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al cargar la identificación'
      window.alert(message)
    } finally {
      setLoadingIdentityId(null)
    }
  }, [])

  const docTypeLabel =
    identityLightbox?.documentType
      ? DOC_TYPE_LABELS[identityLightbox.documentType] ?? identityLightbox.documentType
      : null

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
              {/* IMPL-20260808-04: miniatura de identificación. Oculta en móvil
                  (<768px) para no romper el layout responsive del listado. */}
              <th className="px-6 py-4 hidden md:table-cell">Identificación</th>
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
                  colSpan={selectable ? 9 : 8}
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
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    <Link
                      href={`/workers/${w.id}`}
                      className="hover:text-blue-700 hover:underline transition-colors"
                      title={`Ver perfil de ${w.firstName} ${w.lastName}`}
                    >
                      {w.universalId}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <Link
                      href={`/workers/${w.id}`}
                      className="hover:text-blue-700 hover:underline transition-colors"
                      title={`Ver perfil de ${w.firstName} ${w.lastName}`}
                    >
                      {w.firstName} {w.lastName}
                    </Link>
                  </td>
                  {/* IMPL-20260808-04 (Opción A): celda de identificación con
                      carga perezosa. Tres estados:
                        1. Tiene `lastIdentityDocumentType` → placeholder
                           clickable "🪪 Ver INE" que invoca la server action
                           on-demand al hacer click.
                        2. No tiene INE registrada nunca → avatar de iniciales
                           (idéntico al comportamiento previo).
                        3. Está cargando (loadingIdentityId === w.id) →
                           placeholder con spinner mientras llega la imagen. */}
                  <td className="px-6 py-4 hidden md:table-cell">
                    {w.lastIdentityDocumentType ? (
                      <button
                        type="button"
                        onClick={() => void handleIdentityClick(w)}
                        disabled={loadingIdentityId === w.id}
                        className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex flex-col items-center justify-center text-[10px] font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-colors disabled:opacity-60 disabled:cursor-wait"
                        aria-label={`Ver identificación de ${w.firstName} ${w.lastName}`}
                        title="Click para ver la identificación completa"
                      >
                        {loadingIdentityId === w.id ? (
                          <span aria-hidden="true">⏳</span>
                        ) : (
                          <>
                            <span aria-hidden="true">🪪</span>
                            <span>Ver INE</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400"
                        aria-label="Sin identificación registrada"
                        title="Sin identificación registrada"
                      >
                        {w.firstName[0]}{w.lastName[0]}
                      </div>
                    )}
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

      {/* IMPL-20260808-04 (Opción A): lightbox alimentado por la respuesta de
          `getWorkerIdentityImage`. Se abre sólo cuando hay datos cargados. */}
      <IdentityLightbox
        open={identityLightbox !== null}
        onClose={() => setIdentityLightbox(null)}
        src={identityLightbox?.frontFileUrl ?? null}
        backSrc={identityLightbox?.backFileUrl ?? null}
        alt={
          identityLightbox
            ? `Identificación de ${identityLightbox.fullName}`
            : 'Identificación'
        }
        backAlt={
          identityLightbox
            ? `Reverso de identificación de ${identityLightbox.fullName}`
            : 'Reverso'
        }
        title={
          identityLightbox
            ? `Identificación de ${identityLightbox.fullName}`
            : undefined
        }
        subtitle={
          docTypeLabel ?? 'Click fuera de la imagen o presiona ESC para cerrar'
        }
      />
    </>
  )
}