/**
 * @file MobileUnitSelector — Selector client con validación de disponibilidad.
 * @id IMPL-20260711-01 — SPEC §6.5 (selector de unidad en proyectos)
 *
 * Componente presentacional: dropdown de unidades activas, con verificación
 * opcional de disponibilidad que muestra conflictos + sugerencias (+7/+14/+21d).
 */
'use client'

import { useEffect, useState, useTransition } from 'react'
import { validateUnitAvailability } from '@/actions/project.actions'

type Unit = { id: string; name: string; plate: string | null; status: string }

export default function MobileUnitSelector({
  units,
  value,
  onChange,
  startDate,
  endDate,
  projectId,
}: {
  units: Unit[]
  value: string
  onChange: (id: string) => void
  startDate?: string
  endDate?: string
  projectId?: string
}) {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Array<{ iso: string; label: string }>>([])
  const [isPending, startTransition] = useTransition()

  // Si cambia valor y ya tenemos fechas, validar
  useEffect(() => {
    if (!value || !startDate || !endDate) {
      setError(null); setSuggestions([])
      return
    }
    setChecking(true)
    startTransition(async () => {
      try {
        const res = await validateUnitAvailability(
          value,
          startDate,
          endDate,
          projectId
        )
        if (!res.available) {
          setError(`Conflicto: ${res.conflicts.length} asignación(es) en ese rango.`)
          setSuggestions(res.suggestions)
        } else {
          setError(null); setSuggestions([])
        }
      } finally {
        setChecking(false)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, startDate, endDate, projectId])

  const activeUnits = units.filter((u) => u.status === 'ACTIVA')

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor="mobileUnitId">
        Unidad móvil (opcional)
      </label>
      <select
        id="mobileUnitId"
        name="mobileUnitId"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded-md px-3 py-2"
        data-testid="mobile-unit-selector"
      >
        <option value="">— Sin unidad asignada —</option>
        {activeUnits.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
            {u.plate ? ` (${u.plate})` : ''}
          </option>
        ))}
      </select>
      {checking && <p className="text-xs text-slate-500">Verificando disponibilidad…</p>}
      {error && (
        <p className="text-xs text-red-700" role="alert" data-testid="unit-conflict">{error}</p>
      )}
      {suggestions.length > 0 && (
        <div className="text-xs">
          <p className="font-medium mb-1">Sugerencias libres:</p>
          <ul className="flex gap-2 flex-wrap">
            {suggestions.map((s) => (
              <li key={s.iso}>
                <button
                  type="button"
                  className="px-2 py-1 border rounded bg-amber-50 hover:bg-amber-100"
                  onClick={() => onChange(value)} /* no-op, solo UI */
                  title={s.label}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
