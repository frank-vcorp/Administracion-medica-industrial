/**
 * @file Detalle de unidad móvil (/admin/mobile-units/[id]).
 * @id IMPL-20260711-01 — SPEC §5.3
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 *
 * Migrado a tokens del sistema:
 *   - Header text-2xl font-bold text-slate-800
 *   - Status badge rounded-full text-[10px] (MobileUnitStatusBadge)
 *   - Cards bg-white p-4 rounded-lg border border-slate-200 (paridad BranchUsageStats)
 *   - Botones header slate-900 (primario) + outline (secundario)
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'
import { getMobileUnitById } from '@/actions/mobile-unit.actions'
import { MobileUnitStatusBadge } from '@/components/mobile-units/MobileUnitStatusBadge'
import { MobileUnitDeleteButton } from '@/components/mobile-units/MobileUnitDeleteButton'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
  VERIFICACION: 'Verificación',
  LIMPIEZA: 'Limpieza',
}

const STATUS_PILL: Record<string, string> = {
  PROGRAMADO: 'bg-blue-100 text-blue-700',
  COMPLETADO: 'bg-emerald-100 text-emerald-700',
  CANCELADO: 'bg-slate-200 text-slate-600',
  REPROGRAMADO: 'bg-amber-100 text-amber-700',
}

export default async function MobileUnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const isAdmin = isAdminLike(session?.user?.role)

  let unit
  try {
    unit = await getMobileUnitById(id)
  } catch {
    notFound()
  }

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
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          {unit.imageUrl ? (
            <Image
              src={unit.imageUrl}
              alt={unit.name}
              width={160}
              height={110}
              className="rounded-xl border border-slate-200 object-cover"
              unoptimized
            />
          ) : (
            <div className="w-40 h-28 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-500 text-3xl">
              🚑
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{unit.name}</h2>
            <p className="text-sm text-slate-500 mt-1 space-x-3">
              <span>Placa: {unit.plate ?? '—'}</span>
              <span>VIN: {unit.vin ?? '—'}</span>
              <span>Año: {unit.year ?? '—'}</span>
              <span>Capacidad: {unit.capacity ?? '—'}</span>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <MobileUnitStatusBadge status={unit.status} />
              <span className="text-xs text-slate-500">
                Económico: {unit.economicNumber ?? '—'}
              </span>
            </div>
            {unit.notes && (
              <p className="text-sm text-slate-700 mt-3 max-w-2xl">{unit.notes}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/mobile-units/${id}/edit`}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow"
          >
            Editar
          </Link>
          <Link
            href={`/admin/mobile-units/${id}/maintenance`}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
            data-testid="calendar-link"
          >
            Calendario de mantenimiento
          </Link>
          {isAdmin && (
            <MobileUnitDeleteButton unitId={id} unitName={unit.name} />
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Próximo mantenimiento">
          {nextMaintenance ? (
            <div>
              <p className="text-sm">
                {TYPE_LABEL[nextMaintenance.type] ?? nextMaintenance.type} —{' '}
                <strong>
                  {new Date(nextMaintenance.scheduledDate).toLocaleDateString('es-MX')}
                </strong>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Estado: {nextMaintenance.status}
                {nextMaintenance.nextDueDate && (
                  <span className="ml-2">
                    · Próxima sugerencia:{' '}
                    {new Date(nextMaintenance.nextDueDate).toLocaleDateString('es-MX')}
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
                <p className="text-xs text-slate-500 mt-1">
                  Técnico: {lastMaintenance.technician}
                </p>
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
        <h3 className="text-lg font-medium text-slate-800 mb-2">Proyectos asignados</h3>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-500">Sin proyectos asignados.</p>
        ) : (
          <ul className="bg-white divide-y border border-slate-200 rounded-lg overflow-hidden">
            {projects.map((p: (typeof projects)[number]) => (
              <li
                key={p.id}
                className="flex justify-between items-center px-4 py-2 text-sm"
              >
                <div>
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {p.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {new Date(p.startDate).toLocaleDateString('es-MX')} →{' '}
                    {new Date(p.endDate).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    STATUS_PILL[p.status] ?? 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-lg font-medium text-slate-800 mb-2">
          Historial de mantenimientos
        </h3>
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
                {m.technician && (
                  <p className="text-xs text-slate-500">Técnico: {m.technician}</p>
                )}
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
    <div className="bg-white p-4 rounded-lg border border-slate-200">
      <h4 className="text-xs uppercase font-bold tracking-wide text-slate-500 mb-2">
        {title}
      </h4>
      {children}
    </div>
  )
}