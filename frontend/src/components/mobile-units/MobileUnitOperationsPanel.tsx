/**
 * @file MobileUnitOperationsPanel — Panel operativo semanal de unidades móviles.
 * @id IMPL-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md §5.6
 *
 * Componente client que recibe los datos pre-calculados en el server component
 * y los renderiza con la misma UI/UX que MobileUnitManager (uniformidad visual).
 * Antes vivía inline en /operations/mobile-units/page.tsx (314 líneas, server).
 */
'use client'

import Link from 'next/link'
import { MOBILE_UNIT_STATUS_LABEL } from './constants'

type Conflict = { unit: string; date: string; project: string; maintenance: string }
type Day = { iso: string; label: string }

type Props = {
  statusCounts: Record<string, number>
  upcomingMaintenances: Array<{
    id: string
    type: string
    scheduledDate: string | Date
    unitName: string
    unitPlate: string | null
  }>
  overdueMaintenances: Array<{
    id: string
    type: string
    scheduledDate: string | Date
    unitName: string
  }>
  weekProjects: Array<{
    id: string
    name: string
    startDate: string | Date
    endDate: string | Date
    mobileUnitId: string | null
  }>
  weekMaintenances: Array<{
    id: string
    type: string
    scheduledDate: string | Date
    mobileUnitId: string
  }>
  conflicts: Conflict[]
  units: Array<{ id: string; name: string }>
  days: Day[]
}

const STATUS_LABEL = MOBILE_UNIT_STATUS_LABEL

function toDate(d: string | Date): Date {
  return d instanceof Date ? d : new Date(d)
}

export default function MobileUnitOperationsPanel({
  statusCounts,
  upcomingMaintenances,
  overdueMaintenances,
  weekProjects,
  weekMaintenances,
  conflicts,
  units,
  days,
}: Props) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-medium text-slate-600 mb-2">Estado operativo</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {['ACTIVA', 'MANTENIMIENTO', 'REPARACION', 'FUERA_SERVICIO', 'BAJA_PERMANENTE'].map((s) => {
            const meta = STATUS_LABEL[s]
            const count = statusCounts[s] ?? 0
            return (
              <div key={s} className={`border rounded-lg p-3 ${meta.color}`}>
                <p className="text-xs uppercase tracking-wide opacity-80">{meta.label}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-3">
          <h3 className="text-sm font-medium mb-2">Próximos mantenimientos (7 días)</h3>
          {upcomingMaintenances.length === 0 ? (
            <p className="text-sm text-slate-500">Sin mantenimientos próximos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcomingMaintenances.map((m) => (
                <li key={m.id} className="flex justify-between items-center border-b pb-1 last:border-b-0">
                  <span>
                    <strong>{m.unitName}</strong> · {m.type}
                  </span>
                  <span className="text-xs text-slate-600">
                    {toDate(m.scheduledDate).toLocaleDateString('es-MX')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border rounded-lg p-3">
          <h3 className="text-sm font-medium mb-2">Mantenimientos vencidos</h3>
          {overdueMaintenances.length === 0 ? (
            <p className="text-sm text-slate-500">Sin mantenimientos vencidos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {overdueMaintenances.map((m) => (
                <li key={m.id} className="flex justify-between items-center border-b pb-1 last:border-b-0">
                  <span><strong>{m.unitName}</strong> · {m.type}</span>
                  <span className="text-xs text-red-600">
                    {toDate(m.scheduledDate).toLocaleDateString('es-MX')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium mb-2">Calendario semanal (proyectos + mantenimientos)</h3>
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-2 py-2 text-left">Unidad</th>
                {days.map((d) => (
                  <th key={d.iso} className="px-2 py-2 text-left">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-2 py-2 font-medium">
                    <Link href={`/admin/mobile-units/${u.id}`} className="text-blue-600 hover:underline">
                      {u.name}
                    </Link>
                  </td>
                  {days.map((d) => {
                    const dayStart = new Date(d.iso); dayStart.setHours(0, 0, 0, 0)
                    const dayEnd = new Date(d.iso); dayEnd.setHours(23, 59, 59, 999)
                    const ps = weekProjects.filter(
                      (p) => p.mobileUnitId === u.id && toDate(p.startDate) <= dayEnd && toDate(p.endDate) >= dayStart
                    )
                    const ms = weekMaintenances.filter(
                      (m) => m.mobileUnitId === u.id && toDate(m.scheduledDate) >= dayStart && toDate(m.scheduledDate) <= dayEnd
                    )
                    return (
                      <td key={d.iso} className="px-2 py-2 align-top">
                        {ps.map((p) => (
                          <div key={p.id} className="text-[10px] mb-0.5 px-1 rounded bg-emerald-100 border border-emerald-300">
                            📍 {p.name}
                          </div>
                        ))}
                        {ms.map((m) => (
                          <div key={m.id} className="text-[10px] mb-0.5 px-1 rounded bg-amber-100 border border-amber-300">
                            🔧 {m.type}
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium mb-2">Conflictos detectados esta semana</h3>
        {conflicts.length === 0 ? (
          <p className="text-sm text-slate-500">Sin conflictos.</p>
        ) : (
          <ul className="divide-y border rounded-md">
            {conflicts.map((c, i) => (
              <li key={i} className="px-3 py-2 text-sm">
                <strong>{c.unit}</strong> · {c.date} · Proyecto <em>{c.project}</em> vs Mantenimiento {c.maintenance}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}