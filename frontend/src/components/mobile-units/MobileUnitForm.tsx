/**
 * @file MobileUnitForm — Formulario de edición de unidad + upload de imagen.
 * @id IMPL-20260711-01
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 *
 * Migrado a tokens del sistema:
 *   - Inputs w-full border border-slate-300 p-2 rounded text-sm focus:ring-purple-500
 *   - Labels text-xs text-slate-500 mb-1 block
 *   - Submit bg-purple-600 hover:bg-purple-700 rounded shadow
 *
 * Usado en /admin/mobile-units/[id]/edit. La creación ahora es via modal
 * (MobileUnitCreateModal) → tras crear, redirige a /[id]/edit para completar
 * imagen + equipamiento.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  updateMobileUnit,
  uploadMobileUnitImage,
  deleteMobileUnitImage,
} from '@/actions/mobile-unit.actions'
import { MOBILE_UNIT_STATUS_OPTIONS } from './constants'

const FORM_STATUS_OPTIONS = MOBILE_UNIT_STATUS_OPTIONS.filter((o) => o.value !== '')

const EQUIPMENT_KEYS: Array<{ key: string; label: string }> = [
  { key: 'audiometro', label: 'Audiómetro' },
  { key: 'espirometro', label: 'Espirómetro' },
  { key: 'rayos_x', label: 'Rayos X' },
  { key: 'ecg', label: 'ECG' },
  { key: 'visiotest', label: 'Visiotest' },
  { key: 'oftalmoscopio', label: 'Oftalmoscopio' },
  { key: 'toma_muestras', label: 'Toma de muestras' },
]

type ExistingUnit = {
  id: string
  name: string
  plate: string | null
  vin: string | null
  year: number | null
  capacity: number | null
  economicNumber: string | null
  status: string
  equipment: Record<string, boolean> | null
  notes: string | null
  imageUrl: string | null
}

export default function MobileUnitForm({ existing }: { existing: ExistingUnit }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(existing.imageUrl)
  const [equipment, setEquipment] = useState<Record<string, boolean>>(
    (existing.equipment as Record<string, boolean>) ?? {}
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    if (file) setImagePreview(URL.createObjectURL(file))
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const form = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {
      name: String(form.get('name') || '').trim(),
      plate: form.get('plate') ? String(form.get('plate')) : null,
      vin: form.get('vin') ? String(form.get('vin')) : null,
      year: form.get('year') ? Number(form.get('year')) : null,
      capacity: form.get('capacity') ? Number(form.get('capacity')) : null,
      economicNumber: form.get('economicNumber') ? String(form.get('economicNumber')) : null,
      status: String(form.get('status') || 'ACTIVA'),
      notes: form.get('notes') ? String(form.get('notes')) : null,
      equipment,
    }

    startTransition(async () => {
      const res = await updateMobileUnit(existing.id, data as Parameters<typeof updateMobileUnit>[1])
      if (!res.success) {
        setError(res.error ?? 'Error al guardar')
        return
      }

      // Subir imagen si hay nueva
      if (imageFile) {
        const upRes = await uploadMobileUnitImage(existing.id, imageFile)
        if (!upRes.success) {
          setError(`Datos guardados, pero la imagen falló: ${upRes.error}`)
          return
        }
      }

      setSuccess(true)
      router.refresh()
    })
  }

  const onRemoveImage = async () => {
    setError(null)
    const res = await deleteMobileUnitImage(existing.id)
    if (!res.success) {
      setError(res.error ?? 'Error')
      return
    }
    setImagePreview(null)
    setImageFile(null)
    router.refresh()
  }

  const inputCls =
    'w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
  const labelCls = 'text-xs text-slate-500 mb-1 block'

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 text-emerald-700 p-3 rounded text-sm">
          Cambios guardados correctamente.
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-slate-700">Datos básicos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="name">Nombre *</label>
            <input
              id="name"
              name="name"
              defaultValue={existing.name}
              required
              className={inputCls}
              data-testid="name-input"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="plate">Placa</label>
            <input
              id="plate"
              name="plate"
              defaultValue={existing.plate ?? ''}
              className={inputCls}
              data-testid="plate-input"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="vin">VIN</label>
            <input id="vin" name="vin" defaultValue={existing.vin ?? ''} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="year">Año</label>
            <input
              id="year"
              name="year"
              type="number"
              defaultValue={existing.year ?? ''}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="capacity">Capacidad (pacientes/día)</label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              defaultValue={existing.capacity ?? ''}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="economicNumber">Número económico</label>
            <input
              id="economicNumber"
              name="economicNumber"
              defaultValue={existing.economicNumber ?? ''}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="status">Estado</label>
            <select
              id="status"
              name="status"
              defaultValue={existing.status}
              className={inputCls}
              data-testid="status-input"
            >
              {FORM_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-700">Equipamiento</h2>
        <div className="bg-white p-4 rounded-lg border border-slate-200 grid grid-cols-2 md:grid-cols-3 gap-2">
          {EQUIPMENT_KEYS.map((eq) => (
            <label key={eq.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(equipment[eq.key])}
                onChange={(e) =>
                  setEquipment((prev) => ({ ...prev, [eq.key]: e.target.checked }))
                }
                data-testid={`equipment-${eq.key}`}
              />
              {eq.label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-700">Notas</h2>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={existing.notes ?? ''}
          className={inputCls}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-700">Imagen</h2>
        <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2">
          <p className="text-xs text-slate-500">JPG o PNG, máximo 5MB.</p>
          {imagePreview && (
            <div className="relative w-48 h-32">
              <Image
                src={imagePreview}
                alt="preview"
                fill
                className="object-cover rounded border"
                unoptimized
              />
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={onFileChange}
            data-testid="image-input"
          />
          {existing.imageUrl && (
            <button
              type="button"
              onClick={onRemoveImage}
              className="text-red-600 text-xs hover:underline"
            >
              Quitar imagen actual
            </button>
          )}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 font-medium disabled:opacity-50 text-sm"
          data-testid="save-button"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/admin/mobile-units/${existing.id}`)}
          className="px-4 py-2 rounded border bg-white hover:bg-slate-50 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}