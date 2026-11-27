'use client'

/**
 * Tabla de Proyectos de Visita Médica con acciones inline.
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, FolderKanban, Trash2, UserPlus } from 'lucide-react'
import { deleteProject, updateProjectStatus } from '@/actions/project.actions'
import ProjectFormModal, { MobileUnitOption, ProjectForEdit } from '@/components/ProjectFormModal'
import { ProjectStatus } from '@prisma/client'

interface CompanyOption { id: string; name: string }
interface BranchOption { id: string; name: string }

interface ProjectRow {
  id: string
  name: string
  status: ProjectStatus
  startDate: Date
  endDate: Date
  unitRef: string | null
  notes: string | null
  companyId: string | null // ARCH-20260730-01: nullable tras eliminación de empresa
  branchId: string | null
  company: { id: string; name: string } | null // ARCH-20260730-01: nullable tras eliminación de empresa
  branch: { id: string; name: string } | null
  mobileUnit?: { id: string; name: string; plate: string | null; status: string } | null
  _count: { workers: number }
}

interface ProjectsTableProps {
  projects: ProjectRow[]
  companies: CompanyOption[]
  branches: BranchOption[]
  mobileUnits?: MobileUnitOption[]
  onAddWorkers?: (project: { id: string; name: string; companyId: string | null }) => void
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'En Curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}

const STATUS_OPTIONS: ProjectStatus[] = [
  'DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
]

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function ProjectsTable({
  projects,
  companies,
  branches,
  mobileUnits = [],
  onAddWorkers,
}: ProjectsTableProps) {
  const router = useRouter()
  const [editProject, setEditProject] = useState<ProjectForEdit | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [statusLoading, setStatusLoading] = useState<string | null>(null)

  function handleConfirmDelete() {
    if (!projectToDelete) return
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteProject(projectToDelete.id)
      if (!res.success) {
        setDeleteError(res.error ?? 'No se pudo eliminar el proyecto.')
        return
      }
      setProjectToDelete(null)
      router.refresh()
    })
  }

  function handleEdit(p: ProjectRow) {
    setEditProject({
      id: p.id,
      name: p.name,
      companyId: p.companyId,
      startDate: p.startDate,
      endDate: p.endDate,
      branchId: p.branchId,
      mobileUnitId: p.mobileUnit?.id ?? null,
      unitRef: p.unitRef,
      notes: p.notes,
    })
    setEditOpen(true)
  }

  function handleStatusChange(projectId: string, newStatus: ProjectStatus) {
    setStatusLoading(projectId)
    startTransition(async () => {
      await updateProjectStatus(projectId, newStatus)
      setStatusLoading(null)
    })
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#592c82]/12 text-[#592c82]">
          <FolderKanban className="h-6 w-6" />
        </div>
        <p className="text-slate-600 font-semibold">No hay proyectos registrados aún.</p>
        <p className="text-slate-400 text-sm mt-1">Usa &quot;Nuevo Proyecto&quot; para crear el primero.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Proyecto</th>
              <th className="px-4 py-3 text-left">Empresa</th>
              <th className="px-4 py-3 text-left">Fechas</th>
              <th className="px-4 py-3 text-left">Unidad</th>
              <th className="px-4 py-3 text-center">Trabajadores</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-semibold text-slate-800 hover:text-[#592c82] hover:underline"
                  >
                    {p.name}
                  </Link>
                  {p.notes && (
                    <p className="text-xs text-slate-400 truncate max-w-[180px]" title={p.notes}>
                      {p.notes}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">{p.company?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {formatDate(p.startDate)}
                  <span className="text-slate-400 mx-1">→</span>
                  {formatDate(p.endDate)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.mobileUnit ? (
                    <span className="font-medium text-slate-800">
                      {p.mobileUnit.name}
                      {p.mobileUnit.plate ? ` · ${p.mobileUnit.plate}` : ''}
                    </span>
                  ) : (
                    p.unitRef ?? p.branch?.name ?? (
                      <span className="text-slate-400 italic">Sin asignar</span>
                    )
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs">
                    {p._count.workers}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={p.status}
                    onChange={(e) => handleStatusChange(p.id, e.target.value as ProjectStatus)}
                    disabled={isPending && statusLoading === p.id}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[p.status]}`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex flex-wrap items-center justify-center gap-2.5">
                    {onAddWorkers && (
                      <button
                        type="button"
                        disabled={!p.companyId}
                        onClick={() => onAddWorkers({ id: p.id, name: p.name, companyId: p.companyId })}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <UserPlus className="h-3 w-3" />
                        Trabajadores
                      </button>
                    )}
                    <Link
                      href={`/projects/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#592c82] hover:underline"
                    >
                      Abrir ficha
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleEdit(p)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null)
                        setProjectToDelete({ id: p.id, name: p.name })
                      }}
                      title="Eliminar proyecto"
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de edición controlado */}
      <ProjectFormModal
        companies={companies}
        branches={branches}
        mobileUnits={mobileUnits}
        projectToEdit={editProject}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => router.refresh()}
        onDeleted={() => router.refresh()}
      />

      {projectToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) setProjectToDelete(null)
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
                  ¿Seguro que deseas eliminar <strong>«{projectToDelete.name}»</strong>? Se conservarán intactos los trabajadores registrados y su historia clínica.
                </p>
              </div>
            </div>
            {deleteError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setProjectToDelete(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmDelete}
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
