'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  renderDictamenInputToDisk,
  dictamenInputFileName,
  dictamenSignedFileName,
} from '@/lib/dictamen-pdf'

/**
 * @id IMPL-20260225-03
 * @fix FIX-20260225-03
 * Server Action para firmar un dictamen médico (PDF).
 *
 * IMPL-FEATURE-20260825-03 ronda 7 (FND-20260825-24):
 * corrige el flujo completo para que el PDF de entrada exista antes
 * de llamar al firmador backend (`/api/v1/sign-pdf`). Pasos:
 *   1. Sesión activa OBLIGATORIA (auth). Sin sesión → 401.
 *   2. Resolver Event + Verdict + Estudios + Laboratorios + Validador
 *      desde Prisma (snapshot congelado).
 *   3. Validar que existe Verdict con `finalDiagnosis` persistido.
 *   4. Renderizar `<MedicalDictamenPDF>` con `renderToBuffer`.
 *   5. Escribir el PDF de entrada al directorio compartido con el
 *      backend (`<repo>/uploads/dictamen-<eventId>-<ts>.pdf`).
 *   6. POST a `/api/v1/sign-pdf` con `input_pdf=<basename>` y
 *      `output_pdf=<basename>` (el backend rechaza path traversal).
 *   7. Si el backend responde `success`, actualizar
 *      `MedicalVerdict.signatureHash`, `MedicalVerdict.pdfUrl`,
 *      `MedicalVerdict.signedAt` y `MedicalEvent.status = COMPLETED`.
 *      NO se toca `MedicalExam.physicalExamData` ni otros snapshots.
 *   8. Limpiar errores en logs; devolver `{success, ...}` a la UI.
 *
 * Guardrails:
 *   - No auto-firma antes del click: el flujo sólo se dispara al
 *     pulsar "Firmar y Emitir Dictamen" en `EventFlowController`.
 *   - No inventa identidad: `validator.fullName` se lee del User
 *     persistido en el Verdict (snapshot congelado por el flujo
 *     `saveVerdict`).
 *   - No toca Audiometría/Espirometría ni el endpoint
 *     `/api/pdf/[eventId]` (legacy) ni la nueva AMI
 *     `/api/pdf/examen-medico/[eventId]`.
 *   - Sin cambios en schema Prisma.
 */
export async function signMedicalDictamPDF(eventId: string) {
  try {
    // 1. Sesión activa OBLIGATORIA (sin auto-firma).
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    // 2. Resolver Event + Verdict + Validador + Estudios + Labs.
    const event = await prisma.medicalEvent.findUnique({
      where: { id: eventId },
      include: {
        worker: {
          select: {
            firstName: true,
            lastName: true,
            universalId: true,
            dob: true,
            nationalId: true,
            company: { select: { name: true } },
          },
        },
        branch: {
          select: {
            name: true,
            address: true,
          },
        },
        studies: {
          select: {
            serviceName: true,
            aiPrediction: true,
            extractedData: true,
          },
        },
        labs: {
          select: {
            serviceName: true,
            aiPrediction: true,
            extractedData: true,
          },
        },
        verdict: {
          select: {
            id: true,
            finalDiagnosis: true,
            recommendations: true,
            createdAt: true,
            signedAt: true,
            signatureHash: true,
            pdfUrl: true,
            validatorId: true,
            validator: {
              select: {
                id: true,
                fullName: true,
                professionalLicense: true,
                signatureImageUrl: true,
              },
            },
          },
        },
      },
    })

    if (!event) {
      return {
        success: false,
        error: 'Evento no encontrado',
      }
    }

    if (!event.verdict) {
      return {
        success: false,
        error: 'No hay dictamen para firmar',
      }
    }

    if (!event.verdict.validator?.fullName) {
      return {
        success: false,
        error: 'El médico firmante no tiene identidad registrada.',
      }
    }

    // 3. Renderizar el dictamen general y escribirlo al directorio
    // compartido con el backend. Antes de este fix el nombre del
    // archivo se construía pero NUNCA se escribía → 404.
    const nowMs = Date.now()
    const inputFileName = dictamenInputFileName(event.id, nowMs)
    const expectedSignedFileName = dictamenSignedFileName(event.id)

    try {
      // IMPL-FEATURE-20260825-03 ronda 7 (FND-20260825-24): el render es
      // obligatorio. Si el FS es read-only o el helper falla, NO
      // llamamos al firmador (eso era el bug original: input inexistente
      // → 404).
      await renderDictamenInputToDisk({
        payload: {
          eventId: event.id,
          verdictId: event.verdict.id,
          signedAt: event.verdict.signedAt ?? new Date(),
          worker: {
            firstName: event.worker.firstName,
            lastName: event.worker.lastName,
            universalId: event.worker.universalId,
            nationalId: event.worker.nationalId ?? null,
          },
          company: event.worker.company
            ? { name: event.worker.company.name ?? 'Independiente' }
            : null,
          finalDiagnosis: event.verdict.finalDiagnosis,
          recommendations: event.verdict.recommendations ?? null,
          validator: {
            fullName: event.verdict.validator.fullName,
          },
          studies: (event.studies ?? []).map((s) => ({
            serviceName: s.serviceName,
            extractedData: s.extractedData,
          })),
          labs: (event.labs ?? []).map((l) => ({
            serviceName: l.serviceName,
            extractedData: l.extractedData,
          })),
        },
        nowMs,
        inputFileName,
      })
    } catch (renderErr) {
      // IMPL-FEATURE-20260825-03 ronda 7: este try/catch es la
      // diferencia clave vs. el bug FND-20260825-24. Antes el código
      // seguía y llamaba al firmador con un input inexistente.
      console.error(
        '[IMPL-FEATURE-20260825-03] Error renderizando/escribiendo el dictamen:',
        renderErr,
      )
      return {
        success: false,
        error:
          renderErr instanceof Error
            ? `No se pudo generar el PDF del dictamen: ${renderErr.message}`
            : 'No se pudo generar el PDF del dictamen.',
      }
    }

    // 4. Llamar al backend para firmar. El backend (`/api/v1/sign-pdf`)
    // lee el archivo desde `/uploads/<basename>` (montado como
    // `<repo>/uploads/` en Docker).
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    let response: Response
    try {
      response = await fetch(`${backendUrl}/api/v1/sign-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_pdf: inputFileName,
          output_pdf: expectedSignedFileName,
          reason: 'Dictamen Médico AMI',
          password: process.env.PDF_SIGN_PASSWORD || 'default1234',
        }),
      })
    } catch (fetchErr) {
      console.error(
        '[IMPL-FEATURE-20260825-03] Error de red llamando a /api/v1/sign-pdf:',
        fetchErr,
      )
      return {
        success: false,
        error:
          fetchErr instanceof Error
            ? `No se pudo contactar al firmador: ${fetchErr.message}`
            : 'No se pudo contactar al firmador.',
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // El backend ya tiene los códigos de error:
      //   404 = input PDF no existe
      //   500 = fallo del firmador
      // El detalle viene en `errorData.error` o `errorData.detail`.
      return {
        success: false,
        error:
          errorData.error ||
          errorData.detail ||
          `Error del firmador (${response.status}): ${response.statusText}`,
      }
    }

    const result = await response.json()

    if (result.status === 'success') {
      // 5. Persistir el snapshot firmado en `MedicalVerdict`.
      // `pdfUrl` apunta SOLO al basename (sin prefijo `uploads/`):
      // la ruta legacy `/api/pdf/[eventId]` lee `path.join(<repo>/uploads, verdict.pdfUrl)`.
      const signedFileName =
        typeof result.output_pdf === 'string' && result.output_pdf.length > 0
          ? result.output_pdf
          : expectedSignedFileName

      await prisma.medicalEvent.update({
        where: { id: eventId },
        data: {
          status: 'COMPLETED',
        },
      })

      await prisma.medicalVerdict.update({
        where: { eventId },
        data: {
          signatureHash: result.signature_hash || signedFileName,
          pdfUrl: signedFileName,
          signedAt: new Date(),
        },
      })

      revalidatePath('/portal/events')
      revalidatePath(`/events/${eventId}`)

      return {
        success: true,
        message: 'Dictamen firmado exitosamente',
        pdfUrl: `/api/pdf/${event.id}`,
        fileName: signedFileName,
      }
    }

    return {
      success: false,
      error: result.error || result.message || 'Error al firmar',
    }
  } catch (error) {
    console.error('Error en signMedicalDictamPDF:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * @id IMPL-20260225-03
 * Server Action para obtener un PDF de dictamen
 * Usado por el endpoint de descarga
 */
export async function getMedicalDictamPDF(eventId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return {
        success: false,
        error: 'No autorizado'
      }
    }

    const event = await prisma.medicalEvent.findUnique({
      where: { id: eventId },
      include: {
        worker: { select: { companyId: true } },
        verdict: true
      }
    })

    if (!event) {
      return { success: false, error: 'Evento no encontrado' }
    }

    // Validar que el usuario pertenece a la empresa del trabajador
    if (
      session.user.role === 'COMPANY_CLIENT' &&
      event.worker.companyId !== session.user.companyId
    ) {
      return { success: false, error: 'No autorizado' }
    }

    if (!event.verdict?.pdfUrl) {
      return { success: false, error: 'Dictamen no firmado' }
    }

    return {
      success: true,
      eventId: event.id,
      fileName: `dictamen-${event.id}.pdf`,
      pdfPath: event.verdict.pdfUrl
    }
  } catch (error) {
    console.error('Error en getMedicalDictamPDF:', error)
    return { success: false, error: 'Error al obtener PDF' }
  }
}