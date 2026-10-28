import type { Prisma } from '@prisma/client'

/** Branch sin weeklySchedule (migración 20261028180000 puede no estar aplicada). */
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

/** Rellena weeklySchedule cuando la BD aún no tiene la columna. */
export function withBranchWeeklyScheduleDefault<
  T extends BranchWithoutWeeklyScheduleRow | null,
>(branch: T): T extends null ? null : BranchWithoutWeeklyScheduleRow & { weeklySchedule: null } {
  if (branch == null) return null as never
  return { ...branch, weeklySchedule: null } as never
}
