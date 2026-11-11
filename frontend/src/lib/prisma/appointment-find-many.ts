import type { Prisma, PrismaClient } from '@prisma/client'
import { isPrismaMissingColumnError } from '@/lib/prisma/missing-column-error'

/**
 * Escalares de `Appointment` sin columnas que pueden faltar en prod
 * (cancelación, seguimiento post-consulta).
 */
export const appointmentScalarSelectWithoutOptionalMigrationColumns = {
  id: true,
  workerId: true,
  companyId: true,
  branchId: true,
  scheduledAt: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  expedientId: true,
  qrCode: true,
  source: true,
  serviceProfileId: true,
  identityDocumentType: true,
  identityFrontFileUrl: true,
  identityBackFileUrl: true,
  identityVerifiedAt: true,
  identityVerifiedByUserId: true,
  identityExceptionReason: true,
  identityExceptionComment: true,
  identityEvidenceMode: true,
  corroborationResult: true,
  qrOperativo: true,
  informedConsentPdfUrl: true,
  informedConsentSignedAt: true,
} as const satisfies Prisma.AppointmentSelect

export type AppointmentFindManyClient = Pick<PrismaClient, 'appointment'>

export function withAppointmentOptionalMigrationDefaults<
  T extends Record<string, unknown>,
>(row: T) {
  return {
    ...row,
    cancellationReason: null,
    cancelledAt: null,
    followUpFromMedicalEventId: null,
  } as T & {
    cancellationReason: null
    cancelledAt: null
    followUpFromMedicalEventId: null
  }
}

function buildFindManyArgsWithoutOptionalMigrationColumns(
  args: Prisma.AppointmentFindManyArgs,
): Prisma.AppointmentFindManyArgs {
  const { include, select, ...rest } = args

  if (select) {
    const {
      cancellationReason: _cr,
      cancelledAt: _ca,
      followUpFromMedicalEventId: _fu,
      ...relationAndScalarSelect
    } = select as Prisma.AppointmentSelect

    return {
      ...rest,
      select: {
        ...appointmentScalarSelectWithoutOptionalMigrationColumns,
        ...relationAndScalarSelect,
      },
    }
  }

  if (include) {
    return {
      ...rest,
      select: {
        ...appointmentScalarSelectWithoutOptionalMigrationColumns,
        ...include,
      },
    }
  }

  return {
    ...rest,
    select: { ...appointmentScalarSelectWithoutOptionalMigrationColumns },
  }
}

/**
 * `appointment.findMany` con reintento si prod aún no tiene migraciones recientes
 * (p. ej. `followUpFromMedicalEventId` — 20261106171000).
 */
export async function findManyAppointmentsResilient<
  A extends Prisma.AppointmentFindManyArgs,
>(
  db: AppointmentFindManyClient,
  args: A,
): Promise<Prisma.AppointmentGetPayload<A>[]> {
  try {
    return (await db.appointment.findMany(args)) as Prisma.AppointmentGetPayload<A>[]
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error
    const fallbackArgs =
      buildFindManyArgsWithoutOptionalMigrationColumns(args)
    const rows = await db.appointment.findMany(fallbackArgs)
    return rows.map((row) =>
      withAppointmentOptionalMigrationDefaults(
        row as Record<string, unknown>,
      ),
    ) as Prisma.AppointmentGetPayload<A>[]
  }
}
