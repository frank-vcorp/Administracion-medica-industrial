/**
 * @fileoverview Endpoint autenticado para descargar el PDF validado de
 *   Audiometría asociado a una `DoctorStudyReview`.
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 *
 * Comportamiento (paralelo a `/api/pdf/espirometry/[reviewId]`):
 *  - Sesión activa OBLIGATORIA (QA-20260825-01 P2-C).
 *  - Autorización por OBJETO (IDOR fix):
 *      · SUPERADMIN: cualquier revisión.
 *      · DOCTOR_GENERAL / DOCTOR_VALIDATOR: sólo revisiones cuya
 *        `reviewedByUserId === session.user.id`.
 *      · Cualquier otro rol: 403.
 *  - Si la revisión está en estado REVIEWED_REJECTED devuelve 404
 *    (no hay PDF y NO debe haberlo por contrato de la SPEC).
 *  - Fast-path sirviendo desde disco + path de regeneración en línea.
 *  - Devuelve 410 Gone si la revisión no tiene snapshot congelado.
 *  - Filename `Audiometria-<universalId>.pdf` consistente con el patrón
 *    `Dictamen-<universalId>.pdf` / `Espirometria-<universalId>.pdf`.
 *
 * REGLA SPEC §3:
 *   El PDF refleja la decisión del médico (`doctorDiagnosis`); NO copia
 *   el diagnóstico nosológico ni la recomendación textual del PDF AMI
 *   como salida IA. `buildAudiometriaPdfData` aplica esta separación.
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import {
  generateAudiometriaValidatedPdf,
  buildAudiometriaPdfData,
  resolveAmiLogoDataUrl,
} from '@/lib/audiometry-pdf'

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
  // Sesión obligatoria
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('No autenticado', { status: 401 })
  }
  const role = session.user.role
  if (!REVIEWER_ROLES.has(role)) {
    return new NextResponse('Sin permisos para descargar el PDF validado', {
      status: 403,
    })
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
      validatedPdfError: true,
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

  // Scope por objeto (IDOR fix). NO-SUPERADMIN sólo descarga SU PROPIA revisión.
  if (!isSuperAdmin && review.reviewedByUserId !== session.user.id) {
    return new NextResponse('Sin permisos para descargar este PDF', { status: 403 })
  }

  // SPEC: rechazo NO genera PDF.
  if (review.doctorStatus === 'REVIEWED_REJECTED') {
    return new NextResponse('Esta revisión fue rechazada y no tiene PDF validado.', {
      status: 404,
    })
  }

  const eventTest = review.prediagnosisSnapshot?.extractionSnapshot?.eventTest
  const universalId = eventTest?.event?.worker?.universalId ?? reviewId.slice(0, 8)
  const filename = `Audiometria-${universalId}.pdf`

  // Fast-path: servir desde disco si está persistido.
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
      console.warn(
        '[IMPL-FEATURE-20260825-02] No se pudo leer PDF persistido, regenerando en línea:',
        fsErr,
      )
    }
  }

  // Regeneración en línea: requiere snapshot congelado de identidad.
  if (
    !review.validatorSnapshotFullName ||
    !review.validatorSnapshotProfessionalLicense ||
    !review.validatorSnapshotSignatureUrl
  ) {
    return new NextResponse(
      'Esta revisión no tiene identidad congelada del médico; el PDF no puede regenerarse. Vuelve a aceptar/editar la revisión desde el panel.',
      { status: 410 },
    )
  }

  try {
    const worker = eventTest?.event?.worker
    const logoDataUrl = await resolveAmiLogoDataUrl()
    const data = buildAudiometriaPdfData({
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
      studyName: eventTest?.testNameSnapshot ?? null,
      studyType:
        review.prediagnosisSnapshot?.extractionSnapshot?.studyType ?? null,
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

    const result = await generateAudiometriaValidatedPdf({
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
        console.warn(
          '[IMPL-FEATURE-20260825-02] No se pudo persistir URL del PDF regenerado:',
          persistErr,
        )
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
    console.error('[IMPL-FEATURE-20260825-02] Error generando PDF en línea:', err)
    return new NextResponse('Error al regenerar el PDF validado.', { status: 500 })
  }
}