import prisma from '@/lib/prisma'

const APPROVED_REVIEW_STATUSES = ['REVIEWED_ACCEPTED', 'REVIEWED_EDITED'] as const

export async function findPortalDeliverableReviewForEventTest(eventTestId: string) {
  return prisma.doctorStudyReview.findFirst({
    where: {
      doctorStatus: { in: [...APPROVED_REVIEW_STATUSES] },
      prediagnosisSnapshot: {
        extractionSnapshot: { eventTestId },
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      validatedPdfUrl: true,
    },
  })
}
