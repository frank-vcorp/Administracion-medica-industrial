/**
 * @file Dashboard operativo de unidades móviles — /operations/mobile-units.
 * @id IMPL-20260711-01 — SPEC §5.6
 *
 * Server component: contadores, próximos mantenimientos (7 días), unidades con
 * mantenimiento vencido, conflictos recientes, calendario semanal dual
 * (proyectos + mantenimientos) y tabla simple de utilización.
 */
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import Link from 'next/link'

// Tipos locales para tipar las listas
type UnitWithCount = Prisma.MobileUnitGetPayload<{
  include: { _count: { select: { projects: true; maintenances: true } } }
}>
type MaintenanceWithUnit = Prisma.MaintenanceRecordGetPayload<{
  include: { mobileUnit: { select: { name: true; plate: true } } }
}>
type ProjectWithUnit = Prisma.ProjectGetPayload<{
  include: {
    mobileUnit: { select: { name: true; plate: true } }
    company: { select: { name: true } }
  }
}>

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVA: { label: 'Activa', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  REPARACION: { label: 'Reparación', color: 'bg-red-100 text-red-800 border-red-300' },
  FUERA_SERVICIO: { label: 'Fuera de servicio', color: 'bg-slate-200 text-slate-700 border-slate-300' },
  BAJA_PERMANENTE: { label: 'Baja permanente', color: 'bg-zinc-300 text-zinc-700 border-zinc-400' },
}

function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}
function endOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  x.setDate(x.getDate() + (6 - x.getDay()))
  return x
}

export default async function OperationsMobileUnitsPage() {
  // Prisma client directo (server component fuera del scope de actions).
  // Si @/lib/prisma-shim no existe, fallback a @/lib/prisma default.
  const prismaClient = prisma
  const now = new Date()
  const weekStart = startOfWeek(now)
  const weekEnd = endOfWeek(now)
  const in7Days = new Date(now.getTime() + 7 * 86400_000)

  const [
    allUnitsRaw,
    upcomingMaintenancesRaw,
    overdueMaintenancesRaw,
    weekProjectsRaw,
    weekMaintenancesRaw,
  ] = await Promise.all([
    prismaClient.mobileUnit.findMany({
      include: {
        _count: { select: { projects: true, maintenances: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prismaClient.maintenanceRecord.findMany({
      where: {
        status: { in: ['PROGRAMADO', 'REPROGRAMADO'] },
        scheduledDate: { gte: now, lte: in7Days },
      },
      include: { mobileUnit: { select: { name: true, plate: true } } },
      orderBy: { scheduledDate: 'asc' },
    }),
    prismaClient.maintenanceRecord.findMany({
      where: {
        status: { in: ['PROGRAMADO', 'REPROGRAMADO'] },
        scheduledDate: { lt: now },
      },
      include: { mobileUnit: { select: { name: true } } },
      orderBy: { scheduledDate: 'asc' },
    }),
    prismaClient.project.findMany({
      where: {
        NOT: { status: 'CANCELLED' },
        AND: [{ startDate: { lte: weekEnd } }, { endDate: { gte: weekStart } }],
        mobileUnitId: { not: null },
      },
      include: {
        mobileUnit: { select: { name: true, plate: true } },
        company: { select: { name: true } },
      },
    }),
    prismaClient.maintenanceRecord.findMany({
      where: {
        status: { in: ['PROGRAMADO', 'REPROGRAMADO'] },
        scheduledDate: { gte: weekStart, lte: weekEnd },
      },
      include: { mobileUnit: { select: { name: true } } },
    }),
  ])

  const allUnits = allUnitsRaw as UnitWithCount[]
  const upcomingMaintenances = upcomingMaintenancesRaw as MaintenanceWithUnit[]
  const overdueMaintenances = overdueMaintenancesRaw as MaintenanceWithUnit[]
  const weekProjects = weekProjectsRaw as ProjectWithUnit[]
  const weekMaintenances = weekMaintenancesRaw as MaintenanceWithUnit[] 

  const statusCounts: Record<string, number> = {}
  for (const u of allUnits) {
    statusCounts[u.status] = (statusCounts[u.status] ?? 0) + 1
  }

  // Conflictos detectados esta semana: proyectos y mantenimientos del mismo día/unidad
  type Conflict = { unit: string; date: string; project: string; maintenance: string }
  const conflicts: Conflict[] = []
  for (const m of weekMaintenances) {
    const mDate = new Date(m.scheduledDate)
    mDate.setHours(0, 0, 0, 0)
    const mEnd = new Date(m.scheduledDate)
    mEnd.setHours(23, 59, 59, 999)
    const clashing = weekProjects.filter((p: typeof weekProjects[number]) => {
      if (p.mobileUnitId !== m.mobileUnitId) return false
      return new Date(p.startDate) <= mEnd && new Date(p.endDate) >= mDate
    })
    for (const p of clashing) {
      conflicts.push({
        unit: m.mobileUnit.name,
        date: new Date(m.scheduledDate).toLocaleDateString('es-MX'),
        project: p.name,
        maintenance: m.type,
      })
    }
  }

  // Heatmap semanal: por unidad y por día
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Operaciones · Unidades Móviles</h1>
        <p className="text-sm text-slate-600">Vista operativa semanal, métricas y conflictos.</p>
      </header>

      <section>
        <h2 className="text-sm font-medium text-slate-600 mb-2">Estado operativo</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {['ACTIVA', 'MANTENIMIENTO', 'REPARACION', 'FUERA_SERVICIO', 'BAJA_PERMANENTE'].map((s) => {
            const meta = STATUS_LABEL[s]
            const count = statusCounts[s] ?? 0
            return (
              <div key={s} className={`border rounded-lg p-3 ${meta.color.replace('text-', 'text-').replace('bg-', 'bg-')}`}>
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
                    <strong>{m.mobileUnit.name}</strong> · {m.type}
                  </span>
                  <span className="text-xs text-slate-600">
                    {new Date(m.scheduledDate).toLocaleDateString('es-MX')}
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
                  <span><strong>{m.mobileUnit.name}</strong> · {m.type}</span>
                  <span className="text-xs text-red-600">
                    {new Date(m.scheduledDate).toLocaleDateString('es-MX')}
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
                  <th key={d.toISOString()} className="px-2 py-2 text-left">
                    {d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allUnits.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-2 py-2 font-medium">
                    <Link href={`/admin/mobile-units/${u.id}`} className="text-blue-600 hover:underline">
                      {u.name}
                    </Link>
                  </td>
                  {days.map((d) => {
                    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0)
                    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999)
                    const ps = weekProjects.filter((p) => {
                      if (p.mobileUnitId !== u.id) return false
                      return new Date(p.startDate) <= dayEnd && new Date(p.endDate) >= dayStart
                    })
                    const ms = weekMaintenances.filter((m) => {
                      if (m.mobileUnitId !== u.id) return false
                      const sd = new Date(m.scheduledDate)
                      return sd >= dayStart && sd <= dayEnd
                    })
                    return (
                      <td key={d.toISOString()} className="px-2 py-2 align-top">
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

      <section>
        <h3 className="text-sm font-medium mb-2">Utilización por unidad</h3>
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Unidad</th>
                <th className="px-3 py-2 text-right">Proyectos asignados</th>
                <th className="px-3 py-2 text-right">Mantenimientos totales</th>
                <th className="px-3 py-2 text-right">Capacidad</th>
              </tr>
            </thead>
            <tbody>
              {allUnits.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2 text-right">{u._count.projects}</td>
                  <td className="px-3 py-2 text-right">{u._count.maintenances}</td>
                  <td className="px-3 py-2 text-right">{u.capacity ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

async function _getPrisma() {
  // Shim eliminado — usamos el singleton importado arriba.
}
void _getPrisma
