/**
 * @file MobileUnitForm — Formulario crear/editar unidad + upload de imagen.
 * @id IMPL-20260711-01
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  createMobileUnit,
  updateMobileUnit,
  uploadMobileUnitImage,
  deleteMobileUnitImage,
} from '@/actions/mobile-unit.actions'

const STATUS_OPTIONS = [
  { value: 'ACTIVA', label: 'Activa' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'REPARACION', label: 'Reparación' },
  { value: 'FUERA_SERVICIO', label: 'Fuera de servicio' },
  { value: 'BAJA_PERMANENTE', label: 'Baja permanente' },
]

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

export default function MobileUnitForm({ existing }: { existing?: ExistingUnit }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(existing?.imageUrl ?? null)
  const [equipment, setEquipment] = useState<Record<string, boolean>>(
    (existing?.equipment as Record<string, boolean>) ?? {}
  )

  const isEdit = Boolean(existing)

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    if (file) setImagePreview(URL.createObjectURL(file))
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
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
      const res = isEdit
        ? await updateMobileUnit(existing!.id, data as Parameters<typeof updateMobileUnit>[1])
        : await createMobileUnit(data as Parameters<typeof createMobileUnit>[0])
      if (!res.success) {
        setError(res.error ?? 'Error al guardar')
        return
      }

      // Subir imagen si hay nueva
      const unitId = isEdit
        ? existing!.id
        : (res as unknown as { unit: { id: string } }).unit.id
      if (imageFile) {
        const upRes = await uploadMobileUnitImage(unitId, imageFile)
        if (!upRes.success) {
          setError(`Unidad guardada, pero la imagen falló: ${upRes.error}`)
          return
        }
      }

      router.push(`/admin/mobile-units/${unitId}`)
    })
  }

  const onRemoveImage = async () => {
    if (!existing) return
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

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">
        {isEdit ? `Editar ${existing!.name}` : 'Nueva Unidad Móvil'}
      </h1>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 rounded-md px-3 py-2 text-sm" role="alert">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre *" name="name" required defaultValue={existing?.name} data-testid="name-input" />
        <Field label="Placa" name="plate" defaultValue={existing?.plate ?? ''} data-testid="plate-input" />
        <Field label="VIN" name="vin" defaultValue={existing?.vin ?? ''} />
        <Field label="Año" name="year" type="number" defaultValue={existing?.year ?? ''} />
        <Field label="Capacidad (pacientes/día)" name="capacity" type="number" defaultValue={existing?.capacity ?? ''} />
        <Field label="Número económico" name="economicNumber" defaultValue={existing?.economicNumber ?? ''} />
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" htmlFor="status">Estado</label>
          <select
            id="status"
            name="status"
            defaultValue={existing?.status ?? 'ACTIVA'}
            className="w-full border rounded-md px-3 py-2"
            data-testid="status-input"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="border rounded-md p-3 space-y-2">
        <legend className="text-sm font-medium px-1">Equipamiento</legend>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {EQUIPMENT_KEYS.map((eq) => (
            <label key={eq.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(equipment[eq.key])}
                onChange={(e) => setEquipment((prev) => ({ ...prev, [eq.key]: e.target.checked }))}
                data-testid={`equipment-${eq.key}`}
              />
              {eq.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="notes">Notas</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={existing?.notes ?? ''}
          className="w-full border rounded-md px-3 py-2"
        />
      </div>

      <fieldset className="border rounded-md p-3 space-y-2">
        <legend className="text-sm font-medium px-1">Imagen</legend>
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
        <input type="file" accept="image/jpeg,image/png" onChange={onFileChange} data-testid="image-input" />
        {isEdit && existing?.imageUrl && (
          <button type="button" onClick={onRemoveImage} className="text-red-600 text-sm hover:underline">
            Quitar imagen actual
          </button>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          data-testid="save-button"
        >
          {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear unidad'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/mobile-units')}
          className="px-4 py-2 rounded-md border bg-white hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  defaultValue,
  ...rest
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  defaultValue?: string | number
  'data-testid'?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue as string | undefined}
        className="w-full border rounded-md px-3 py-2"
        {...rest}
      />
    </div>
  )
}
