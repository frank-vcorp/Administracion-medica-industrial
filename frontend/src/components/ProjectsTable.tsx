'use client'

/**
 * Tabla de Proyectos de Visita Médica con acciones inline.
 * @id IMPL-20260519-14
 * @spec context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md
 */

import { useState, useTransition } from 'react'
import { updateProjectStatus } from '@/actions/project.actions'
import ProjectFormModal, { ProjectForEdit } from '@/components/ProjectFormModal'
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
  companyId: string
  branchId: string | null
  company: { id: string; name: string }
  branch: { id: string; name: string } | null
  _count: { workers: number }
}

interface ProjectsTableProps {
  projects: ProjectRow[]
  companies: CompanyOption[]
  branches: BranchOption[]
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

export default function ProjectsTable({ projects, companies, branches }: ProjectsTableProps) {
  const [editProject, setEditProject] = useState<ProjectForEdit | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [statusLoading, setStatusLoading] = useState<string | null>(null)

  function handleEdit(p: ProjectRow) {
    setEditProject({
      id: p.id,
      name: p.name,
      companyId: p.companyId,
      startDate: p.startDate,
      endDate: p.endDate,
      branchId: p.branchId,
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
        <div className="text-slate-400 text-4xl mb-3">📋</div>
        <p className="text-slate-600 font-semibold">No hay proyectos registrados aún.</p>
        <p className="text-slate-400 text-sm mt-1">Usa &quot;Nuevo Proyecto&quot; para crear el primero.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
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
                  <p className="font-semibold text-slate-800">{p.name}</p>
                  {p.notes && (
                    <p className="text-xs text-slate-400 truncate max-w-[180px]" title={p.notes}>
                      {p.notes}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">{p.company.name}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {formatDate(p.startDate)}
                  <span className="text-slate-400 mx-1">→</span>
                  {formatDate(p.endDate)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.unitRef ?? p.branch?.name ?? (
                    <span className="text-slate-400 italic">Sin asignar</span>
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
                  <button
                    onClick={() => handleEdit(p)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                  >
                    Editar
                  </button>
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
        projectToEdit={editProject}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  )
}
