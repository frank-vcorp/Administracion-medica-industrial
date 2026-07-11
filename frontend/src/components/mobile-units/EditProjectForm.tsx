'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import MobileUnitSelectorClient from '@/components/mobile-units/MobileUnitSelectorClient'
import { updateProject } from '@/actions/project.actions'

type Unit = { id: string; name: string; plate: string | null; status: string }

type Props = {
  projectId: string
  units: Unit[]
  initial: {
    name: string
    startDate: string // YYYY-MM-DD
    endDate: string   // YYYY-MM-DD
    branchId: string | null
    unitRef: string | null
    mobileUnitId: string | null
    notes: string | null
  }
}

export default function EditProjectForm({ projectId, units, initial }: Props) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const payload = {
      name: String(fd.get('name') || '').trim(),
      startDate: new Date(String(fd.get('startDate') || '')).toISOString(),
      endDate: new Date(String(fd.get('endDate') || '')).toISOString(),
      branchId: fd.get('branchId') ? String(fd.get('branchId')) : undefined,
      mobileUnitId: fd.get('mobileUnitId') ? String(fd.get('mobileUnitId')) : undefined,
      unitRef: fd.get('unitRef') ? String(fd.get('unitRef')) : undefined,
      notes: fd.get('notes') ? String(fd.get('notes')) : undefined,
    }

    startTransition(async () => {
      const res = await updateProject(projectId, payload as Parameters<typeof updateProject>[1])
      if (!res.success) {
        setError(res.error ?? 'Error al actualizar')
        return
      }
      router.push(`/projects/${projectId}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Editar proyecto</h1>
      {error && <div className="border border-red-300 bg-red-50 text-red-800 rounded-md px-3 py-2 text-sm" role="alert">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="name">Nombre</label>
          <input id="name" name="name" defaultValue={initial.name} required className="w-full border rounded-md px-3 py-2" />
        </div>
        <div /> {/* placeholder */}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="startDate">Inicio</label>
          <input
            id="startDate" name="startDate" type="date" required
            value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="endDate">Fin</label>
          <input
            id="endDate" name="endDate" type="date" required
            value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="branchId">Sucursal</label>
          <input id="branchId" name="branchId" defaultValue={initial.branchId ?? ''} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="unitRef">Referencia unidad</label>
          <input id="unitRef" name="unitRef" defaultValue={initial.unitRef ?? ''} className="w-full border rounded-md px-3 py-2" />
        </div>
      </div>

      <MobileUnitSelectorClient
        units={units}
        initialValue={initial.mobileUnitId ?? ''}
        startDate={startDate ? new Date(startDate).toISOString() : undefined}
        endDate={endDate ? new Date(endDate).toISOString() : undefined}
        projectId={projectId}
      />

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="notes">Notas</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ''} className="w-full border rounded-md px-3 py-2" />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={() => router.push(`/projects/${projectId}`)} className="px-4 py-2 rounded-md border bg-white">
          Cancelar
        </button>
      </div>
    </form>
  )
}
