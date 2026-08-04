/**
 * @file Calendar de mantenimiento de una unidad (/admin/mobile-units/[id]/maintenance).
 * @id IMPL-20260711-01 — SPEC §5.5
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS — header sistema
 * @id ARCH-20260804-03 — superposición de proyectos (Fase 2).
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MaintenanceCalendar from '@/components/mobile-units/MaintenanceCalendar'
import { getMobileUnitById } from '@/actions/mobile-unit.actions'
import { getMaintenanceRecords } from '@/actions/maintenance.actions'
import { getProjectsByMobileUnit } from '@/actions/project.actions'

export const dynamic = 'force-dynamic'

export default async function MaintenanceCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let unit
  try {
    unit = await getMobileUnitById(id)
  } catch {
    notFound()
  }
  const [records, unitProjects] = await Promise.all([
    getMaintenanceRecords(id),
    getProjectsByMobileUnit(id),
  ])
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Calendario de mantenimiento · {unit.name}
          </h2>
          <p className="text-sm text-slate-500">
            Vista mensual de mantenimientos programados, completados y cancelados.
          </p>
        </div>
        <Link
          href={`/admin/mobile-units/${id}`}
          className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
        >
          ← Volver al detalle
        </Link>
      </header>
      <MaintenanceCalendar
        unitId={id}
        initialRecords={records}
        unitProjects={unitProjects}
        unitName={unit.name}
      />
    </div>
  )
}