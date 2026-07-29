export const MAINTENANCE_TYPES = ['PREVENTIVO', 'CORRECTIVO', 'VERIFICACION', 'LIMPIEZA'] as const

type MaintenanceType = (typeof MAINTENANCE_TYPES)[number]

/** Calcula el próximo vencimiento sin depender del runtime de Server Actions. */
export function calculateNextDueDate(
  completedDate: Date,
  type: MaintenanceType,
  override?: Date | null
): Date | null {
  if (override !== undefined) return override

  switch (type) {
    case 'PREVENTIVO':
      return new Date(completedDate.getTime() + 90 * 86400_000)
    case 'VERIFICACION':
      return new Date(completedDate.getTime() + 365 * 86400_000)
    case 'LIMPIEZA':
      return new Date(completedDate.getTime() + 30 * 86400_000)
    case 'CORRECTIVO':
      return null
  }
}
