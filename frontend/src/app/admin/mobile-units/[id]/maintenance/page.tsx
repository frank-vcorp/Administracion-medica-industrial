/**
 * @file Calendar de mantenimiento de una unidad (/admin/mobile-units/[id]/maintenance).
 * @id IMPL-20260711-01 — SPEC §5.5
 */
import { notFound } from 'next/navigation'
import MaintenanceCalendar from '@/components/mobile-units/MaintenanceCalendar'
import {
  getMobileUnitById,
} from '@/actions/mobile-unit.actions'
import { getMaintenanceRecords } from '@/actions/maintenance.actions'

export const dynamic = 'force-dynamic'

export default async function MaintenanceCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  try {
    await getMobileUnitById(id)
  } catch {
    notFound()
  }
  const records = await getMaintenanceRecords(id)
  return <MaintenanceCalendar unitId={id} initialRecords={records} />
}
