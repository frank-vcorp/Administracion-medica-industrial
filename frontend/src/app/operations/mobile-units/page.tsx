/**
 * @file Vista unificada de Unidades Móviles — /operations/mobile-units.
 * @id IMPL-20260711-01 — SPEC §5.6
 * @id IMPL-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES — tabs Catálogo|Operación, NavItem único.
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS — header sistema, tabs color marca
 *
 * Server component. Pre-renderiza dos vistas en tabs:
 *   - "Catálogo" (MobileUnitManager) — CRUD disponible para ADMIN (readOnly para staff).
 *   - "Operación" (MobileUnitOperationsPanel) — métricas, próximos mantenimientos,
 *     conflictos, calendario semanal dual (proyectos + mantenimientos).
 *
 * Tab activa persiste vía searchParam `?view=catalog|operations` (default: catalog).
 * El rol del viewer se determina server-side desde getServerSession para condicionar readOnly.
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'
import { getMobileUnits } from '@/actions/mobile-unit.actions'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import MobileUnitManager from '@/components/mobile-units/MobileUnitManager'
import MobileUnitOperationsPanel from '@/components/mobile-units/MobileUnitOperationsPanel'

export const dynamic = 'force-dynamic'

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

type PageProps = {
  searchParams: Promise<{ view?: string }>
}

export default async function OperationsMobileUnitsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const activeView: 'catalog' | 'operations' = params.view === 'operations' ? 'operations' : 'catalog'

  const session = await getServerSession(authOptions)
  const isAdmin = isAdminLike(session?.user?.role)

  const unitsForCatalog = await getMobileUnits()

  const now = new Date()
  const weekStart = startOfWeek(now)
  const weekEnd = endOfWeek(now)
  const in7Days = new Date(now.getTime() + 7 * 86400_000)

  const [upcomingMaintenances, overdueMaintenances, weekProjects, weekMaintenances] = await Promise.all([
    prisma.maintenanceRecord.findMany({
      where: { status: { in: ['PROGRAMADO', 'REPROGRAMADO'] }, scheduledDate: { gte: now, lte: in7Days } },
      include: { mobileUnit: { select: { name: true, plate: true } } },
      orderBy: { scheduledDate: 'asc' },
    }),
    prisma.maintenanceRecord.findMany({
      where: { status: { in: ['PROGRAMADO', 'REPROGRAMADO'] }, scheduledDate: { lt: now } },
      include: { mobileUnit: { select: { name: true } } },
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

  type Conflict = { unit: string; date: string; project: string; maintenance: string }
  const conflicts: Conflict[] = []
  for (const m of weekMaintenances) {
    const mDate = new Date(m.scheduledDate); mDate.setHours(0, 0, 0, 0)
    const mEnd = new Date(m.scheduledDate); mEnd.setHours(23, 59, 59, 999)
    for (const p of weekProjects) {
      if (p.mobileUnitId !== m.mobileUnitId) continue
      if (new Date(p.startDate) <= mEnd && new Date(p.endDate) >= mDate) {
        conflicts.push({
          unit: m.mobileUnit.name,
          date: new Date(m.scheduledDate).toLocaleDateString('es-MX'),
          project: p.name,
          maintenance: m.type,
        })
      }
    }
  }

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return {
      iso: d.toISOString(),
      label: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
    }
  })

  const opsPayload = {
    statusCounts,
    upcomingMaintenances: upcomingMaintenances.map((m) => ({
      id: m.id, type: m.type,
      scheduledDate: m.scheduledDate.toISOString(),
      unitName: m.mobileUnit.name,
      unitPlate: m.mobileUnit.plate,
    })),
    overdueMaintenances: overdueMaintenances.map((m) => ({
      id: m.id, type: m.type,
      scheduledDate: m.scheduledDate.toISOString(),
      unitName: m.mobileUnit.name,
    })),
    weekProjects: weekProjects.map((p) => ({
      id: p.id, name: p.name,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      mobileUnitId: p.mobileUnitId,
    })),
    weekMaintenances: weekMaintenances.map((m) => ({
      id: m.id, type: m.type,
      scheduledDate: m.scheduledDate.toISOString(),
      mobileUnitId: m.mobileUnitId,
    })),
    conflicts,
    units: unitsForCatalog.map((u) => ({ id: u.id, name: u.name })),
    days,
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Unidades Móviles</h2>
          <p className="text-sm text-slate-500">
            Catálogo, operación semanal y mantenimiento en un solo módulo.
            {unitsForCatalog.length > 0 && ` (${unitsForCatalog.length} en sistema)`}
          </p>
        </div>
        {!isAdmin && (
          <span className="text-xs text-slate-500 self-center">Modo lectura</span>
        )}
      </header>

      {/* Tabs — IMPL-20260804-02: color de marca purple-600 (paridad BranchDetailTabs) */}
      <nav className="border-b border-slate-200" aria-label="Secciones del módulo">
        <ul className="-mb-px flex space-x-8">
          <li>
            <Link
              href="/operations/mobile-units?view=catalog"
              aria-current={activeView === 'catalog' ? 'page' : undefined}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeView === 'catalog'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              📋 Catálogo
            </Link>
          </li>
          <li>
            <Link
              href="/operations/mobile-units?view=operations"
              aria-current={activeView === 'operations' ? 'page' : undefined}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeView === 'operations'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              📊 Operación
            </Link>
          </li>
        </ul>
      </nav>

      {activeView === 'catalog' ? (
        <MobileUnitManager initialUnits={unitsForCatalog} readOnly={!isAdmin} />
      ) : (
        <MobileUnitOperationsPanel {...opsPayload} />
      )}
    </div>
  )
}