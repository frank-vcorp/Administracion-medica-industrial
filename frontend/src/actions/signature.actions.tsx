'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  renderDictamenInputToMemory,
  dictamenInputFileName,
  dictamenSignedFileName,
  dictamenBackendUrl,
} from '@/lib/dictamen-pdf'

/**
 * @id IMPL-20260225-03
 * @fix FIX-20260225-03
 *
 * Server Action para firmar un dictamen médico (PDF).
 *
 * IMPL-FEATURE-20260825-03 ronda 8 (FND-20260825-25 / DEC-20260825-21 /
 * BR-20260825-22): corrige el flujo completo para que NO se escriba
 * en el filesystem de Vercel (`/var/task/uploads/`, read-only). El
 * PDF de entrada se renderiza en memoria, se sube al backend Railway
 * vía `POST /api/v1/upload-only` con FormData + key basename segura,
 * y luego se firma vía `POST /api/v1/sign-pdf` con ese basename. El
 * resultado se persiste como `MedicalVerdict.pdfUrl = signedKey`
 * (basename) — la descarga legacy lo resuelve vía `GET /api/files/
 * {key}` del backend (redirección a URL presigned en S3 o stream
 * local).
 *
 * Pasos:
 *   1. Sesión activa OBLIGATORIA (auth). Sin sesión → 401.
 *   2. Resolver Event + Verdict + Estudios + Laboratorios + Validador
 *      desde Prisma (snapshot congelado).
 *   3. Validar que existe Verdict con `finalDiagnosis` y validador con
 *      `fullName` (identidad congelada).
 *   4. Renderizar `<MedicalDictamenPDF>` en memoria (sin disco).
 *   5. POST `/api/v1/upload-only` con FormData(`file=<Blob>`,
 *      `key=<inputBasename>`) → backend persiste.
 *   6. POST `/api/v1/sign-pdf` con `input_pdf=<inputBasename>` y
 *      `output_pdf=<outputBasename>` → backend firma y devuelve
 *      `output_pdf` (signedKey).
 *   7. Si el backend responde `success`, actualizar
 *      `MedicalVerdict.signatureHash`, `MedicalVerdict.pdfUrl =
 *      signedKey`, `MedicalVerdict.signedAt` y
 *      `MedicalEvent.status = COMPLETED`.
 *   8. Limpiar errores en logs; devolver `{success, ...}` a la UI.
 *
 * Guardrails:
 *   - No auto-firma antes del click: el flujo sólo se dispara al
 *     pulsar "Firmar y Emitir Dictamen" en `EventFlowController`.
 *   - No inventa identidad: `validator.fullName` se lee del User
 *     persistido en el Verdict (snapshot congelado por el flujo
 *     `saveVerdict`).
 *   - No toca Audiometría/Espirometría ni el endpoint AMI
 *     `/api/pdf/examen-medico/[eventId]`.
 *   - Sin escritura en filesystem (Vercel-safe).
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

    // 3. Renderizar el dictamen en MEMORIA (sin disco). Si el render
    // falla, NO seguimos (sería pasarle al firmador un buffer vacío).
    const nowMs = Date.now()
    const inputFileName = dictamenInputFileName(event.id, nowMs)
    const expectedSignedFileName = dictamenSignedFileName(event.id)

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await renderDictamenInputToMemory({
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
      })
    } catch (renderErr) {
      console.error(
        '[IMPL-FEATURE-20260825-03] Error renderizando el dictamen:',
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

    const backendUrl = dictamenBackendUrl()

    // 4. Subir el PDF temporal al backend (FND-20260825-25 /
    // DEC-20260825-21). FormData con Blob + key basename segura.
    const formData = new FormData()
    // `BlobPart` exige `Uint8Array | ArrayBuffer | Blob | string`. El
    // `Buffer` de Node es `Uint8Array`-compatible, pero TS puede quejarse
    // según versión; casteamos a `Uint8Array` explícito.
    formData.append(
      'file',
      new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }),
      inputFileName,
    )
    formData.append('key', inputFileName)

    let uploadResponse: Response
    try {
      uploadResponse = await fetch(`${backendUrl}/api/v1/upload-only`, {
        method: 'POST',
        // NO Content-Type — fetch lo genera automáticamente con el
        // boundary correcto para FormData.
        body: formData,
      })
    } catch (uploadNetErr) {
      console.error(
        '[IMPL-FEATURE-20260825-03] Error de red en upload-only:',
        uploadNetErr,
      )
      return {
        success: false,
        error:
          uploadNetErr instanceof Error
            ? `No se pudo contactar al backend para subir el PDF: ${uploadNetErr.message}`
            : 'No se pudo contactar al backend para subir el PDF.',
      }
    }

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}))
      return {
        success: false,
        error:
          errorData.error ||
          errorData.detail ||
          `Error del backend al subir PDF (${uploadResponse.status}): ${uploadResponse.statusText}`,
      }
    }

    const uploadResult = await uploadResponse.json()
    if (uploadResult.status && uploadResult.status !== 'success') {
      return {
        success: false,
        error:
          uploadResult.error ||
          uploadResult.message ||
          'El backend rechazó el upload del PDF',
      }
    }

    // 5. Llamar al firmador backend con los basenames canónicos.
    let signResponse: Response
    try {
      signResponse = await fetch(`${backendUrl}/api/v1/sign-pdf`, {
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
    } catch (signNetErr) {
      console.error(
        '[IMPL-FEATURE-20260825-03] Error de red llamando a /api/v1/sign-pdf:',
        signNetErr,
      )
      return {
        success: false,
        error:
          signNetErr instanceof Error
            ? `No se pudo contactar al firmador: ${signNetErr.message}`
            : 'No se pudo contactar al firmador.',
      }
    }

    if (!signResponse.ok) {
      const errorData = await signResponse.json().catch(() => ({}))
      return {
        success: false,
        error:
          errorData.error ||
          errorData.detail ||
          `Error del firmador (${signResponse.status}): ${signResponse.statusText}`,
      }
    }

    const result = await signResponse.json()

    if (result.status === 'success') {
      // 6. Persistir el snapshot firmado en `MedicalVerdict`.
      // `pdfUrl` apunta SOLO al basename (signedKey) — la descarga
      // legacy `/api/pdf/[eventId]` lo resuelve vía `GET /api/files/
      // {key}` del backend (redirección a S3 presigned o stream local).
      const signedKey =
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
          signatureHash: result.signature_hash || signedKey,
          pdfUrl: signedKey,
          signedAt: new Date(),
        },
      })

      revalidatePath('/portal/events')
      revalidatePath(`/events/${eventId}`)

      return {
        success: true,
        message: 'Dictamen firmado exitosamente',
        pdfUrl: `/api/pdf/${event.id}`,
        fileName: signedKey,
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