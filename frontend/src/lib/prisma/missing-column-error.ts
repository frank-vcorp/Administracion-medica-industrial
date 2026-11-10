import { Prisma } from '@prisma/client'

/** Columnas añadidas en 20261028170000_cancellation_reason — pueden faltar en prod. */
export const CANCELLATION_REASON_COLUMNS = [
  'cancellationReason',
  'cancelledAt',
] as const

/** Columnas de migraciones recientes que el código tolera ausentes (expediente / citas). */
export const OPTIONAL_MIGRATION_COLUMN_HINTS = [
  ...CANCELLATION_REASON_COLUMNS,
  'weeklySchedule',
] as const

/**
 * Prisma P2022 cuando el schema del cliente incluye columnas que la BD aún no tiene.
 */
export function isPrismaMissingColumnError(
  error: unknown,
  columnHints: readonly string[] = OPTIONAL_MIGRATION_COLUMN_HINTS,
): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code !== 'P2022') return false
    const metaColumn = String(
      (error.meta as { column?: string } | undefined)?.column ?? '',
    )
    const haystack = `${metaColumn} ${error.message}`
    return columnHints.some((hint) => haystack.includes(hint))
  }
  if (error instanceof Error && error.message.includes('does not exist')) {
    return columnHints.some((hint) => error.message.includes(hint))
  }
  return false
}
