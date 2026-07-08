/**
 * @file MedicalProfilesManager — UI de gestión de Perfiles Médicos
 * @description Client Component para CRUD de MedicalProfile desde /admin/profiles.
 *   Ruta oficial única. Reemplaza la lógica de ServiceProfile/Baterías.
 * @id IMPL-20260324-01
 * @see ARCH-20260324-23 — Unificación lógica de perfiles
 * @id ARCH-20260708-01
 * @see SPEC_ARCH-20260708-01-PERFILES-PACIENTE-CORREOS-CLONACION.md
 *   - Correos de envío múltiples
 *   - Comentarios especiales (specialNotes)
 *   - Clonación de perfiles
 */
'use client'

import { useState, useTransition } from 'react'
import {
  createMedicalProfile,
  updateMedicalProfile,
  deleteMedicalProfile,
  removeProfileReportEmail,
  cloneMedicalProfile,
} from '@/actions/medical-profiles'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS LOCALES
// ─────────────────────────────────────────────────────────────────────────────

type AvailableTest = {
  id: string
  name: string
  code: string
  category: { name: string }
}

type ProfileTestItem = {
  test: AvailableTest
}

type ProfileEmail = {
  id: string
  email: string
  label: string | null
}

type MedicalProfileItem = {
  id: string
  name: string
  companyId: string | null
  company: { id: string; name: string } | null
  tests: ProfileTestItem[]
  _count: { tests: number }
  reportEmails?: ProfileEmail[]
  specialNotes?: string | null
}

interface Props {
  profiles: MedicalProfileItem[]
  availableTests: AvailableTest[]
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function MedicalProfilesManager({ profiles, availableTests }: Props) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editTarget, setEditTarget] = useState<MedicalProfileItem | null>(null)
  const [cloneSource, setCloneSource] = useState<MedicalProfileItem | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4500)
  }

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createMedicalProfile(formData)
      if (result.success) {
        showFeedback('success', 'Perfil médico creado exitosamente')
        setShowCreateModal(false)
      } else {
        showFeedback('error', result.error ?? 'Error al crear perfil')
      }
    })
  }

  const handleUpdate = (id: string, formData: FormData) => {
    startTransition(async () => {
      const result = await updateMedicalProfile(id, formData)
      if (result.success) {
        showFeedback('success', 'Perfil médico actualizado correctamente')
        setEditTarget(null)
      } else {
        showFeedback('error', result.error ?? 'Error al actualizar perfil')
      }
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`¿Eliminar el perfil "${name}"? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const result = await deleteMedicalProfile(id)
      if (result.success) {
        showFeedback('success', 'Perfil médico eliminado')
      } else {
        showFeedback('error', result.error ?? 'Error al eliminar perfil')
      }
    })
  }

  const handleCloned = () => {
    showFeedback('success', 'Perfil clonado correctamente. Refresca la lista.')
    setCloneSource(null)
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Perfiles Médicos</h2>
          <p className="text-sm text-slate-500 mt-1">
            Combinaciones de pruebas clínicas para puestos de trabajo y citas empresariales.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={isPending}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2 shrink-0"
        >
          <span>+</span> Nuevo Perfil
        </button>
      </div>

      {/* Banner de retroalimentación */}
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

      {/* Grilla de perfiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-slate-800 text-lg leading-tight">{profile.name}</h3>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full shrink-0 ml-2">
                {profile._count.tests} Prueba{profile._count.tests !== 1 ? 's' : ''}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              {profile.company
                ? `Empresa: ${profile.company.name}`
                : 'Global — todas las empresas'}
            </p>

            {/* Preview de códigos de prueba */}
            <div className="flex flex-wrap gap-1 mb-3 flex-1">
              {profile.tests.slice(0, 6).map(({ test }) => (
                <span
                  key={test.id}
                  className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-mono"
                >
                  {test.code}
                </span>
              ))}
              {profile.tests.length > 6 && (
                <span className="bg-slate-100 text-slate-400 text-xs px-2 py-0.5 rounded-full">
                  +{profile.tests.length - 6} más
                </span>
              )}
            </div>

            {/* Correos configurados */}
            {profile.reportEmails && profile.reportEmails.length > 0 && (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-100 p-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
                  📬 {profile.reportEmails.length} correo{profile.reportEmails.length !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1">
                  {profile.reportEmails.slice(0, 3).map((em) => (
                    <span
                      key={em.id}
                      title={em.email}
                      className="bg-white text-amber-800 text-[11px] px-2 py-0.5 rounded border border-amber-200 truncate max-w-full"
                    >
                      {em.email}
                    </span>
                  ))}
                  {profile.reportEmails.length > 3 && (
                    <span className="text-[11px] text-amber-700">+{profile.reportEmails.length - 3} más</span>
                  )}
                </div>
              </div>
            )}

            {/* Comentarios especiales */}
            {profile.specialNotes && (
              <div className="mb-3 rounded-lg bg-purple-50 border border-purple-100 p-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-700 mb-1">
                  📝 Comentarios
                </p>
                <p className="text-xs text-purple-800 line-clamp-3 whitespace-pre-line">
                  {profile.specialNotes}
                </p>
              </div>
            )}

            {/* Acciones */}
            <div className="pt-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setEditTarget(profile)}
                disabled={isPending}
                className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-600 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => setCloneSource(profile)}
                disabled={isPending}
                className="border border-blue-200 hover:bg-blue-50 text-blue-600 hover:text-blue-700 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
                title="Duplicar este perfil (clona pruebas, correos y notas)"
              >
                Duplicar
              </button>
              <button
                onClick={() => handleDelete(profile.id, profile.name)}
                disabled={isPending}
                className="border border-red-100 hover:bg-red-50 text-red-400 hover:text-red-600 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {profiles.length === 0 && (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-400">
          No hay perfiles médicos registrados. Crea el primero con el botón de arriba.
        </div>
      )}

      {/* Modal Crear */}
      {showCreateModal && (
        <ProfileModal
          title="Nuevo Perfil Médico"
          availableTests={availableTests}
          initialTestIds={[]}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          isPending={isPending}
        />
      )}

      {/* Modal Editar */}
      {editTarget && (
        <ProfileModal
          title={`Editar: ${editTarget.name}`}
          availableTests={availableTests}
          initialTestIds={editTarget.tests.map(({ test }) => test.id)}
          initialName={editTarget.name}
          initialSpecialNotes={editTarget.specialNotes ?? ''}
          initialEmails={editTarget.reportEmails ?? []}
          onClose={() => setEditTarget(null)}
          onSubmit={(formData) => handleUpdate(editTarget.id, formData)}
          isPending={isPending}
        />
      )}

      {/* Modal Clonar (SPEC ARCH-20260708-01) */}
      {cloneSource && (
        <CloneProfileModal
          sourceName={cloneSource.name}
          sourceId={cloneSource.id}
          onCancel={() => setCloneSource(null)}
          onCreated={handleCloned}
          onError={(msg) => showFeedback('error', msg)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL CLONAR
// ─────────────────────────────────────────────────────────────────────────────

function CloneProfileModal({
  sourceName,
  sourceId,
  onCancel,
  onCreated,
  onError,
}: {
  sourceName: string
  sourceId: string
  onCancel: () => void
  onCreated: () => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState(`${sourceName} (Copia)`)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await cloneMedicalProfile(sourceId, name)
      if (!result.success) {
        const msg = result.error ?? 'Error al clonar'
        setError(msg)
        onError(msg)
      } else {
        onCreated()
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Duplicar perfil</h3>
          <button
            onClick={onCancel}
            type="button"
            className="text-slate-400 hover:text-red-500 font-bold text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-600">
            Se creará una copia del perfil <strong>{sourceName}</strong> con sus
            pruebas, correos de envío y comentarios especiales. El nombre debe ser único.
          </p>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Nombre del clon <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
            >
              {isPending ? 'Clonando…' : 'Crear clon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL CREAR / EDITAR
// ─────────────────────────────────────────────────────────────────────────────

function ProfileModal({
  title,
  availableTests,
  initialTestIds,
  initialName = '',
  initialSpecialNotes = '',
  initialEmails = [],
  onClose,
  onSubmit,
  isPending,
  readOnlyEmails = false,
}: {
  title: string
  availableTests: AvailableTest[]
  initialTestIds: string[]
  initialName?: string
  initialSpecialNotes?: string
  initialEmails?: ProfileEmail[]
  onClose: () => void
  onSubmit: (formData: FormData) => void
  isPending: boolean
  readOnlyEmails?: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialTestIds))
  const [emails, setEmails] = useState<ProfileEmail[]>(initialEmails)
  const [newEmail, setNewEmail] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [notesCharCount, setNotesCharCount] = useState(initialSpecialNotes.length)
  const [, startTransitionInner] = useTransition()

  const byCategory = availableTests.reduce<Record<string, AvailableTest[]>>((acc, test) => {
    const cat = test.category.name
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(test)
    return acc
  }, {})

  const toggleTest = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addEmail() {
    setEmailError(null)
    const trimmed = newEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Formato de correo inválido')
      return
    }
    if (emails.some((e) => e.email === trimmed)) {
      setEmailError('Este correo ya está configurado')
      return
    }
    // Sin límite duro en BD; UI sugiere hasta 10 como máximo razonable.
    if (emails.length >= 10) {
      setEmailError('Se recomienda un máximo de 10 correos por perfil.')
      return
    }
    // El id se asignará al guardar (server genera uuid). Para UI optimista usamos id temporal.
    setEmails((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, email: trimmed, label: newLabel.trim() || null },
    ])
    setNewEmail('')
    setNewLabel('')
  }

  function removeEmail(id: string) {
    if (id.startsWith('temp-')) {
      // Aún no persistido: solo remover del estado local
      setEmails((prev) => prev.filter((e) => e.id !== id))
      return
    }
    if (!confirm('¿Eliminar este correo del perfil?')) return
    startTransitionInner(async () => {
      const result = await removeProfileReportEmail(id)
      if (result.success) {
        setEmails((prev) => prev.filter((e) => e.id !== id))
      } else {
        setEmailError(result.error ?? 'Error al eliminar correo')
      }
    })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    // Serializar IDs seleccionados como JSON (parseTestIds() en el server action lo espera así)
    formData.set('testIds', JSON.stringify(Array.from(selectedIds)))
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Encabezado modal */}
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-red-500 font-bold text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-hidden">
          {/* Nombre del perfil */}
          <input
            name="name"
            placeholder="Nombre del perfil (ej. Ingreso Operativo)"
            defaultValue={initialName}
            required
            className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {/* Selección de pruebas */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <p className="text-sm font-semibold text-slate-700 mb-2 shrink-0">
              Pruebas incluidas{' '}
              <span className="text-blue-600 font-bold">({selectedIds.size} seleccionadas)</span>
            </p>
            <div className="border border-slate-200 rounded-lg overflow-y-auto flex-1 divide-y divide-slate-100 max-h-40">
              {Object.entries(byCategory).map(([category, tests]) => (
                <div key={category}>
                  <div className="px-3 py-1.5 bg-slate-50 text-xs uppercase text-slate-400 font-semibold sticky top-0">
                    {category}
                  </div>
                  {tests.map((test) => (
                    <label
                      key={test.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(test.id)}
                        onChange={() => toggleTest(test.id)}
                        className="rounded accent-blue-600"
                      />
                      <span className="font-mono text-xs text-slate-400 w-16 shrink-0">
                        {test.code}
                      </span>
                      <span className="text-sm text-slate-700">{test.name}</span>
                    </label>
                  ))}
                </div>
              ))}
              {availableTests.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-6">
                  No hay pruebas en el catálogo. Agrega pruebas médicas antes de crear perfiles.
                </p>
              )}
            </div>
          </div>

          {/* Comentarios especiales */}
          <div>
            <label htmlFor="special-notes" className="block text-sm font-semibold text-slate-700 mb-1">
              Comentarios especiales
              <span className="text-[11px] font-normal text-slate-500 ml-2">
                (firma autógrafa, cédula del médico, pruebas no reportadas, formatos especiales)
              </span>
            </label>
            <textarea
              id="special-notes"
              name="specialNotes"
              defaultValue={initialSpecialNotes}
              maxLength={2000}
              placeholder="Ej. Requiere firma autógrafa. Excluir VIH. Adjuntar cédula."
              onChange={(e) => setNotesCharCount(e.currentTarget.value.length)}
              className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[80px]"
            />
            <p className="text-xs text-slate-400 text-right">{notesCharCount} / 2000 caracteres</p>
          </div>

          {/* Correos de envío */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              Correos de envío de resultados{' '}
              <span className="text-amber-600 text-xs">({emails.length} configurados)</span>
            </p>
            {emails.length > 0 && (
              <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 mb-2 max-h-32 overflow-y-auto">
                {emails.map((em) => (
                  <li key={em.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="truncate flex-1">
                      <span className="text-slate-700">{em.email}</span>
                      {em.label && <span className="text-xs text-slate-400 ml-2">({em.label})</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEmail(em.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                      disabled={readOnlyEmails}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!readOnlyEmails && (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  className="flex-1 border border-slate-200 p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Etiqueta (opcional)"
                  maxLength={100}
                  className="w-40 border border-slate-200 p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={addEmail}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-semibold"
                >
                  + Agregar
                </button>
              </div>
            )}
            {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || selectedIds.size === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 font-medium text-sm disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Guardando…' : 'Guardar Perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
