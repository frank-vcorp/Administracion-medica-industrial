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
 *  - Al regenerar, «Realizó EM», la cédula y la firma salen del perfil
 *    de la cuenta en sesión. Sin cédula se imprime «—». Sin imagen de
 *    firma el espacio queda vacío. 410 si esa cuenta no tiene nombre.
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
  buildAudiometriaPdfDataAsync,
  resolveAmiLogoDataUrl,
} from '@/lib/audiometry-pdf'
import {
  ensureAudiometrySourceCrop,
  loadAudiometrySourceCrop,
  type AudiometrySourceCropResult,
} from '@/lib/audiometry-source-crop'
import { audiometrySignerFromAccount } from '@/lib/audiometry-signer'

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
      doctorRecommendations: true,
      createdAt: true,
      reviewedByUserId: true,
      validatedPdfUrl: true,
      validatedPdfGeneratedAt: true,
      validatedPdfError: true,
      prediagnosisSnapshot: {
        select: {
          prediagnosisData: true,
          extractionSnapshot: {
            select: {
              studyType: true,
              structuredData: true,
              eventTest: {
                select: {
                  id: true,
                  testNameSnapshot: true,
                  eventId: true,
                  clinicalContext: true,
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

  let cropMeta: AudiometrySourceCropResult | null = null
  if (eventTest?.id) {
    try {
      cropMeta = await ensureAudiometrySourceCrop(eventTest.id)
      if (!cropMeta?.previewDataUrl) {
        const loaded =
          cropMeta ? await loadAudiometrySourceCrop(cropMeta) : null
        if (!loaded) {
          cropMeta = await ensureAudiometrySourceCrop(eventTest.id, {
            force: true,
          })
        }
      }
    } catch (cropErr) {
      console.warn('[audiometry-pdf] Recorte fuente antes de PDF:', cropErr)
    }
  }
  const cropPreview = cropMeta?.previewDataUrl
    ? { dataUrl: cropMeta.previewDataUrl, aspectRatio: null as number | null }
    : cropMeta
      ? await loadAudiometrySourceCrop(cropMeta)
      : null
  const cropGeneratedAt = cropMeta?.generatedAt
    ? new Date(cropMeta.generatedAt)
    : null
  const pdfGeneratedAt =
    review.validatedPdfGeneratedAt ?? review.createdAt
  const pdfIncludesCrop =
    !!cropPreview &&
    !!cropGeneratedAt &&
    pdfGeneratedAt >= cropGeneratedAt

  // Fast-path: sólo si el PDF en disco ya incluye el recorte (posterior al PNG).
  if (review.validatedPdfUrl && pdfIncludesCrop) {
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

  // Quien genera esta copia es la cuenta de la sesión: nombre, cédula
  // y la imagen de firma de su perfil. Sin cédula se imprime «—».
  // Sin imagen, el espacio queda vacío.
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      fullName: true,
      professionalLicense: true,
      signatureImageUrl: true,
    },
  })
  const signer = audiometrySignerFromAccount(account)
  if (!signer) {
    return new NextResponse(
      'La cuenta que genera el PDF no tiene un nombre registrado.',
      { status: 410 },
    )
  }

  try {
    const worker = eventTest?.event?.worker
    const logoDataUrl = await resolveAmiLogoDataUrl()
    const data = await buildAudiometriaPdfDataAsync({
      reviewId: review.id,
      eventId: eventTest?.eventId ?? null,
      eventTestId: eventTest?.id ?? null,
      clinicalContext: eventTest?.clinicalContext,
      forceSourceCropRegenerate: true,
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
      studyType:
        review.prediagnosisSnapshot?.extractionSnapshot?.studyType ?? null,
      patient: {
        firstName: worker?.firstName ?? '',
        lastName: worker?.lastName ?? '',
        universalId: worker?.universalId ?? null,
        companyName: worker?.company?.name ?? null,
      },
      medico: signer,
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