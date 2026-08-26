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
  deriveEventShortId,
} from '@/lib/dictamen-pdf'
import { findSiblingEventsInAtencion } from '@/lib/event-atencion'
import {
  buildDictamenGeneralAmiConsolidado,
  hasConsolidation,
} from '@/lib/dictamen-general-ami'
import {
  buildExamenMedicoPdfData,
  generateExamenMedicoValidatedPdf,
} from '@/lib/examen-medico-pdf'

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

    // 2.B IMPL-20260826-06 (DEC-20260826-01 / BR-20260826-01):
    // Resolver los Events hermanos de la misma atención/cita para
    // consolidar hallazgos en el PDF firmado. Defensa: si la cita tiene
    // sólo el Event actual (schema @unique actual), la lista
    // contendrá únicamente este Event — el render del PDF mostrará
    // un único bloque marcado como `ACTUAL` y la sección III.B
    // seguirá presente (no inventamos datos).
    const atencionResolution = await findSiblingEventsInAtencion(
      event.id,
      prisma,
    )
    const siblingEventIds = atencionResolution.eventIds.filter(
      (id) => id !== event.id,
    )
    const siblingEventsData = siblingEventIds.length > 0
      ? await prisma.medicalEvent.findMany({
          where: { id: { in: siblingEventIds } },
          select: {
            id: true,
            studies: {
              select: {
                serviceName: true,
                extractedData: true,
              },
            },
            labs: {
              select: {
                serviceName: true,
                extractedData: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        })
      : []
    // Bloques para el renderer: primero el actual, luego los hermanos
    // en orden cronológico.
    const consolidatedBlocks = [
      {
        eventId: event.id,
        eventShortId: deriveEventShortId(event.id),
        isCurrent: true,
        studies: (event.studies ?? []).map((s) => ({
          serviceName: s.serviceName,
          extractedData: s.extractedData,
        })),
        labs: (event.labs ?? []).map((l) => ({
          serviceName: l.serviceName,
          extractedData: l.extractedData,
        })),
      },
      ...siblingEventsData.map((s) => ({
        eventId: s.id,
        eventShortId: deriveEventShortId(s.id),
        isCurrent: false,
        studies: (s.studies ?? []).map((st) => ({
          serviceName: st.serviceName,
          extractedData: st.extractedData,
        })),
        labs: (s.labs ?? []).map((lb) => ({
          serviceName: lb.serviceName,
          extractedData: lb.extractedData,
        })),
      })),
    ]

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
          // IMPL-20260826-06: bloques de hallazgos por atención/cita.
          consolidatedEvents: consolidatedBlocks,
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

/**
 * @id IMPL-20260826-08 (FIX FND-20260826-03)
 * @finding discovery/FINDINGS.md FND-20260826-03
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-17
 * @businessRule discovery/BUSINESS-RULES.md BR-20260826-01
 * @businessRule discovery/BUSINESS-RULES.md BR-20260826-02
 * @backup context/SPECs/SPEC-FEATURE-20260826-01-EVENTS-POR-ATENCION.md
 *
 * Server Action para **re-emitir explícitamente** el dictamen general
 * firmado usando el renderer AMI vigente
 * (`ExamenMedicoValidatedPDF` / SPEC FEATURE-20260825-03) en lugar de
 * `MedicalDictamenPDF` (renderer simplificado que se usó en la firma
 * original).
 *
 * Caso de uso (FND-20260826-03):
 *   El usuario descarga un PDF antiguo (firmado con
 *   `MedicalDictamenPDF` o con un layout pre-AMI) porque
 *   `MedicalVerdict.pdfUrl` apunta al `signedKey` de la firma original
 *   sin regenerar el artefacto. Esta action genera una versión
 *   fresca con el renderer AMI, conservando el acto de firma (la
 *   identidad del médico, la fecha de firma original se preserva en
 *   `MedicalVerdict.signedAt`) y RE-APLICANDO la firma digital sobre
 *   el nuevo PDF. El `signedKey` anterior queda obsoleto en S3 (la UI
 *   debe mostrar explícitamente que la versión descargable fue
 *   sustituida).
 *
 * Garantías (FND-20260826-03 / DEC-20260826-01):
 *   - NO inventa datos: usa el snapshot persistido de `MedicalEvent`,
 *     `MedicalExam`, `MedicalVerdict`, `EventTest`, `LabRecord`,
 *     `User` (validator).
 *   - Conserva la identidad del firmante (NO crea un médico ficticio).
 *   - Genera un nuevo `signedKey` (`dictamen-<eventId>-reemit-<ts>.pdf`)
 *     para que `MedicalVerdict.pdfUrl` apunte al artefacto actualizado.
 *   - Sólo accesible para roles clínicos (SUPERADMIN, DOCTOR_GENERAL,
 *     DOCTOR_VALIDATOR). COMPANY_CLIENT NO puede re-emitir (es read-only
 *     en el portal corporativo — FND-20260825-18 / P1-2).
 *   - El ZIP de cierre clínico (`/api/zip/clinical-closure/[eventId]`)
 *     usa EXACTAMENTE el mismo helper (`buildDictamenGeneralAmiConsolidado`)
 *     para que el dictamen general del PDF y del ZIP estén consolidados
 *     por los mismos Events hermanos del mismo `appointmentId + workerId`.
 */
export interface ReemitSignedDictamenResult {
  success: boolean
  /** Mensaje explícito para la UI: "Esta versión sustituye a la anterior". */
  message?: string
  /** Nuevo basename firmado (sustituye a `previousSignedKey`). */
  fileName?: string
  /** URL del endpoint para descargar el nuevo PDF. */
  pdfUrl?: string
  /** Fecha/hora del nuevo acto de firma. */
  reemittedAt?: Date
  /** basename firmado anterior (para que la UI muestre lo que sustituyó). */
  previousSignedKey?: string | null
  /** Si hubo consolidación por cita, cuántos Events hermanos incluye. */
  siblingCount?: number
  error?: string
}

export async function reemitSignedDictamen(
  eventId: string,
): Promise<ReemitSignedDictamenResult> {
  try {
    // ── 1) Sesión OBLIGATORIA + gate de rol clínico ─────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { success: false, error: 'No autorizado' }
    }
    const role = session.user.role
    const isClinical =
      role === 'SUPERADMIN' ||
      role === 'DOCTOR_GENERAL' ||
      role === 'DOCTOR_VALIDATOR'
    if (!isClinical) {
      return {
        success: false,
        error: 'Sin permisos para re-emitir el dictamen general.',
      }
    }

    // ── 2) Construir el payload AMI consolidado (mismo que el ZIP). ──────
    // Esta helper ya valida la existencia del Event + Verdict +
    // Validador con `fullName`. Lanza Error si falta algo.
    let consolidado
    try {
      consolidado = await buildDictamenGeneralAmiConsolidado(eventId, prisma)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      return { success: false, error: msg }
    }

    if (!consolidado.verdict) {
      return {
        success: false,
        error: 'No hay Verdict previo para re-emitir.',
      }
    }
    if (!consolidado.verdict.pdfUrl) {
      return {
        success: false,
        error:
          'El Verdict no tiene `pdfUrl`. No se puede re-emitir (¿el dictamen nunca fue firmado?).',
      }
    }
    const previousSignedKey = consolidado.verdict.pdfUrl

    // ── 3) Renderizar el PDF en MEMORIA (sin tocar disco). ──────────────
    let buffer: Buffer
    try {
      const result = await generateExamenMedicoValidatedPdf({
        data: buildExamenMedicoPdfData(consolidado.data),
        eventId,
      })
      buffer = result.buffer
    } catch (renderErr) {
      console.error(
        '[IMPL-20260826-08] Error renderizando dictamen general consolidado:',
        renderErr,
      )
      return {
        success: false,
        error: 'No se pudo generar el PDF del dictamen consolidado.',
      }
    }

    // ── 4) POST /api/v1/upload-only con basename reemit. ─────────────────
    const nowMs = Date.now()
    const inputFileName = `dictamen-${eventId}-reemit-${nowMs}-input.pdf`
    const expectedSignedFileName = `dictamen-${eventId}-reemit-${nowMs}-signed.pdf`

    const backendUrl = dictamenBackendUrl()

    let uploadResponse: Response
    try {
      const formData = new FormData()
      // Blob con ArrayBuffer para máxima compat con fetch de Node/Edge.
      formData.append(
        'file',
        new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
        inputFileName,
      )
      formData.append('key', inputFileName)

      uploadResponse = await fetch(`${backendUrl}/api/v1/upload-only`, {
        method: 'POST',
        body: formData,
      })
    } catch (uploadNetErr) {
      console.error(
        '[IMPL-20260826-08] Error de red llamando a /api/v1/upload-only:',
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
          'El backend rechazó el upload del PDF.',
      }
    }

    // ── 5) POST /api/v1/sign-pdf con el basename reemit. ────────────────
    let signResponse: Response
    try {
      signResponse = await fetch(`${backendUrl}/api/v1/sign-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_pdf: inputFileName,
          output_pdf: expectedSignedFileName,
          reason: 'Re-emisión Dictamen General AMI',
          password: process.env.PDF_SIGN_PASSWORD || 'default1234',
        }),
      })
    } catch (signNetErr) {
      console.error(
        '[IMPL-20260826-08] Error de red llamando a /api/v1/sign-pdf:',
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

    const signResult = await signResponse.json()
    if (signResult.status !== 'success') {
      return {
        success: false,
        error:
          signResult.error ||
          signResult.message ||
          'El firmador rechazó la re-emisión.',
      }
    }

    const signedKey =
      typeof signResult.output_pdf === 'string' && signResult.output_pdf.length > 0
        ? signResult.output_pdf
        : expectedSignedFileName

    // ── 6) Actualizar MedicalVerdict con el nuevo signedKey. ─────────────
    // El `signedAt` se actualiza al momento de la re-emisión (acto de
    // firma explícito). El validator.fullName NO se modifica — se
    // preserva del Verdict original (no se inventa un médico).
    const reemittedAt = new Date()

    await prisma.medicalVerdict.update({
      where: { eventId },
      data: {
        signatureHash: signResult.signature_hash || signedKey,
        pdfUrl: signedKey,
        signedAt: reemittedAt,
      },
    })

    revalidatePath('/portal/events')
    revalidatePath(`/events/${eventId}`)

    return {
      success: true,
      message:
        'Re-emisión exitosa con el renderer AMI vigente. Esta versión sustituye a la anterior versión descargable.',
      fileName: signedKey,
      pdfUrl: `/api/pdf/${eventId}`,
      reemittedAt,
      previousSignedKey,
      siblingCount: hasConsolidation(consolidado.atencionResolution)
        ? consolidado.atencionResolution.eventIds.length
        : 1,
    }
  } catch (error) {
    console.error('[IMPL-20260826-08] Error en reemitSignedDictamen:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}