'use client'
/**
 * @file Componente cliente: Puestos de Trabajo por Empresa
 * @description CRUD de JobPosition vinculados a una empresa. Incluye lista, modal de creación
 *              y edición, con select de perfil médico (empresa + globales).
 * @id IMPL-20260313-06
 * @see context/SPECs/ARCH-20260225-06-FASE2-MODULOS.md
 */

import { useState, useTransition } from 'react'
import {
  createJobPosition,
  updateJobPosition,
  deleteJobPosition,
} from '@/actions/job-positions.actions'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

type JobPositionItem = {
  id: string
  name: string
  description: string | null
  companyId: string
  defaultProfileId: string | null
  defaultProfile: { id: string; name: string } | null
  _count: { workers: number }
}

type ProfileOption = {
  id: string
  name: string
  companyId: string | null
}

interface Props {
  companyId: string
  jobPositions: JobPositionItem[]
  profiles: ProfileOption[]
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function JobPositionsPanel({ companyId, jobPositions, profiles }: Props) {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3500)
  }

  return (
    <div className="space-y-4">
      {/* Encabezado sección */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">💼 Puestos de Trabajo</h2>
        <p className="text-sm text-slate-500 mt-1">
          Define los puestos laborales de esta empresa y asígnales un perfil médico por defecto.
        </p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {profiles.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
          ⚠️ No hay perfiles médicos disponibles. Ve a{' '}
          <a href="/admin/medical-profiles" className="font-semibold underline">
            Perfiles Médicos
          </a>{' '}
          para crear uno antes de asociarlo a un puesto.
        </div>
      )}

      <JobPositionsList
        companyId={companyId}
        jobPositions={jobPositions}
        profiles={profiles}
        onFeedback={showFeedback}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN LISTA + MODAL
// ─────────────────────────────────────────────────────────────────────────────

function JobPositionsList({
  companyId,
  jobPositions,
  profiles,
  onFeedback,
}: {
  companyId: string
  jobPositions: JobPositionItem[]
  profiles: ProfileOption[]
  onFeedback: (type: 'success' | 'error', message: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [editTarget, setEditTarget] = useState<JobPositionItem | null>(null)
  const [showModal, setShowModal] = useState(false)

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createJobPosition(formData)
      if (result.success) {
        setShowModal(false)
        onFeedback('success', 'Puesto de trabajo creado exitosamente')
      } else {
        onFeedback('error', result.error)
      }
    })
  }

  const handleUpdate = (formData: FormData) => {
    if (!editTarget) return
    startTransition(async () => {
      const result = await updateJobPosition(formData)
      if (result.success) {
        setEditTarget(null)
        onFeedback('success', 'Puesto de trabajo actualizado exitosamente')
      } else {
        onFeedback('error', result.error)
      }
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`¿Eliminar el puesto "${name}"? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const result = await deleteJobPosition(id)
      if (result.success) {
        onFeedback('success', `Puesto "${name}" eliminado`)
      } else {
        onFeedback('error', result.error)
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Barra de herramientas */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <span className="text-sm text-slate-500 font-medium">
          {jobPositions.length === 0
            ? 'Sin puestos registrados'
            : `${jobPositions.length} puesto${jobPositions.length !== 1 ? 's' : ''} registrado${jobPositions.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={() => setShowModal(true)}
          disabled={isPending}
          className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2"
        >
          <span>+</span> Crear Puesto
        </button>
      </div>

      {/* Tabla */}
      {jobPositions.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-3">💼</p>
          <p className="font-medium">No hay puestos de trabajo registrados</p>
          <p className="text-sm mt-1">Haz clic en "Crear Puesto" para comenzar.</p>
        </div>
      ) : (
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Nombre del Puesto</th>
              <th className="px-6 py-3">Descripción</th>
              <th className="px-6 py-3">Perfil Médico</th>
              <th className="px-6 py-3 text-center">Trabajadores</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobPositions.map((job) => (
              <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{job.name}</td>
                <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                  {job.description ?? '—'}
                </td>
                <td className="px-6 py-4">
                  {job.defaultProfile ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      📦 {job.defaultProfile.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">Sin perfil</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                    {job._count.workers}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditTarget(job)}
                      disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors disabled:opacity-60"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(job.id, job.name)}
                      disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-colors disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal Crear */}
      {showModal && (
        <JobPositionModal
          companyId={companyId}
          profiles={profiles}
          isPending={isPending}
          onSubmit={handleCreate}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Modal Editar */}
      {editTarget && (
        <JobPositionModal
          companyId={companyId}
          profiles={profiles}
          isPending={isPending}
          editTarget={editTarget}
          onSubmit={handleUpdate}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL CREAR / EDITAR
// ─────────────────────────────────────────────────────────────────────────────

function JobPositionModal({
  companyId,
  profiles,
  isPending,
  editTarget,
  onSubmit,
  onClose,
}: {
  companyId: string
  profiles: ProfileOption[]
  isPending: boolean
  editTarget?: JobPositionItem
  onSubmit: (formData: FormData) => void
  onClose: () => void
}) {
  const isEditing = !!editTarget
  const companyProfiles = profiles.filter((p) => p.companyId === companyId)
  const globalProfiles = profiles.filter((p) => p.companyId === null)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Cabecera modal */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">
            {isEditing ? '✏️ Editar Puesto' : '➕ Nuevo Puesto de Trabajo'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 font-bold text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form action={onSubmit} className="p-6 space-y-4">
          {/* Campo oculto: empresa */}
          <input type="hidden" name="companyId" value={companyId} />
          {isEditing && <input type="hidden" name="id" value={editTarget!.id} />}

          {/* Nombre */}
          <div>
            <label
              htmlFor="job-name"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Nombre del Puesto <span className="text-red-500">*</span>
            </label>
            <input
              id="job-name"
              name="name"
              defaultValue={editTarget?.name ?? ''}
              placeholder="Ej: Soldador, Operador de Montacargas"
              required
              maxLength={150}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
          </div>

          {/* Descripción */}
          <div>
            <label
              htmlFor="job-description"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Descripción
            </label>
            <textarea
              id="job-description"
              name="description"
              defaultValue={editTarget?.description ?? ''}
              placeholder="Descripción opcional del puesto..."
              rows={3}
              maxLength={500}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none"
            />
          </div>

          {/* Perfil Médico */}
          <div>
            <label
              htmlFor="job-profile"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Perfil Médico por Defecto
            </label>
            <select
              id="job-profile"
              name="defaultProfileId"
              defaultValue={editTarget?.defaultProfileId ?? ''}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white"
            >
              <option value="">— Sin perfil asignado —</option>

              {companyProfiles.length > 0 && (
                <optgroup label="Perfiles de esta empresa">
                  {companyProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}

              {globalProfiles.length > 0 && (
                <optgroup label="Perfiles globales">
                  {globalProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Se usará como sugerencia al registrar un nuevo trabajador en este puesto.
            </p>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow"
            >
              {isPending ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Puesto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
