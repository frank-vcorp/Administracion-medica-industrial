/**
 * @file MobileUnitCreateModal — Modal de creación de unidad móvil.
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md §5.2
 *
 * Paridad con BranchCreateModal:
 *   - Backdrop fixed inset-0 bg-black/50 backdrop-blur-sm z-50
 *   - Content bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl
 *   - Header con título + botón cerrar ✕
 *   - Inputs con focus:ring-purple-500 (color primario de marca)
 *   - Submit bg-purple-600 hover:bg-purple-700
 *
 * El upload de imagen queda fuera del modal (lo hace el form de edición
 * /[id]/edit para más espacio). El modal crea solo los datos básicos;
 * tras crear, redirige a /[id]/edit para completar imagen.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createMobileUnit } from '@/actions/mobile-unit.actions'
import { MOBILE_UNIT_STATUS_OPTIONS } from './constants'

// Filtramos el item "Todos" porque no aplica en un select simple de formulario.
const FORM_STATUS_OPTIONS = MOBILE_UNIT_STATUS_OPTIONS.filter((o) => o.value !== '')

export function MobileUnitCreateModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSubmit = async (formData: FormData) => {
    setError(null)
    const raw = {
      name: String(formData.get('name') || '').trim(),
      plate: (formData.get('plate') as string) || undefined,
      vin: (formData.get('vin') as string) || undefined,
      year: formData.get('year') ? Number(formData.get('year')) : undefined,
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : undefined,
      economicNumber: (formData.get('economicNumber') as string) || undefined,
      status: (formData.get('status') as string) || 'ACTIVA',
    }

    if (!raw.name) {
      setError('El nombre es obligatorio')
      return
    }

    startTransition(async () => {
      const result = await createMobileUnit(raw as Parameters<typeof createMobileUnit>[0])
      if (!result.success) {
        setError(result.error ?? 'Error al crear')
        return
      }
      setOpen(false)
      // Redirige al detalle para que el usuario suba imagen y complete
      // equipamiento desde la página de edición (más espacio).
      router.push(`/admin/mobile-units/${result.unit.id}`)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2"
        data-testid="new-unit-button"
      >
        <span>+</span> Nueva Unidad
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar Unidad Móvil"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Registrar Unidad Móvil</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="text-slate-400 hover:text-red-500 font-bold"
          >
            ✕
          </button>
        </div>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="bg-red-50 text-red-700 p-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500 mb-1 block" htmlFor="name">Nombre *</label>
            <input
              id="name"
              name="name"
              placeholder="Ej. Unidad Móvil Norte"
              required
              className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              data-testid="name-input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block" htmlFor="plate">Placa</label>
              <input
                id="plate"
                name="plate"
                placeholder="ABC-123"
                className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid="plate-input"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block" htmlFor="vin">VIN</label>
              <input
                id="vin"
                name="vin"
                placeholder="Número de identificación vehicular"
                className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block" htmlFor="year">Año</label>
              <input
                id="year"
                name="year"
                type="number"
                placeholder="2020"
                min="1900"
                max="2100"
                className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block" htmlFor="capacity">Capacidad (pacientes/día)</label>
              <input
                id="capacity"
                name="capacity"
                type="number"
                placeholder="50"
                min="1"
                max="500"
                className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block" htmlFor="economicNumber">Número económico</label>
              <input
                id="economicNumber"
                name="economicNumber"
                placeholder="UM-001"
                className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block" htmlFor="status">Estado</label>
            <select
              id="status"
              name="status"
              defaultValue="ACTIVA"
              className="w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {FORM_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded border"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 font-medium disabled:opacity-50"
              data-testid="save-button"
            >
              {pending ? 'Guardando…' : 'Crear unidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}