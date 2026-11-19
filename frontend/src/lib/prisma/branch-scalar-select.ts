import type { Prisma } from '@prisma/client'

/** Branch sin columnas de migraciones recientes (weeklySchedule / capacityMode). */
export const branchScalarSelectWithoutWeeklySchedule = {
  id: true,
  name: true,
  address: true,
  phone: true,
  managerName: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
  closingTime: true,
  hourlyCapacity: true,
  openingTime: true,
  isActive: true,
  disabledAt: true,
  disabledByUserId: true,
} as const satisfies Prisma.BranchSelect

export type BranchWithoutWeeklyScheduleRow = Prisma.BranchGetPayload<{
  select: typeof branchScalarSelectWithoutWeeklySchedule
}>

/** Rellena columnas opcionales de sucursal cuando la BD aún no tiene la migración. */
export function withBranchWeeklyScheduleDefault<
  T extends BranchWithoutWeeklyScheduleRow | null,
>(
  branch: T,
): T extends null
  ? null
  : BranchWithoutWeeklyScheduleRow & {
      weeklySchedule: null
      capacityMode: string
      hourlyMinutesCapacity: null
    } {
  if (branch == null) return null as never
  return {
    ...branch,
    weeklySchedule: null,
    capacityMode: 'HOURLY_COUNT',
    hourlyMinutesCapacity: null,
  } as never
}
