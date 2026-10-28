import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/** Relaciones compartidas entre la query completa y la compatible sin columnas de cancelación. */
export const medicalEventByIdRelations = {
  worker: {
    include: {
      company: true,
      medicalProfile: { select: { id: true, name: true } },
    },
  },
  branch: true,
  exam: true,
  appointment: {
    include: {
      serviceProfile: {
        select: { id: true, name: true },
      },
    },
  },
  eventTests: {
    include: {
      test: {
        select: {
          id: true,
          code: true,
          options: true,
          category: {
            select: { name: true },
          },
        },
      },
      extractionSnapshots: {
        where: { isSuperseded: false },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: {
          aiPrediagnoses: {
            where: { isSuperseded: false },
            orderBy: { createdAt: 'desc' as const },
            take: 1,
            include: {
              doctorReviews: {
                orderBy: { createdAt: 'desc' as const },
                take: 1,
                select: {
                  id: true,
                  doctorStatus: true,
                  doctorDiagnosis: true,
                  doctorNotes: true,
                  doctorRecommendations: true,
                  createdAt: true,
                  validatedPdfUrl: true,
                  validatedPdfGeneratedAt: true,
                  validatedPdfError: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  verdict: true,
} satisfies Prisma.MedicalEventInclude

const medicalEventScalarSelectWithoutCancellation = {
  id: true,
  status: true,
  workerId: true,
  branchId: true,
  checkInDate: true,
  createdAt: true,
  updatedAt: true,
  appointmentId: true,
  billingCompanyId: true,
  intakeSource: true,
  projectId: true,
  intakeCreatedByUserId: true,
  dischargedAt: true,
  dischargedByUserId: true,
  mobileUnitId: true,
} as const satisfies Prisma.MedicalEventSelect

const appointmentScalarSelectWithoutCancellation = {
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
  serviceProfile: {
    select: { id: true, name: true },
  },
} as const satisfies Prisma.AppointmentSelect

export type MedicalEventByIdResult = Prisma.MedicalEventGetPayload<{
  include: typeof medicalEventByIdRelations
}>

/** Rellena columnas de cancelación cuando la BD aún no tiene la migración 20261028170000. */
function withCancellationDefaults(
  row: Record<string, unknown> & {
    appointment?: Record<string, unknown> | null
  },
): MedicalEventByIdResult {
  return {
    ...row,
    cancellationReason: null,
    cancelledAt: null,
    appointment: row.appointment
      ? {
          ...row.appointment,
          cancellationReason: null,
          cancelledAt: null,
        }
      : null,
  } as MedicalEventByIdResult
}

export async function queryMedicalEventById(
  id: string,
  mode: 'full' | 'withoutCancellationColumns',
): Promise<MedicalEventByIdResult | null> {
  if (mode === 'full') {
    return prisma.medicalEvent.findUnique({
      where: { id },
      include: medicalEventByIdRelations,
    })
  }

  const row = await prisma.medicalEvent.findUnique({
    where: { id },
    select: {
      ...medicalEventScalarSelectWithoutCancellation,
      worker: medicalEventByIdRelations.worker,
      branch: medicalEventByIdRelations.branch,
      exam: medicalEventByIdRelations.exam,
      appointment: {
        select: appointmentScalarSelectWithoutCancellation,
      },
      eventTests: medicalEventByIdRelations.eventTests,
      verdict: medicalEventByIdRelations.verdict,
    },
  })

  if (!row) return null
  return withCancellationDefaults(row)
}
