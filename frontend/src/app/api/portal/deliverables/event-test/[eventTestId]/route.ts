import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  assertPortalEventTestAccess,
  isEventTestDeliverableReady,
} from '@/lib/portal-event-access'
import { findPortalDeliverableReviewForEventTest } from '@/lib/portal-deliverables'
import { resolveBackendFileUrl } from '@/lib/zip-cierre-clinico'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventTestId: string }> },
) {
  try {
    const { eventTestId } = await params
    await assertPortalEventTestAccess(eventTestId)

    const test = await prisma.eventTest.findUnique({
      where: { id: eventTestId },
      select: {
        status: true,
        fileUrl: true,
        testNameSnapshot: true,
      },
    })
    if (!test || !isEventTestDeliverableReady(test.status)) {
      return new NextResponse('Resultado aún no disponible', { status: 404 })
    }

    if (test.fileUrl?.trim()) {
      const target = resolveBackendFileUrl(test.fileUrl.trim(), BACKEND_URL.replace(/\/$/, ''))
      if (target) return NextResponse.redirect(target, 302)
    }

    const review = await findPortalDeliverableReviewForEventTest(eventTestId)
    if (review?.validatedPdfUrl?.trim()) {
      const target = resolveBackendFileUrl(review.validatedPdfUrl.trim(), BACKEND_URL.replace(/\/$/, ''))
      if (target) return NextResponse.redirect(target, 302)
    }

    return new NextResponse('Archivo no disponible para este estudio', { status: 404 })
  } catch {
    return new NextResponse('Sin permiso', { status: 403 })
  }
}
