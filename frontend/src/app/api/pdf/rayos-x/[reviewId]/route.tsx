/**
 * Endpoint autenticado para descargar el PDF validado de Interpretación de Rayos X.
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import {
  buildRayosXPdfDataAsync,
  generateRayosXValidatedPdf,
} from '@/lib/rayos-x-pdf'
import { resolveAmiLogoDataUrl } from '@/lib/ami-brand'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

const REVIEWER_ROLES = new Set<string>([
  'SUPERADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('No autenticado', { status: 401 })
  }
  const role = session.user.role
  if (!REVIEWER_ROLES.has(role)) {
    return new NextResponse('Sin permisos para descargar el PDF validado', { status: 403 })
  }
  const isSuperAdmin = role === 'SUPERADMIN'

  const { reviewId } = await params
  if (!reviewId) {
    return new NextResponse('reviewId requerido', { status: 400 })
  }

  const review = await prisma.doctorStudyReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      doctorStatus: true,
      doctorDiagnosis: true,
      doctorNotes: true,
      doctorRecommendations: true,
      createdAt: true,
      reviewedByUserId: true,
      validatedPdfUrl: true,
      validatedPdfGeneratedAt: true,
      validatorSnapshotFullName: true,
      validatorSnapshotProfessionalLicense: true,
      validatorSnapshotSignatureUrl: true,
      prediagnosisSnapshot: {
        select: {
          prediagnosisData: true,
          extractionSnapshot: {
            select: {
              studyType: true,
              structuredData: true,
              eventTest: {
                select: {
                  testNameSnapshot: true,
                  eventId: true,
                  event: {
                    select: {
                      worker: {
                        select: {
                          firstName: true,
                          lastName: true,
                          universalId: true,
                          company: { select: { name: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!review) {
    return new NextResponse('Recurso no disponible', { status: 404 })
  }

  if (!isSuperAdmin && review.reviewedByUserId !== session.user.id) {
    return new NextResponse('Sin permisos para descargar este PDF', { status: 403 })
  }

  if (review.doctorStatus === 'REVIEWED_REJECTED') {
    return new NextResponse('Esta revisión fue rechazada y no tiene PDF validado.', {
      status: 404,
    })
  }

  const studyType = review.prediagnosisSnapshot?.extractionSnapshot?.studyType ?? ''
  if (studyType !== 'Rayos_X') {
    return new NextResponse('Esta revisión no corresponde a un estudio de Rayos X.', {
      status: 404,
    })
  }

  const eventTest = review.prediagnosisSnapshot?.extractionSnapshot?.eventTest
  const universalId = eventTest?.event?.worker?.universalId ?? reviewId.slice(0, 8)
  const filename = `RayosX-${universalId}.pdf`

  if (review.validatedPdfUrl) {
    try {
      const filePath = path.join(REPO_UPLOAD_DIR, review.validatedPdfUrl)
      const buffer = await readFile(filePath)
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Cache-Control': 'private, max-age=300',
        },
      })
    } catch (fsErr) {
      console.warn('[rayos-x-pdf] No se pudo leer PDF persistido, regenerando:', fsErr)
    }
  }

  if (
    !review.validatorSnapshotFullName ||
    !review.validatorSnapshotProfessionalLicense ||
    !review.validatorSnapshotSignatureUrl
  ) {
    return new NextResponse(
      'Esta revisión no tiene identidad congelada del médico; el PDF no puede regenerarse.',
      { status: 410 },
    )
  }

  try {
    const worker = eventTest?.event?.worker
    const logoDataUrl = await resolveAmiLogoDataUrl()
    const data = await buildRayosXPdfDataAsync({
      reviewId: review.id,
      doctorStatus:
        review.doctorStatus === 'REVIEWED_ACCEPTED'
          ? 'REVIEWED_ACCEPTED'
          : 'REVIEWED_EDITED',
      doctorDiagnosis: review.doctorDiagnosis,
      doctorNotes: review.doctorNotes,
      doctorRecommendations: review.doctorRecommendations,
      reviewCreatedAt: review.validatedPdfGeneratedAt ?? review.createdAt,
      prediagnosisData: review.prediagnosisSnapshot?.prediagnosisData,
      extractionStructuredData:
        review.prediagnosisSnapshot?.extractionSnapshot?.structuredData,
      studyName: eventTest?.testNameSnapshot ?? null,
      eventId: eventTest?.eventId ?? '',
      patient: {
        firstName: worker?.firstName ?? '',
        lastName: worker?.lastName ?? '',
        universalId: worker?.universalId ?? null,
        companyName: worker?.company?.name ?? null,
      },
      medico: {
        fullName: review.validatorSnapshotFullName,
        professionalLicense: review.validatorSnapshotProfessionalLicense,
        signatureImageUrl: review.validatorSnapshotSignatureUrl,
      },
      logoDataUrl,
    })
    const result = await generateRayosXValidatedPdf({
      reviewId: review.id,
      data,
    })

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (err) {
    console.error('[rayos-x-pdf] Error al generar PDF:', err)
    return new NextResponse('No se pudo generar el PDF de Rayos X.', { status: 500 })
  }
}
