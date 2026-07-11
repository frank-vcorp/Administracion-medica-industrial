/**
 * @file Form para crear un proyecto de visita médica con selector de unidad móvil.
 * @id IMPL-20260711-01 — SPEC §6.5 / §4.3
 *
 * Wrapper client que combina campos básicos del proyecto con
 * MobileUnitSelectorClient para validar disponibilidad en tiempo real.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import MobileUnitSelectorClient from '@/components/mobile-units/MobileUnitSelectorClient'
import { createProject } from '@/actions/project.actions'

type Unit = { id: string; name: string; plate: string | null; status: string }

export default function NewProjectForm({
  units,
  companyOptions,
  branchOptions,
  defaultCompanyId,
}: {
  units: Unit[]
  companyOptions: Array<{ id: string; name: string }>
  branchOptions: Array<{ id: string; name: string }>
  defaultCompanyId?: string
}) {
  const router = useRouter()
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    const payload = {
      name: String(fd.get('name') || '').trim(),
      companyId: String(fd.get('companyId') || ''),
      startDate: new Date(String(fd.get('startDate') || '')).toISOString(),
      endDate: new Date(String(fd.get('endDate') || '')).toISOString(),
      branchId: fd.get('branchId') ? String(fd.get('branchId')) : undefined,
      mobileUnitId: fd.get('mobileUnitId') ? String(fd.get('mobileUnitId')) : undefined,
      unitRef: fd.get('unitRef') ? String(fd.get('unitRef')) : undefined,
      notes: fd.get('notes') ? String(fd.get('notes')) : undefined,
    }

    startTransition(async () => {
      const res = await createProject(payload as Parameters<typeof createProject>[0])
      if (!res.success) {
        setError(res.error ?? 'Error al crear')
        return
      }
      router.push(`/projects/${res.project!.id}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Nuevo Proyecto de Visita Médica</h1>
      {error && <div className="border border-red-300 bg-red-50 text-red-800 rounded-md px-3 py-2 text-sm" role="alert">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="name">Nombre *</label>
          <input id="name" name="name" required className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="companyId">Empresa *</label>
          <select id="companyId" name="companyId" required defaultValue={defaultCompanyId ?? ''} className="w-full border rounded-md px-3 py-2">
            <option value="" disabled>— Selecciona —</option>
            {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="startDate">Inicio *</label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="endDate">Fin *</label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="branchId">Sucursal</label>
          <select id="branchId" name="branchId" defaultValue="" className="w-full border rounded-md px-3 py-2">
            <option value="">—</option>
            {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="unitRef">Referencia unidad (texto libre)</label>
          <input id="unitRef" name="unitRef" className="w-full border rounded-md px-3 py-2" />
        </div>
      </div>

      <MobileUnitSelectorClient units={units} startDate={startDate ? new Date(startDate).toISOString() : undefined} endDate={endDate ? new Date(endDate).toISOString() : undefined} />

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="notes">Notas</label>
        <textarea id="notes" name="notes" rows={3} className="w-full border rounded-md px-3 py-2" />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {isPending ? 'Creando…' : 'Crear proyecto'}
        </button>
        <button type="button" onClick={() => router.push('/projects')} className="px-4 py-2 rounded-md border bg-white">
          Cancelar
        </button>
      </div>
    </form>
  )
}
