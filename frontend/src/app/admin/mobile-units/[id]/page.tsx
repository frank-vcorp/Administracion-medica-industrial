/**
 * @file Detalle de unidad móvil (/admin/mobile-units/[id]).
 * @id IMPL-20260711-01 — SPEC §5.3
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getMobileUnitById } from '@/actions/mobile-unit.actions'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVA: { label: 'Activa', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  REPARACION: { label: 'Reparación', color: 'bg-red-100 text-red-800 border-red-300' },
  FUERA_SERVICIO: { label: 'Fuera de servicio', color: 'bg-slate-200 text-slate-700 border-slate-300' },
  BAJA_PERMANENTE: { label: 'Baja permanente', color: 'bg-zinc-300 text-zinc-700 border-zinc-400' },
}

const TYPE_LABEL: Record<string, string> = {
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  VERIFICACION: 'Verificación',
  LIMPIEZA: 'Limpieza',
}

export default async function MobileUnitDetailPage({
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

  const status = STATUS_LABEL[unit.status] ?? { label: unit.status, color: 'bg-slate-100' }
  const projects = unit.projects
  const maintenances = unit.maintenances

  const equipment = (unit.equipment as Record<string, boolean> | null) ?? {}
  const equipmentKeys = Object.keys(equipment).filter((k) => equipment[k])

  const nextMaintenance = maintenances.find(
    (m: (typeof maintenances)[number]) => m.status === 'PROGRAMADO' || m.status === 'REPROGRAMADO'
  )
  const lastMaintenance = maintenances.find(
    (m: (typeof maintenances)[number]) => m.status === 'COMPLETADO'
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          {unit.imageUrl ? (
            <Image
              src={unit.imageUrl}
              alt={unit.name}
              width={160}
              height={110}
              className="rounded-lg border object-cover"
              unoptimized
            />
          ) : (
            <div className="w-40 h-28 rounded-lg border bg-slate-100 flex items-center justify-center text-slate-500">
              Sin imagen
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold">{unit.name}</h1>
            <p className="text-sm text-slate-600 space-x-3">
              <span>Placa: {unit.plate ?? '—'}</span>
              <span>VIN: {unit.vin ?? '—'}</span>
              <span>Año: {unit.year ?? '—'}</span>
              <span>Capacidad: {unit.capacity ?? '—'}</span>
            </p>
            <p className="mt-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${status.color}`}>{status.label}</span>
              <span className="ml-3 text-xs text-slate-500">Económico: {unit.economicNumber ?? '—'}</span>
            </p>
            {unit.notes && <p className="text-sm text-slate-700 mt-2">{unit.notes}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/mobile-units/${id}/edit`} className="px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-slate-50">
            Editar
          </Link>
          <Link
            href={`/admin/mobile-units/${id}/maintenance`}
            className="px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
            data-testid="calendar-link"
          >
            Ver calendario de mantenimiento
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Próximo mantenimiento">
          {nextMaintenance ? (
            <div>
              <p className="text-sm">
                {TYPE_LABEL[nextMaintenance.type] ?? nextMaintenance.type} —{' '}
                <strong>{new Date(nextMaintenance.scheduledDate).toLocaleDateString('es-MX')}</strong>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Estado: {nextMaintenance.status}
                {nextMaintenance.nextDueDate && (
                  <span className="ml-2">
                    · Próxima sugerencia: {new Date(nextMaintenance.nextDueDate).toLocaleDateString('es-MX')}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin mantenimientos programados.</p>
          )}
        </Card>
        <Card title="Último mantenimiento">
          {lastMaintenance ? (
            <div>
              <p className="text-sm">
                {TYPE_LABEL[lastMaintenance.type] ?? lastMaintenance.type} —{' '}
                <strong>
                  {lastMaintenance.completedDate
                    ? new Date(lastMaintenance.completedDate).toLocaleDateString('es-MX')
                    : '—'}
                </strong>
              </p>
              {lastMaintenance.technician && (
                <p className="text-xs text-slate-500 mt-1">Técnico: {lastMaintenance.technician}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin historial.</p>
          )}
        </Card>
        <Card title="Equipamiento">
          {equipmentKeys.length > 0 ? (
            <ul className="text-sm space-y-1">
              {equipmentKeys.map((k) => (
                <li key={k}>· {k}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Sin equipamiento registrado.</p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Proyectos asignados</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-500">Sin proyectos asignados.</p>
        ) : (
          <ul className="divide-y border rounded-md">
            {projects.map((p: (typeof projects)[number]) => (
              <li key={p.id} className="flex justify-between items-center px-3 py-2 text-sm">
                <div>
                  <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline font-medium">
                    {p.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {new Date(p.startDate).toLocaleDateString('es-MX')} →{' '}
                    {new Date(p.endDate).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded border bg-slate-50">{p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Historial de mantenimientos</h2>
        {maintenances.length === 0 ? (
          <p className="text-sm text-slate-500">Sin mantenimientos registrados.</p>
        ) : (
          <ol className="border-l-2 border-slate-200 ml-3 space-y-3 pl-4">
            {maintenances.slice(0, 20).map((m: (typeof maintenances)[number]) => (
              <li key={m.id} className="relative">
                <span className="absolute -left-[9px] mt-1 w-3 h-3 rounded-full bg-slate-400 border-2 border-white" />
                <p className="text-sm">
                  <strong>{TYPE_LABEL[m.type] ?? m.type}</strong>{' '}
                  <span className="text-xs text-slate-500">
                    ({m.status}) — {new Date(m.scheduledDate).toLocaleDateString('es-MX')}
                  </span>
                </p>
                <p className="text-xs text-slate-600">{m.description}</p>
                {m.technician && <p className="text-xs text-slate-500">Técnico: {m.technician}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-3 bg-white">
      <h3 className="text-sm font-medium text-slate-600 mb-2">{title}</h3>
      {children}
    </div>
  )
}
