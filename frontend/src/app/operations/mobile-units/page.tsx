/**
 * @file Vista unificada de Unidades Móviles — /operations/mobile-units.
 * @id IMPL-20260711-01 — SPEC §5.6
 * @id IMPL-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES — tabs Catálogo|Operación, NavItem único.
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS — header sistema, rediseño institucional SME.
 *
 * Server component. Pre-renderiza dos vistas en tabs:
 *   - "Catálogo" (MobileUnitManager) — CRUD disponible para ADMIN (readOnly para staff).
 *   - "Operación" (MobileUnitOperationsPanel) — métricas, próximos mantenimientos,
 *     conflictos, calendario semanal Lunes–Domingo (proyectos + mantenimientos).
 *
 * Tab activa persiste vía searchParam `?view=catalog|operations` (default: catalog)
 * y semana activa vía `?week=YYYY-MM-DD`.
 */
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { Ambulance, CalendarRange, FolderKanban, LayoutGrid } from 'lucide-react'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'
import { getMobileUnits } from '@/actions/mobile-unit.actions'
import prisma from '@/lib/prisma'
import MobileUnitManager from '@/components/mobile-units/MobileUnitManager'
import MobileUnitOperationsPanel from '@/components/mobile-units/MobileUnitOperationsPanel'

export const dynamic = 'force-dynamic'

function startOfMondayWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const mondayOffset = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - mondayOffset)
  return x
}

function endOfMondayWeek(weekStart: Date): Date {
  const x = new Date(weekStart)
  x.setDate(weekStart.getDate() + 6)
  x.setHours(23, 59, 59, 999)
  return x
}

function addDays(d: Date, delta: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + delta)
  return x
}

function toDateParam(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseWeekParam(rawWeek: string | undefined, fallback: Date): Date {
  if (!rawWeek || !/^\d{4}-\d{2}-\d{2}$/.test(rawWeek)) return fallback
  const [y, m, d] = rawWeek.split('-').map(Number)
  const parsed = new Date(y, m - 1, d, 12, 0, 0, 0)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

type PageProps = {
  searchParams: Promise<{ view?: string; week?: string }>
}

export default async function OperationsMobileUnitsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeView: 'catalog' | 'operations' = params.view === 'operations' ? 'operations' : 'catalog'

  const session = await getServerSession(authOptions)
  const isAdmin = isAdminLike(session?.user?.role)

  const unitsForCatalog = await getMobileUnits()

  const now = new Date()
  const referenceDate = parseWeekParam(params.week, now)
  const weekStart = startOfMondayWeek(referenceDate)
  const weekEnd = endOfMondayWeek(weekStart)
  const todayWeekStart = startOfMondayWeek(now)
  const in7Days = new Date(now.getTime() + 7 * 86400_000)

  const [upcomingMaintenances, overdueMaintenances, weekProjects, weekMaintenances] = await Promise.all([
    prisma.maintenanceRecord.findMany({
      where: { status: { in: ['PROGRAMADO', 'REPROGRAMADO'] }, scheduledDate: { gte: now, lte: in7Days } },
      include: { mobileUnit: { select: { name: true, plate: true } } },
      orderBy: { scheduledDate: 'asc' },
    }),
    prisma.maintenanceRecord.findMany({
      where: { status: { in: ['PROGRAMADO', 'REPROGRAMADO'] }, scheduledDate: { lt: now } },
      include: { mobileUnit: { select: { name: true, plate: true } } },
      orderBy: { scheduledDate: 'asc' },
    }),
    prisma.project.findMany({
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
    prisma.maintenanceRecord.findMany({
      where: { status: { in: ['PROGRAMADO', 'REPROGRAMADO'] }, scheduledDate: { gte: weekStart, lte: weekEnd } },
      include: { mobileUnit: { select: { name: true } } },
    }),
  ])

  const statusCounts: Record<string, number> = {}
  for (const u of unitsForCatalog) {
    statusCounts[u.status] = (statusCounts[u.status] ?? 0) + 1
  }

  type Conflict = {
    unitId: string
    unit: string
    date: string
    projectId: string
    project: string
    maintenance: string
  }
  const conflicts: Conflict[] = []
  for (const m of weekMaintenances) {
    const mDate = new Date(m.scheduledDate)
    mDate.setHours(0, 0, 0, 0)
    const mEnd = new Date(m.scheduledDate)
    mEnd.setHours(23, 59, 59, 999)
    for (const p of weekProjects) {
      if (p.mobileUnitId !== m.mobileUnitId) continue
      if (new Date(p.startDate) <= mEnd && new Date(p.endDate) >= mDate) {
        conflicts.push({
          unitId: m.mobileUnitId,
          unit: m.mobileUnit.name,
          date: new Date(m.scheduledDate).toLocaleDateString('es-MX'),
          projectId: p.id,
          project: p.name,
          maintenance: m.type,
        })
      }
    }
  }

  const todayKey = toDateParam(now)
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(weekStart, i)
    const rawWeekday = d
      .toLocaleDateString('es-MX', { weekday: 'short' })
      .replace(/\.$/, '')
    const dayShort = rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1)
    const monthShort = d
      .toLocaleDateString('es-MX', { month: 'short' })
      .replace(/\.$/, '')
    return {
      iso: d.toISOString(),
      dayShort,
      dayNumber: d.getDate(),
      monthShort,
      isToday: toDateParam(d) === todayKey,
    }
  })

  const currentWeekIso = toDateParam(weekStart)
  const todayWeekIso = toDateParam(todayWeekStart)
  const weekNav = {
    prevWeekIso: toDateParam(addDays(weekStart, -7)),
    nextWeekIso: toDateParam(addDays(weekStart, 7)),
    todayWeekIso,
    isCurrentWeek: currentWeekIso === todayWeekIso,
    weekRangeLabel: `${weekStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`,
  }

  const opsPayload = {
    statusCounts,
    upcomingMaintenances: upcomingMaintenances.map((m) => ({
      id: m.id,
      unitId: m.mobileUnitId,
      type: m.type,
      scheduledDate: m.scheduledDate.toISOString(),
      unitName: m.mobileUnit.name,
      unitPlate: m.mobileUnit.plate,
    })),
    overdueMaintenances: overdueMaintenances.map((m) => ({
      id: m.id,
      unitId: m.mobileUnitId,
      type: m.type,
      scheduledDate: m.scheduledDate.toISOString(),
      unitName: m.mobileUnit.name,
      unitPlate: m.mobileUnit.plate,
    })),
    weekProjects: weekProjects.map((p) => ({
      id: p.id,
      name: p.name,
      companyName: p.company?.name ?? null,
      status: p.status,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      mobileUnitId: p.mobileUnitId,
    })),
    weekMaintenances: weekMaintenances.map((m) => ({
      id: m.id,
      type: m.type,
      scheduledDate: m.scheduledDate.toISOString(),
      mobileUnitId: m.mobileUnitId,
    })),
    conflicts,
    units: unitsForCatalog.map((u) => ({
      id: u.id,
      name: u.name,
      plate: u.plate,
      status: u.status,
    })),
    days,
    weekNav,
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header institucional SME */}
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#592c82]/12 text-[#592c82]">
              <Ambulance className="h-6 w-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Unidades Móviles
                </h2>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {unitsForCatalog.length} en sistema
                </span>
                {!isAdmin && (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    Modo lectura
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Flota de clínicas móviles, operación semanal en campo y control de mantenimientos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <nav
              className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
              aria-label="Secciones del módulo"
            >
              <Link
                href="/operations/mobile-units?view=catalog"
                aria-current={activeView === 'catalog' ? 'page' : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                  activeView === 'catalog'
                    ? 'bg-white text-[#592c82] shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Catálogo
              </Link>
              <Link
                href="/operations/mobile-units?view=operations"
                aria-current={activeView === 'operations' ? 'page' : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                  activeView === 'operations'
                    ? 'bg-white text-[#592c82] shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarRange className="h-4 w-4" />
                Operación
              </Link>
            </nav>

            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-[#592c82]"
            >
              <FolderKanban className="h-4 w-4 text-[#592c82]" />
              Ir a Proyectos
            </Link>
          </div>
        </div>
      </header>

      {activeView === 'catalog' ? (
        <MobileUnitManager initialUnits={unitsForCatalog} readOnly={!isAdmin} />
      ) : (
        <MobileUnitOperationsPanel {...opsPayload} />
      )}
    </div>
  )
}
