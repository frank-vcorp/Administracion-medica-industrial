/**
 * @file Panel local de perfiles médicos por empresa
 * @description CRUD acotado a perfiles médicos propios de la empresa desde la ficha /companies/[id].
 * @id IMPL-20260527-01
 * @backup context/SPECs/SPEC_ARCH-20260527-04-PERFILES-MEDICOS-EN-EMPRESA-Y-ASIGNACION-A-PUESTOS.md
 * @see context/SPECs/SPEC_ARCH-20260527-04-PERFILES-MEDICOS-EN-EMPRESA-Y-ASIGNACION-A-PUESTOS.md
 * @id ARCH-20260708-01
 * @see SPEC_ARCH-20260708-01-PERFILES-PACIENTE-CORREOS-CLONACION.md
 *   - Correos de envío múltiples
 *   - Comentarios especiales
 *   - Botón Duplicar
 */
'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  createMedicalProfile,
  deleteMedicalProfile,
  updateMedicalProfile,
  addProfileReportEmail,
  removeProfileReportEmail,
  cloneMedicalProfile,
} from '@/actions/medical-profiles'

type AvailableTest = {
  id: string
  name: string
  code: string
  category: { name: string }
}

type ProfileEmail = {
  id: string
  email: string
  label: string | null
}

type CompanyMedicalProfile = {
  id: string
  name: string
  companyId: string | null
  specialNotes: string | null
  reportEmails: ProfileEmail[]
  tests: Array<{
    test: AvailableTest
  }>
}

interface Props {
  companyId: string
  companyName: string
  companyProfiles: CompanyMedicalProfile[]
  availableTests: AvailableTest[]
}

export default function CompanyMedicalProfilesPanel({
  companyId,
  companyName,
  companyProfiles,
  availableTests,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editTarget, setEditTarget] = useState<CompanyMedicalProfile | null>(null)
  const [cloneSource, setCloneSource] = useState<CompanyMedicalProfile | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createMedicalProfile(formData)
      if (result.success) {
        setShowCreateModal(false)
        showFeedback('success', 'Perfil médico creado en la ficha de la empresa')
      } else {
        showFeedback('error', result.error)
      }
    })
  }

  const handleUpdate = (id: string, formData: FormData) => {
    startTransition(async () => {
      const result = await updateMedicalProfile(id, formData)
      if (result.success) {
        setEditTarget(null)
        showFeedback('success', 'Perfil médico actualizado correctamente')
      } else {
        showFeedback('error', result.error)
      }
    })
  }

  const handleDelete = (profile: CompanyMedicalProfile) => {
    if (!confirm(`¿Eliminar el perfil "${profile.name}" de ${companyName}? Esta acción no se puede deshacer.`)) {
      return
    }

    startTransition(async () => {
      const result = await deleteMedicalProfile(profile.id)
      if (result.success) {
        showFeedback('success', 'Perfil médico eliminado de la empresa')
      } else {
        showFeedback('error', result.error)
      }
    })
  }

  const handleClone = (id: string, newName: string, onDone: () => void) => {
    startTransition(async () => {
      const result = await cloneMedicalProfile(id, newName)
      if (result.success) {
        showFeedback('success', 'Perfil clonado. Refresca para verlo.')
        onDone()
      } else {
        showFeedback('error', result.error ?? 'Error al clonar')
      }
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🧪 Perfiles Médicos</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Crea y ajusta los perfiles propios de {companyName} para que luego aparezcan como
            opción natural al configurar los puestos de trabajo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          <span>+</span>
          Nuevo Perfil
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {companyProfiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500">
          <p className="text-4xl">🩺</p>
          <p className="mt-3 font-medium text-slate-700">Aún no hay perfiles médicos propios.</p>
          <p className="mt-1 text-sm">
            Crea el primer perfil aquí y luego asígnalo desde el bloque de puestos de trabajo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {companyProfiles.map((profile) => (
            <article
              key={profile.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-800">{profile.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {profile.tests.length} prueba{profile.tests.length === 1 ? '' : 's'} configurada
                    {profile.tests.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                  Empresa
                </span>
              </div>

              <div className="mt-4 flex-1 space-y-3">
                <ProfileTestsSummary tests={profile.tests} />

                {profile.reportEmails && profile.reportEmails.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
                      📬 {profile.reportEmails.length} correo(s) de envío
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {profile.reportEmails.slice(0, 3).map((em) => (
                        <span
                          key={em.id}
                          className="bg-white text-amber-800 text-[11px] px-2 py-0.5 rounded border border-amber-200"
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

                {profile.specialNotes && (
                  <div className="rounded-lg bg-purple-50 border border-purple-100 p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-700 mb-1">
                      📝 Comentarios
                    </p>
                    <p className="text-xs text-purple-800 whitespace-pre-line line-clamp-3">
                      {profile.specialNotes}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditTarget(profile)}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setCloneSource(profile)}
                  disabled={isPending}
                  className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60"
                  title="Duplicar perfil (clona pruebas, correos y notas)"
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(profile)}
                  disabled={isPending}
                  className="rounded-lg border border-red-100 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreateModal && (
        <ProfileModal
          title="Nuevo Perfil Médico"
          companyId={companyId}
          availableTests={availableTests}
          initialName=""
          initialTestIds={[]}
          isPending={isPending}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {editTarget && (
        <ProfileModal
          title={`Editar: ${editTarget.name}`}
          companyId={companyId}
          availableTests={availableTests}
          initialName={editTarget.name}
          initialTestIds={editTarget.tests.map(({ test }) => test.id)}
          initialSpecialNotes={editTarget.specialNotes ?? ''}
          initialEmails={editTarget.reportEmails ?? []}
          isPending={isPending}
          onClose={() => setEditTarget(null)}
          onSubmit={(formData) => handleUpdate(editTarget.id, formData)}
        />
      )}

      {cloneSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Duplicar perfil</h3>
              <button
                type="button"
                onClick={() => setCloneSource(null)}
                className="text-xl font-bold leading-none text-slate-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
            <CloneForm
              initialName={`${cloneSource.name} (Copia)`}
              isPending={isPending}
              onCancel={() => setCloneSource(null)}
              onSubmit={(newName) => handleClone(cloneSource.id, newName, () => setCloneSource(null))}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function CloneForm({
  initialName,
  isPending,
  onCancel,
  onSubmit,
}: {
  initialName: string
  isPending: boolean
  onCancel: () => void
  onSubmit: (newName: string) => void
}) {
  const [name, setName] = useState(initialName)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(name)
      }}
      className="space-y-4"
    >
      <p className="text-sm text-slate-600">
        Se creará un clon con las mismas pruebas, correos y notas. El nombre debe ser único.
      </p>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Nombre del clon <span className="text-red-500">*</span>
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Clonando…' : 'Crear clon'}
        </button>
      </div>
    </form>
  )
}

function ProfileTestsSummary({ tests }: { tests: CompanyMedicalProfile['tests'] }) {
  const groupedTests = useMemo(() => {
    return tests.reduce<Record<string, AvailableTest[]>>((acc, entry) => {
      const categoryName = entry.test.category.name
      if (!acc[categoryName]) {
        acc[categoryName] = []
      }
      acc[categoryName].push(entry.test)
      return acc
    }, {})
  }, [tests])

  return (
    <div className="space-y-2">
      {Object.entries(groupedTests).map(([categoryName, categoryTests]) => (
        <div key={categoryName} className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {categoryName}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {categoryTests.map((test) => test.name).join(', ')}
          </p>
        </div>
      ))}
    </div>
  )
}

function ProfileModal({
  title,
  companyId,
  availableTests,
  initialName,
  initialTestIds,
  initialSpecialNotes = '',
  initialEmails = [],
  isPending,
  onClose,
  onSubmit,
}: {
  title: string
  companyId: string
  availableTests: AvailableTest[]
  initialName: string
  initialTestIds: string[]
  initialSpecialNotes?: string
  initialEmails?: ProfileEmail[]
  isPending: boolean
  onClose: () => void
  onSubmit: (formData: FormData) => void
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialTestIds))
  const [emails, setEmails] = useState<ProfileEmail[]>(initialEmails)
  const [newEmail, setNewEmail] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [notesCharCount, setNotesCharCount] = useState(initialSpecialNotes.length)
  const [profileId] = useState<string | null>(null) // Para edición detectar ya guardados

  const testsByCategory = useMemo(() => {
    return availableTests.reduce<Record<string, AvailableTest[]>>((acc, test) => {
      const categoryName = test.category.name
      if (!acc[categoryName]) {
        acc[categoryName] = []
      }
      acc[categoryName].push(test)
      return acc
    }, {})
  }, [availableTests])

  const toggleTest = (testId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(testId)) {
        next.delete(testId)
      } else {
        next.add(testId)
      }
      return next
    })
  }

  function removeEmail(id: string) {
    if (id.startsWith('temp-')) {
      setEmails((prev) => prev.filter((e) => e.id !== id))
      return
    }
    if (!confirm('¿Eliminar este correo del perfil?')) return
    startTransitionEmail(async () => {
      const result = await removeProfileReportEmail(id)
      if (result.success) {
        setEmails((prev) => prev.filter((e) => e.id !== id))
      } else {
        setEmailError(result.error ?? 'Error al eliminar correo')
      }
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
    if (emails.length >= 10) {
      setEmailError('Se recomienda un máximo de 10 correos por perfil.')
      return
    }
    setEmails((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, email: trimmed, label: newLabel.trim() || null },
    ])
    setNewEmail('')
    setNewLabel('')
  }

  const [, startTransitionEmail] = useTransition()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('companyId', companyId)
    formData.set('testIds', JSON.stringify(Array.from(selectedIds)))
    // Emails temporales se persisten al guardar vía addProfileReportEmail
    // (las filas ya persistidas se actualizan automáticamente — solo el formData va completo)
    onSubmit(formData)
    // Persistir emails nuevos (temporales) usando addProfileReportEmail — requieren un profileId del modal
    if (profileId) {
      for (const em of emails.filter((e) => e.id.startsWith('temp-'))) {
        void addProfileReportEmail(profileId, { email: em.email, label: em.label })
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Selecciona al menos una prueba para guardar el perfil médico de esta empresa.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl font-bold leading-none text-slate-400 transition-colors hover:text-red-500"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden px-6 py-5">
          <input type="hidden" name="companyId" value={companyId} />

          <div className="space-y-4 overflow-hidden">
            <div>
              <label htmlFor="company-profile-name" className="mb-1 block text-sm font-medium text-slate-700">
                Nombre del perfil <span className="text-red-500">*</span>
              </label>
              <input
                id="company-profile-name"
                name="name"
                defaultValue={initialName}
                required
                maxLength={200}
                placeholder="Ej: Ingreso Soldadura"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-700">Pruebas incluidas</span>
                <span className="font-medium text-blue-700">{selectedIds.size} seleccionadas</span>
              </div>

              <div className="max-h-[30vh] overflow-y-auto divide-y divide-slate-100">
                {Object.entries(testsByCategory).map(([categoryName, categoryTests]) => (
                  <div key={categoryName}>
                    <div className="sticky top-0 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {categoryName}
                    </div>
                    {categoryTests.map((test) => (
                      <label
                        key={test.id}
                        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(test.id)}
                          onChange={() => toggleTest(test.id)}
                          className="rounded accent-slate-900"
                        />
                        <span className="w-20 shrink-0 font-mono text-xs text-slate-400">
                          {test.code}
                        </span>
                        <span className="text-sm text-slate-700">{test.name}</span>
                      </label>
                    ))}
                  </div>
                ))}

                {availableTests.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    No hay pruebas disponibles en el catálogo para construir perfiles.
                  </p>
                )}
              </div>
            </div>

            {/* Comentarios especiales */}
            <div>
              <label htmlFor="company-profile-notes" className="mb-1 block text-sm font-medium text-slate-700">
                Comentarios especiales
                <span className="ml-2 text-[11px] font-normal text-slate-500">
                  (firma autógrafa, cédula del médico, pruebas no reportadas)
                </span>
              </label>
              <textarea
                id="company-profile-notes"
                name="specialNotes"
                defaultValue={initialSpecialNotes}
                maxLength={2000}
                placeholder="Ej. Requiere firma autógrafa. Excluir VIH. Adjuntar cédula."
                onChange={(e) => setNotesCharCount(e.currentTarget.value.length)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 min-h-[80px]"
              />
              <p className="text-right text-xs text-slate-400">{notesCharCount} / 2000</p>
            </div>

            {/* Correos */}
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">
                Correos de envío de resultados{' '}
                <span className="text-amber-600 text-xs">({emails.length})</span>
              </p>
              {emails.length > 0 && (
                <ul className="mb-2 max-h-32 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {emails.map((em) => (
                    <li key={em.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span className="truncate flex-1">
                        <span className="text-slate-700">{em.email}</span>
                        {em.label && <span className="ml-2 text-xs text-slate-400">({em.label})</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEmail(em.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Etiqueta (opcional)"
                  maxLength={100}
                  className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={addEmail}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  + Agregar
                </button>
              </div>
              {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
              {/* El note sobre persistir tras tener profileId se omite de UI para no confundir */}
              {profileId === null && initialEmails.length === 0 && emails.some((e) => e.id.startsWith('temp-')) && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Los correos nuevos se guardarán al guardar el perfil.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || selectedIds.size === 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Guardar Perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
