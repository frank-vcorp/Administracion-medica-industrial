/**
 * @fileoverview Endpoint autenticado para descargar el PDF validado de
 *   Espirometría asociado a una `DoctorStudyReview`.
 * @id IMPL-FEATURE-20260825-01
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * Comportamiento:
 *  - Sesión activa OBLIGATORIA (QA-20260825-01 P2-C).
 *  - Autorización por OBJETO (IDOR fix):
 *      · SUPERADMIN: cualquier revisión.
 *      · DOCTOR_GENERAL / DOCTOR_VALIDATOR: sólo revisiones cuya
 *        `reviewedByUserId === session.user.id`.
 *      · Cualquier otro rol: 403.
 *  - Si la revisión está en estado REVIEWED_REJECTED devuelve 404
 *    (no hay PDF y NO debe haberlo por contrato de la SPEC).
 *  - Fast-path sirviendo desde disco + path de regeneración en línea con
 *    snapshot congelado. Devuelve 410 Gone si la revisión no tiene
 *    snapshot congelado (registros pre-incremento).
 *  - El filename sigue el patrón `Espirometria-<universalId>.pdf` para
 *    parear el patrón existente del dictamen (`Dictamen-<universalId>.pdf`).
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import {
  generateEspirometryValidatedPdf,
  buildEspirometryPdfData,
  resolveAmiLogoDataUrl,
} from '@/lib/espirometry-pdf'

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
  // QA-20260825-01 P2-C: sesión obligatoria + scope por objeto
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
    // 404 genérico para no enumerar revisiones.
    return new NextResponse('Recurso no disponible', { status: 404 })
  }

  // QA-20260825-01 P2-C: scope por objeto. NO-SUPERADMIN sólo descarga
  // SU PROPIA revisión (mismo médico que la emitió). Esto bloquea IDOR
  // horizontal: cualquier DOCTOR_* podía antes descargar cualquier PDF
  // clínico con sólo conocer el UUID.
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
  const filename = `Espirometria-${universalId}.pdf`

  // Fast-path: si el PDF fue persistido en disco, servir desde ahí.
  if (review.validatedPdfUrl) {
    try {
      // QA-20260825-01 P3-E: `validatedPdfUrl` se persiste sin prefijo
      // `uploads/` (porque `REPO_UPLOAD_DIR` ya es `<repo>/uploads/`). El
      // join es directo, sin duplicación.
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
        `[IMPL-FEATURE-20260825-01] No se pudo leer PDF persistido ${review.validatedPdfUrl}, regenerando en línea:`,
        fsErr,
      )
      // caer al path de regeneración
    }
  }

  // Regeneración en línea: requiere snapshot congelado de identidad. Si falta
  // (registro creado en una versión anterior sin los campos), no se puede
  // generar y se devuelve 410 Gone con mensaje explícito.
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
    // QA-20260825-01 P3-G: cache en memoria (resuelve UNA vez por proceso).
    const logoDataUrl = await resolveAmiLogoDataUrl()
    // QA-20260825-01 P3-F: helper puro compartido action/route → mismo
    // contenido → mismo hash.
    const data = buildEspirometryPdfData({
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

    const result = await generateEspirometryValidatedPdf({ reviewId: review.id, data })

    // Si el archivo quedó persistido en este intento y validatedPdfUrl aún
    // estaba vacío, lo actualizamos para acelerar la próxima descarga.
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
          '[IMPL-FEATURE-20260825-01] No se pudo persistir URL del PDF regenerado:',
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
    console.error('[IMPL-FEATURE-20260825-01] Error generando PDF en línea:', err)
    return new NextResponse('Error al regenerar el PDF validado.', { status: 500 })
  }
}
