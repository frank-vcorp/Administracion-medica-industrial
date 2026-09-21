/**
 * PDF validado de electrocardiograma (post revisión médica).
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { buildEcgPdfDataAsync, generateEcgValidatedPdf } from '@/lib/ecg-pdf'
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
  if (studyType !== 'Electrocardiograma') {
    return new NextResponse('Esta revisión no corresponde a un electrocardiograma.', {
      status: 404,
    })
  }

  const eventTest = review.prediagnosisSnapshot?.extractionSnapshot?.eventTest
  const universalId = eventTest?.event?.worker?.universalId ?? reviewId.slice(0, 8)
  const filename = `Electrocardiograma-${universalId}.pdf`

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
      console.warn('[ecg-pdf] No se pudo leer PDF persistido, regenerando:', fsErr)
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
    const data = await buildEcgPdfDataAsync({
      reviewId: review.id,
      doctorStatus:
        review.doctorStatus === 'REVIEWED_ACCEPTED'
          ? 'REVIEWED_ACCEPTED'
          : 'REVIEWED_EDITED',
      doctorDiagnosis: review.doctorDiagnosis,
      doctorNotes: review.doctorNotes,
      reviewCreatedAt: review.validatedPdfGeneratedAt ?? review.createdAt,
      prediagnosisData: review.prediagnosisSnapshot?.prediagnosisData,
      extractionStructuredData:
        review.prediagnosisSnapshot?.extractionSnapshot?.structuredData,
      eventId: eventTest?.eventId ?? '',
      patient: {
        firstName: worker?.firstName ?? '',
        lastName: worker?.lastName ?? '',
        companyName: worker?.company?.name ?? null,
      },
      medico: {
        fullName: review.validatorSnapshotFullName,
        professionalLicense: review.validatorSnapshotProfessionalLicense,
        signatureImageUrl: review.validatorSnapshotSignatureUrl,
      },
      logoDataUrl,
    })

    const result = await generateEcgValidatedPdf({
      reviewId: review.id,
      data,
    })

    if (result.url && !review.validatedPdfUrl) {
      try {
        await prisma.doctorStudyReview.update({
          where: { id: review.id },
          data: {
            validatedPdfUrl: result.url,
            validatedPdfGeneratedAt: new Date(),
            validatedPdfHash: result.hash,
            validatedPdfError: null,
          },
        })
      } catch (persistErr) {
        console.warn('[ecg-pdf] No se pudo persistir URL regenerada:', persistErr)
      }
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (err) {
    console.error('[ecg-pdf] Error generando PDF en línea:', err)
    return new NextResponse('Error al regenerar el PDF validado.', { status: 500 })
  }
}
