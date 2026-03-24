/**
 * @file MedicalProfilesManager — UI de gestión de Perfiles Médicos
 * @description Client Component para CRUD de MedicalProfile desde /admin/profiles.
 *   Ruta oficial única. Reemplaza la lógica de ServiceProfile/Baterías.
 * @id IMPL-20260324-01
 * @see ARCH-20260324-23 — Unificación lógica de perfiles
 */
'use client'

import { useState, useTransition } from 'react'
import {
  createMedicalProfile,
  updateMedicalProfile,
  deleteMedicalProfile,
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

type MedicalProfileItem = {
  id: string
  name: string
  companyId: string | null
  company: { id: string; name: string } | null
  tests: ProfileTestItem[]
  _count: { tests: number }
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
            <div className="flex flex-wrap gap-1 mb-4 flex-1">
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
          onClose={() => setEditTarget(null)}
          onSubmit={(formData) => handleUpdate(editTarget.id, formData)}
          isPending={isPending}
        />
      )}
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
  onClose,
  onSubmit,
  isPending,
}: {
  title: string
  availableTests: AvailableTest[]
  initialTestIds: string[]
  initialName?: string
  onClose: () => void
  onSubmit: (formData: FormData) => void
  isPending: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialTestIds))

  // Agrupar por categoría para mostrar secciones ordenadas
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    // Serializar IDs seleccionados como JSON (parseTestIds() en el server action lo espera así)
    formData.set('testIds', JSON.stringify(Array.from(selectedIds)))
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
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
            <div className="border border-slate-200 rounded-lg overflow-y-auto flex-1 divide-y divide-slate-100">
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
