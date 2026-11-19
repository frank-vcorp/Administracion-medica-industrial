'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateMedicalTest } from '@/actions/medical-profiles'
import type {
  CalibrationStatusKind,
  MedicalTestCalibrationStatus,
} from '@/lib/clinical/calibration-status'

export type CatalogServiceRow = {
  id: string
  code: string
  name: string
  categoryId: string
  theoreticalDurationMinutes: number | null
  category: { name: string }
  _count?: { profiles: number }
  calibration?: MedicalTestCalibrationStatus
}

export type CatalogCategoryOption = {
  id: string
  name: string
}

type DurationFilter = 'all' | 'defined' | 'undefined'

const STATUS_BADGE_CLASSES: Record<CalibrationStatusKind, string> = {
  calibrated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-800 border-amber-200',
  draft_only: 'bg-amber-50 text-amber-800 border-amber-200',
  missing: 'bg-rose-50 text-rose-700 border-rose-200',
  disabled: 'bg-slate-100 text-slate-600 border-slate-200',
  manual_service: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function MedicalServicesCatalogTable({
  tests,
  categories,
  activeCategoryId,
  activeStatusFilter,
}: {
  tests: CatalogServiceRow[]
  categories: CatalogCategoryOption[]
  activeCategoryId?: string
  activeStatusFilter?: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all')
  const [editing, setEditing] = useState<CatalogServiceRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const showCalibrationColumn = tests.some((t) => Boolean(t.calibration))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tests.filter((t) => {
      if (durationFilter === 'defined' && t.theoreticalDurationMinutes == null) return false
      if (durationFilter === 'undefined' && t.theoreticalDurationMinutes != null) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.category.name.toLowerCase().includes(q)
      )
    })
  }, [tests, search, durationFilter])

  const openEdit = (test: CatalogServiceRow) => {
    setEditing(test)
    setEditName(test.name)
    setEditCode(test.code)
    setEditCategoryId(test.categoryId)
    setEditDuration(
      test.theoreticalDurationMinutes != null
        ? String(test.theoreticalDurationMinutes)
        : '',
    )
    setError(null)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setError(null)

    const trimmedDuration = editDuration.trim()
    let parsedDuration: number | null = null
    if (trimmedDuration !== '') {
      const n = Number(trimmedDuration)
      if (!Number.isInteger(n) || n < 0 || n > 480) {
        setError('La duración teórica debe ser un entero entre 0 y 480 minutos.')
        return
      }
      parsedDuration = n
    }

    startTransition(async () => {
      const res = await updateMedicalTest({
        id: editing.id,
        name: editName,
        code: editCode,
        categoryId: editCategoryId,
        theoreticalDurationMinutes: parsedDuration,
      })

      if (!res.success) {
        setError(res.error)
        return
      }

      const count = res.data?.recalculatedProfiles ?? 0
      setFeedback(
        count > 0
          ? `Prueba "${editName.trim()}" actualizada. Se recalculó la duración de ${count} perfil${count === 1 ? '' : 'es'} médico${count === 1 ? '' : 's'}.`
          : `Prueba "${editName.trim()}" actualizada.`,
      )
      setEditing(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 flex items-center justify-between gap-3">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código o nombre (ej. GEN-015, Espirometría, RX)..."
          aria-label="Buscar prueba en catálogo"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <select
          value={durationFilter}
          onChange={(e) => setDurationFilter(e.target.value as DurationFilter)}
          aria-label="Filtrar por duración teórica"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">Todas las duraciones</option>
          <option value="defined">Con duración teórica</option>
          <option value="undefined">Sin definir</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Código</th>
              <th className="px-6 py-4">Prueba</th>
              <th className="px-6 py-4">Categoría</th>
              <th className="px-6 py-4">Duración teórica (min)</th>
              {showCalibrationColumn && (
                <th className="px-6 py-4">Estado de calibración IA</th>
              )}
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((test) => {
              const cal = test.calibration
              const badgeCls = cal ? STATUS_BADGE_CLASSES[cal.kind] : ''
              return (
                <tr key={test.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-400 text-xs">{test.code}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{test.name}</td>
                  <td className="px-6 py-4 text-slate-500">{test.category.name}</td>
                  <td className="px-6 py-4">
                    {test.theoreticalDurationMinutes != null ? (
                      <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700 border border-teal-200">
                        {test.theoreticalDurationMinutes} min
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                        Sin definir
                      </span>
                    )}
                  </td>
                  {showCalibrationColumn && (
                    <td className="px-6 py-4">
                      {cal ? (
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeCls}`}
                          >
                            {cal.label}
                          </span>
                          {cal.kind !== 'manual_service' && (
                            <p className="text-xs text-slate-400">
                              Extracción: {cal.hasExtractionPrompt ? 'sí' : 'no'} · Prediagnóstico:{' '}
                              {cal.hasClinicalPrompt ? 'sí' : 'no'}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/services/${test.id}/calibration`}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                          cal?.needsCalibration
                            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                        }`}
                      >
                        {cal
                          ? cal.needsCalibration
                            ? 'Configurar IA'
                            : 'Editar calibración'
                          : '⚡ Calibrar IA'}
                      </Link>
                      <button
                        type="button"
                        onClick={() => openEdit(test)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={showCalibrationColumn ? 6 : 5}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  {activeCategoryId || activeStatusFilter || search || durationFilter !== 'all'
                    ? 'No hay pruebas que coincidan con el filtro seleccionado.'
                    : 'Aún no hay pruebas registradas en el catálogo.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Editar prueba ${editing.name}`}
        >
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Editar Prueba</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-red-500 font-bold"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nombre de la prueba
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Código interno
                  </label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Categoría
                  </label>
                  <select
                    required
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full border border-slate-200 p-2.5 rounded-lg text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="edit-theoretical-duration"
                    className="block text-xs font-semibold text-slate-600"
                  >
                    Duración teórica (min)
                  </label>
                  {editDuration !== '' && (
                    <button
                      type="button"
                      onClick={() => setEditDuration('')}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-700 underline"
                    >
                      Dejar sin definir
                    </button>
                  )}
                </div>
                <input
                  id="edit-theoretical-duration"
                  type="number"
                  min={0}
                  max={480}
                  step={1}
                  placeholder="Opcional (ej. 15, 30)"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {editing._count?.profiles
                    ? `Usada en ${editing._count.profiles} perfil${editing._count.profiles === 1 ? '' : 'es'}; al guardar se recalculará su duración.`
                    : 'Déjalo vacío si esta prueba no suma tiempo individual en agenda.'}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={pending}
                  className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                >
                  {pending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
