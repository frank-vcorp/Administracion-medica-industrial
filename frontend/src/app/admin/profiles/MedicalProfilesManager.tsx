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

import { useMemo, useState, useTransition } from 'react'
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
  // FIX-FRANK-20260731-09: filtros/búsqueda de la tabla de perfiles.
  // Locales (no persistente — Prisma queries no se modifican).
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<'all' | 'global' | string>('all')
  const [emailsFilter, setEmailsFilter] = useState<'all' | 'with' | 'without'>('all')

  // Lista de empresas distintas presentes en profiles (para el dropdown)
  const companyOptions = useMemo(() => {
    const set = new Map<string, string>()
    for (const p of profiles) {
      if (p.company) set.set(p.company.id, p.company.name)
    }
    return Array.from(set, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  }, [profiles])

  // Filtrado memoizado: búsqueda por nombre del perfil o código de prueba,
  // + filtro empresa (incluido 'global' = null), + filtro correos.
  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase()
    return profiles.filter((p) => {
      // Empresa
      if (companyFilter === 'global' && p.company !== null) return false
      if (companyFilter !== 'all' && companyFilter !== 'global') {
        if (!p.company || p.company.id !== companyFilter) return false
      }
      // Correos
      const emailCount = p.reportEmails?.length ?? 0
      if (emailsFilter === 'with' && emailCount === 0) return false
      if (emailsFilter === 'without' && emailCount > 0) return false
      // Búsqueda libre
      if (!q) return true
      if (p.name.toLowerCase().includes(q)) return true
      if (p.tests.some(({ test }) => test.code.toLowerCase().includes(q))) return true
      return false
    })
  }, [profiles, search, companyFilter, emailsFilter])

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

      {/* FIX-FRANK-20260731-09: filtros + búsqueda + tabla densa */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre de perfil o código de prueba (ej. Soldador, GEN-013, Audiometría)…"
            aria-label="Buscar perfiles"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
            🔍
          </span>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-xs font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          )}
        </div>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          aria-label="Filtrar por empresa"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="all">Todas las empresas</option>
          <option value="global">Solo globales</option>
          {companyOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={emailsFilter}
          onChange={(e) => setEmailsFilter(e.target.value as 'all' | 'with' | 'without')}
          aria-label="Filtrar por correos"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        >
          <option value="all">Con o sin correos</option>
          <option value="with">Con correos</option>
          <option value="without">Sin correos</option>
        </select>
        {(search || companyFilter !== 'all' || emailsFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setCompanyFilter('all')
              setEmailsFilter('all')
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-3 w-8">#</th>
                <th className="px-3 py-3 min-w-[180px]">Perfil</th>
                <th className="px-3 py-3 hidden md:table-cell">Empresa</th>
                <th className="px-3 py-3">Pruebas</th>
                <th className="px-3 py-3 hidden lg:table-cell">Correos</th>
                <th className="px-3 py-3 w-12 text-center">Notas</th>
                <th className="px-3 py-3 text-right w-44">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((profile, idx) => {
                const emailCount = profile.reportEmails?.length ?? 0
                const firstEmail = profile.reportEmails?.[0]?.email
                return (
                  <tr
                    key={profile.id}
                    className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-slate-800">{profile.name}</span>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-slate-700">
                      {profile.company ? (
                        profile.company.name
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                          🌐 Global
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-blue-100 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
                          {profile._count.tests} prueba{profile._count.tests !== 1 ? 's' : ''}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {profile.tests.slice(0, 4).map(({ test }) => (
                            <span
                              key={test.id}
                              className="bg-slate-100 text-slate-600 text-[11px] font-mono px-1.5 py-0.5 rounded"
                            >
                              {test.code}
                            </span>
                          ))}
                          {profile.tests.length > 4 && (
                            <span
                              className="text-[11px] text-slate-500"
                              title={profile.tests.slice(4).map((t) => t.test.code).join(', ')}
                            >
                              +{profile.tests.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      {emailCount === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
                            {emailCount}
                          </span>
                          {firstEmail && (
                            <span className="text-xs text-slate-600 truncate max-w-[200px]" title={firstEmail}>
                              {firstEmail}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {profile.specialNotes ? (
                        <span
                          title={profile.specialNotes}
                          className="inline-block w-7 h-7 leading-7 text-center rounded-full bg-purple-100 text-purple-700 text-sm"
                        >
                          📝
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => setEditTarget(profile)}
                          disabled={isPending}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setCloneSource(profile)}
                          disabled={isPending}
                          title="Duplicar este perfil (clona pruebas, correos y notas)"
                          className="rounded-md border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          Duplicar
                        </button>
                        <button
                          onClick={() => handleDelete(profile.id, profile.name)}
                          disabled={isPending}
                          className="rounded-md border border-red-100 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          Mostrando <strong className="text-slate-800">{filteredProfiles.length}</strong> de{' '}
          <strong className="text-slate-800">{profiles.length}</strong>{' '}
          {profiles.length === 1 ? 'perfil' : 'perfiles'}
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-400">
          No hay perfiles médicos registrados. Crea el primero con el botón de arriba.
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500">
          Ningún perfil coincide con los filtros actuales.{' '}
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setCompanyFilter('all')
              setEmailsFilter('all')
            }}
            className="font-semibold text-indigo-600 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}

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
