/**
 * @file Detalle de unidad móvil (/admin/mobile-units/[id]).
 * @id IMPL-20260711-01 — SPEC §5.3
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getServerSession } from 'next-auth'
import {
  Ambulance,
  Calendar,
  CheckCircle2,
  Cpu,
  FolderKanban,
  History,
  Pencil,
  Wrench,
} from 'lucide-react'
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
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

const PROJECT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
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
    <div className="space-y-6 pb-10">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/operations/mobile-units" className="hover:text-[#592c82] transition-colors">
          Unidades Móviles
        </Link>
        <span>›</span>
        <span className="font-medium text-slate-800">{unit.name}</span>
      </nav>

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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
            <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-gradient-to-br from-[#592c82]/12 via-slate-50 to-teal-50/60">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#592c82] shadow-sm">
                <Ambulance className="h-6 w-6" />
              </span>
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold text-slate-900">{unit.name}</h2>
              <MobileUnitStatusBadge status={unit.status} />
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>Placa: <strong className="text-slate-700">{unit.plate ?? '—'}</strong></span>
              <span>VIN: <strong className="text-slate-700">{unit.vin ?? '—'}</strong></span>
              <span>Año: <strong className="text-slate-700">{unit.year ?? '—'}</strong></span>
              <span>Capacidad: <strong className="text-slate-700">{unit.capacity ?? '—'}</strong></span>
              <span>Económico: <strong className="text-slate-700">{unit.economicNumber ?? '—'}</strong></span>
            </p>
            {unit.notes && (
              <p className="mt-3 max-w-2xl text-sm text-slate-600">{unit.notes}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/mobile-units/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#592c82] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#49226b]"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
          <Link
            href={`/admin/mobile-units/${id}/maintenance`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            data-testid="calendar-link"
          >
            <Calendar className="h-4 w-4 text-[#592c82]" />
            Calendario de mantenimiento
          </Link>
          {isAdmin && (
            <MobileUnitDeleteButton unitId={id} unitName={unit.name} />
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard title="Próximo mantenimiento" icon={Wrench} iconTone="bg-amber-50 text-amber-600">
          {nextMaintenance ? (
            <div>
              <p className="text-sm text-slate-800">
                {TYPE_LABEL[nextMaintenance.type] ?? nextMaintenance.type} —{' '}
                <strong>
                  {new Date(nextMaintenance.scheduledDate).toLocaleDateString('es-MX')}
                </strong>
              </p>
              <p className="mt-1 text-xs text-slate-500">
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
        </InfoCard>

        <InfoCard title="Último mantenimiento" icon={CheckCircle2} iconTone="bg-emerald-50 text-emerald-600">
          {lastMaintenance ? (
            <div>
              <p className="text-sm text-slate-800">
                {TYPE_LABEL[lastMaintenance.type] ?? lastMaintenance.type} —{' '}
                <strong>
                  {lastMaintenance.completedDate
                    ? new Date(lastMaintenance.completedDate).toLocaleDateString('es-MX')
                    : '—'}
                </strong>
              </p>
              {lastMaintenance.technician && (
                <p className="mt-1 text-xs text-slate-500">
                  Técnico: {lastMaintenance.technician}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin historial.</p>
          )}
        </InfoCard>

        <InfoCard title="Equipamiento" icon={Cpu} iconTone="bg-[#592c82]/12 text-[#592c82]">
          {equipmentKeys.length > 0 ? (
            <ul className="space-y-1 text-sm text-slate-700">
              {equipmentKeys.map((k) => (
                <li key={k}>· {k}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Sin equipamiento registrado.</p>
          )}
        </InfoCard>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <FolderKanban className="h-4 w-4" />
          </span>
          <h3 className="text-base font-bold text-slate-900">Proyectos asignados</h3>
        </div>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-500">Sin proyectos asignados.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {projects.map((p: (typeof projects)[number]) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50/70 transition-colors"
              >
                <div>
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-semibold text-slate-800 hover:text-[#592c82] hover:underline"
                  >
                    {p.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {new Date(p.startDate).toLocaleDateString('es-MX')} →{' '}
                    {new Date(p.endDate).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                    STATUS_PILL[p.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <History className="h-4 w-4" />
          </span>
          <h3 className="text-base font-bold text-slate-900">
            Historial de mantenimientos
          </h3>
        </div>
        {maintenances.length === 0 ? (
          <p className="text-sm text-slate-500">Sin mantenimientos registrados.</p>
        ) : (
          <ol className="ml-3 space-y-3 border-l-2 border-slate-200 pl-4">
            {maintenances.slice(0, 20).map((m: (typeof maintenances)[number]) => (
              <li key={m.id} className="relative">
                <span className="absolute -left-[23px] mt-1 h-3 w-3 rounded-full border-2 border-white bg-[#592c82]" />
                <p className="text-sm text-slate-800">
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

function InfoCard({
  title,
  icon: Icon,
  iconTone,
  children,
}: {
  title: string
  icon: typeof Wrench
  iconTone: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${iconTone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {title}
        </h4>
      </div>
      {children}
    </div>
  )
}
