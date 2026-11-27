'use client'

/**
 * Controles interactivos para la ficha de detalle de Proyecto (/projects/[id]).
 * Permite:
 *   - Cambiar estado del proyecto y editarlo (incluyendo asignación de Unidad Móvil)
 *   - Cargar trabajadores por Excel (Alta masiva) o Manual (Captura rápida) contextualizados
 *   - Marcar llegada e ingresar trabajadores a atención clínica directamente desde la ficha
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileSpreadsheet,
  Pencil,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { ProjectStatus } from '@prisma/client'
import { dischargePatientFromReception } from '@/actions/event.actions'
import {
  checkInProjectWorkerToClinical,
  deleteProject,
  markProjectWorkerArrived,
  updateProjectStatus,
} from '@/actions/project.actions'
import ProjectFormModal, {
  type BranchOption,
  type CompanyOption,
  type MobileUnitOption,
  type ProjectForEdit,
} from '@/components/ProjectFormModal'
import BulkWorkerImportModal from '@/components/BulkWorkerImportModal'

const PROJECT_STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'IN_PROGRESS', label: 'En curso' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

const STATUS_SELECT_COLORS: Record<ProjectStatus, string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-700',
  CONFIRMED: 'border-blue-200 bg-blue-50 text-blue-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
}

interface ProjectHeaderControlsProps {
  project: ProjectForEdit & { status: ProjectStatus }
  companies: CompanyOption[]
  branches: BranchOption[]
  mobileUnits: MobileUnitOption[]
  canManage: boolean
  canDelete?: boolean
}

export function ProjectHeaderControls({
  project,
  companies,
  branches,
  mobileUnits,
  canManage,
  canDelete = false,
}: ProjectHeaderControlsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!canManage) return null

  function handleStatusChange(nextStatus: ProjectStatus) {
    setStatusError(null)
    startTransition(async () => {
      const res = await updateProjectStatus(project.id, nextStatus)
      if (!res.success) {
        setStatusError(res.error ?? 'No se pudo actualizar el estado del proyecto.')
        return
      }
      router.refresh()
    })
  }

  function handleDeleteProject() {
    setStatusError(null)
    startTransition(async () => {
      const res = await deleteProject(project.id)
      if (!res.success) {
        setStatusError(res.error ?? 'No se pudo eliminar el proyecto.')
        setConfirmDeleteOpen(false)
        return
      }
      setConfirmDeleteOpen(false)
      router.push('/projects')
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-col items-stretch sm:items-end gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span>Estado:</span>
            <select
              aria-label="Estado del proyecto"
              value={project.status}
              disabled={isPending}
              onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer focus:outline-none disabled:opacity-60 ${STATUS_SELECT_COLORS[project.status]}`}
            >
              {PROJECT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5 text-[#592c82]" />
            Editar proyecto
          </button>

          {canDelete && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setStatusError(null)
                setConfirmDeleteOpen(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          )}
        </div>

        {statusError && (
          <p className="text-xs font-medium text-red-600" role="alert">
            {statusError}
          </p>
        )}
      </div>

      <ProjectFormModal
        companies={companies}
        branches={branches}
        mobileUnits={mobileUnits}
        projectToEdit={project}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => router.refresh()}
        onDeleted={() => {
          router.push('/projects')
          router.refresh()
        }}
      />

      {confirmDeleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) setConfirmDeleteOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Eliminar proyecto</h3>
                <p className="mt-1 text-sm text-slate-600">
                  ¿Seguro que deseas eliminar <strong>«{project.name}»</strong>? Se conservarán intactos los trabajadores registrados y su historia clínica.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmDeleteOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleDeleteProject}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface ProjectWorkersToolbarProps {
  projectId: string
  companyId: string | null
  companies: CompanyOption[]
  branches: BranchOption[]
  canManage: boolean
  compact?: boolean
}

export function ProjectWorkersToolbar({
  projectId,
  companyId,
  companies,
  branches,
  canManage,
  compact = false,
}: ProjectWorkersToolbarProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [importMode, setImportMode] = useState<'excel' | 'quick'>('excel')

  if (!canManage) return null

  const disabledNoCompany = !companyId

  function openWithMode(mode: 'excel' | 'quick') {
    setImportMode(mode)
    setImportOpen(true)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openWithMode('excel')}
          disabled={disabledNoCompany}
          title={
            disabledNoCompany
              ? 'Asigna primero una empresa al proyecto para importar trabajadores'
              : undefined
          }
          className={`inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 ${
            compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-xs'
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          + Alta masiva (Excel)
        </button>

        <button
          type="button"
          onClick={() => openWithMode('quick')}
          disabled={disabledNoCompany}
          title={
            disabledNoCompany
              ? 'Asigna primero una empresa al proyecto para registrar trabajadores'
              : undefined
          }
          className={`inline-flex items-center gap-1.5 rounded-xl bg-[#592c82] font-semibold text-white shadow-sm transition-colors hover:bg-[#49226b] disabled:cursor-not-allowed disabled:opacity-50 ${
            compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-xs'
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          + Agregar trabajador
        </button>
      </div>

      <BulkWorkerImportModal
        companies={companies}
        branches={branches}
        isOpen={importOpen}
        onOpenChange={setImportOpen}
        initialCompanyId={companyId ?? undefined}
        initialProjectId={projectId}
        lockProjectContext={Boolean(companyId)}
        initialMode={importMode}
        hideTrigger
      />
    </>
  )
}

interface ProjectWorkerRowActionsProps {
  projectId: string
  workerId: string
  receptionStatus: 'PENDING' | 'ARRIVED' | 'CHECKED_IN'
  eventId: string | null
  eventStatus: string | null
  dischargedAt: string | null
  checkoutReady: boolean
  hasVerdict: boolean
  canManage: boolean
}

export function ProjectWorkerRowActions({
  projectId,
  workerId,
  receptionStatus,
  eventId,
  eventStatus,
  dischargedAt,
  checkoutReady,
  hasVerdict,
  canManage,
}: ProjectWorkerRowActionsProps) {
  const router = useRouter()
  const [busyAction, setBusyAction] = useState<'ARRIVED' | 'CHECK_IN' | 'DISCHARGE' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleMarkArrival() {
    setError(null)
    setBusyAction('ARRIVED')
    const res = await markProjectWorkerArrived(projectId, workerId)
    setBusyAction(null)
    if (!res.success) {
      setError(res.error ?? 'No se pudo marcar llegada.')
      return
    }
    router.refresh()
  }

  async function handleCheckIn() {
    setError(null)
    setBusyAction('CHECK_IN')
    const res = await checkInProjectWorkerToClinical(projectId, workerId)
    setBusyAction(null)
    if (!res.success) {
      setError(res.error ?? 'No se pudo ingresar a UMM.')
      return
    }
    if (res.eventId) {
      router.push(`/events/${res.eventId}`)
      return
    }
    router.refresh()
  }

  async function handleSendToValidation() {
    if (!eventId) return
    setError(null)
    setBusyAction('DISCHARGE')
    const res = await dischargePatientFromReception(eventId)
    setBusyAction(null)
    if (!res.success) {
      setError(res.error ?? 'No se pudo enviar a validación.')
      return
    }
    router.refresh()
  }

  if (eventId && (dischargedAt || hasVerdict || eventStatus === 'COMPLETED')) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {hasVerdict ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Dictaminado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
            <ClipboardCheck className="h-3.5 w-3.5" />
            En validación
          </span>
        )}
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#592c82]/30 hover:text-[#592c82]"
        >
          <span>Abrir expediente</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    )
  }

  if (eventId) {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#592c82]/30 hover:text-[#592c82]"
          >
            <span>Abrir papeleta</span>
            <ExternalLink className="h-3 w-3" />
          </Link>

          {canManage && (
            <button
              type="button"
              disabled={!checkoutReady || busyAction !== null}
              onClick={handleSendToValidation}
              title={
                !checkoutReady
                  ? 'Completa primero la captura de estudios en la papeleta'
                  : 'Registrar salida UMM y enviar a validación médica'
              }
              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{busyAction === 'DISCHARGE' ? 'Enviando…' : 'Enviar a validación'}</span>
            </button>
          )}
        </div>

        {error && (
          <p className="text-[11px] font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (!canManage) {
    return <span className="text-xs text-slate-400">Sin evento aún</span>
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {receptionStatus === 'PENDING' && (
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleMarkArrival}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserCheck className="h-3.5 w-3.5" />
            {busyAction === 'ARRIVED' ? 'Marcando…' : 'Marcar llegada'}
          </button>
        )}

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleCheckIn}
          className="inline-flex items-center gap-1 rounded-lg border border-[#592c82]/25 bg-[#592c82]/10 px-2.5 py-1.5 text-xs font-semibold text-[#592c82] transition-colors hover:bg-[#592c82]/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{busyAction === 'CHECK_IN' ? 'Ingresando…' : 'Ingresar a UMM'}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && (
        <p className="text-[11px] font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
