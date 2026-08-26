/**
 * @fileoverview Generador server-side del PDF del dictamen general
 *   (MedicalDictamenPDF), builder del payload y nombres canónicos.
 *
 * @id IMPL-FEATURE-20260825-03 (ronda 8 / FND-20260825-25)
 * @finding discovery/FINDINGS.md FND-20260825-25
 * @decision discovery/DECISIONS.md DEC-20260825-21
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-22
 *
 * IMPLEMENTATION_DEFECT observado en producción (FND-20260825-25):
 * la ronda 7 escribía el PDF temporal con `writeFile` en
 * `<repo>/uploads/`, lo que funcionaba en local pero rompía en
 * Vercel (`EROFS: read-only file system, open '/var/task/uploads/...'`).
 * Vercel y Railway no comparten filesystem; el flujo de firma debe
 * pasar por el contrato oficial del firmador:
 *
 *   1. Renderizar el PDF en memoria (`renderToBuffer`).
 *   2. POST `/api/v1/upload-only` con `FormData(file=<Blob>, key=<basename>)`
 *      → backend persiste en su storage (local o S3, irrelevante
 *      para el frontend).
 *   3. POST `/api/v1/sign-pdf` con `input_pdf=<basename>` y
 *      `output_pdf=<basename>` → backend firma y devuelve `output_pdf`
 *      (signedKey).
 *   4. La descarga legacy se resuelve vía `/api/files/{key}` del
 *      backend (redirección a URL presigned en S3 o stream local).
 *
 * Este módulo NO escribe a disco. NO depende de `process.cwd()`.
 *
 * Patrón (paralelo a `examen-medico-pdf.tsx`, `espirometry-pdf.tsx`,
 * `audiometry-pdf.tsx`): helpers puros exportados + función async que
 * hace IO en memoria. El caller (`signature.actions.tsx`) orquesta
 * el flujo completo: helper → upload-only → sign-pdf → persist
 * `MedicalVerdict.pdfUrl` (con la key firmada devuelta por el
 * backend).
 *
 * Guardrails:
 *   - No auto-decide aptitud ni firma: sólo renderiza el dictamen
 *     previamente persistido en `MedicalVerdict`.
 *   - Mantiene identidad congelada: el `validator.fullName` viene del
 *     snapshot de la sesión + User del Verdict (no inventa identidad).
 *   - NO toca Audiometría/Espirometría.
 *   - Sin cambios en schema Prisma.
 *   - Sin escritura en filesystem (Vercel-safe).
 */
import { renderToBuffer } from '@react-pdf/renderer'
import { MedicalDictamenPDF } from '@/components/pdf/MedicalDictamenPDF'

/**
 * URL base del backend (Railway). Configurable vía
 * `NEXT_PUBLIC_API_URL` (paridad con el resto del frontend).
 * Fallback a localhost:8000 sólo para entornos de desarrollo local
 * — en producción Vercel SIEMPRE se inyecta esta variable.
 */
export function dictamenBackendUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
}

// ──────────────────────────────────────────────────────────────────────────
// Tipos del builder
// ──────────────────────────────────────────────────────────────────────────

/**
 * Snapshot mínimo del evento + veredicto que necesita el helper para
 * construir el payload del PDF. Lo resuelve la server action desde
 * Prisma (sin acoplar el helper al cliente Prisma).
 */
export interface BuildDictamenPayloadInput {
  /** ID del evento (también sirve como semilla del folio). */
  eventId: string
  /** ID del verdict (aparece como `Certificado Digital` en el PDF). */
  verdictId: string
  /** Fecha de firma / emisión del dictamen. */
  signedAt: Date | string
  /** Trabajador. */
  worker: {
    firstName: string
    lastName: string
    universalId: string
    /** ID nacional (RFC/DNI/etc) — opcional, no usado por el PDF. */
    nationalId?: string | null
  }
  /** Empresa (opcional). */
  company?: { name: string } | null
  /** Diagnóstico final persistido. */
  finalDiagnosis: string
  /** Recomendaciones persistidas (opcional). */
  recommendations?: string | null
  /** Identidad del validador (snapshot congelado al firmar). */
  validator: { fullName: string }
  /** Estudios auxiliares (Audiometría, Espirometría, RX, etc.). */
  studies?: Array<{ serviceName: string; extractedData?: unknown | null }>
  /** Laboratorios. */
  labs?: Array<{ serviceName: string; extractedData?: unknown | null }>
  /**
   * IMPL-20260826-06 (DEC-20260826-01 / BR-20260826-01):
   * Bloques de hallazgos por cada Event de la misma atención/cita.
   * Si se omite, el PDF conserva el comportamiento legacy (un único
   * Event). El orquestador (server action o ZIP builder) los construye
   * usando `findSiblingEventsInAtencion` y un `select` Prisma sobre
   * cada Event hermano. Cada bloque incluye su propio `isCurrent`
   * para que el renderer pueda marcar el Event firmado.
   *
   * NO se inventa: cada bloque sólo contiene los estudios/labs
   * presentes en el snapshot del Event correspondiente.
   */
  consolidatedEvents?: Array<{
    eventId: string
    eventShortId: string
    isCurrent: boolean
    studies?: Array<{ serviceName: string; extractedData?: unknown | null }>
    labs?: Array<{ serviceName: string; extractedData?: unknown | null }>
  }>
}

/**
 * IMPL-20260826-06: Helper puro que normaliza un `eventId` a un
 * identificador legible de 8 caracteres para el renderer. Se usa
 * para evitar mostrar UUIDs completos en el PDF.
 */
export function deriveEventShortId(eventId: string): string {
  if (!eventId || typeof eventId !== 'string') return ''
  return eventId.split('-')[0]?.toUpperCase() ?? ''
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers puros — testeables sin DOM ni FS ni red
// ──────────────────────────────────────────────────────────────────────────

/**
 * Construye el nombre canónico del PDF temporal de entrada (sin
 * firmar). El backend (`/api/v1/upload-only`) acepta la key como
 * basename sin path traversal (defensa en `os.path.basename` y en
 * `safe_key.startswith("/")` / `".." in safe_key.split("/")`).
 *
 * Formato: `dictamen-<eventId>-<timestampMs>.pdf`. El timestamp
 * garantiza unicidad cuando se firman varios eventos concurrentes.
 */
export function dictamenInputFileName(eventId: string, nowMs: number): string {
  return `dictamen-${sanitizeEventId(eventId)}-${nowMs}.pdf`
}

/**
 * Construye el nombre canónico del PDF firmado (salida). Lo devuelve
 * el backend en `result.output_pdf`; aquí se usa como fallback.
 */
export function dictamenSignedFileName(eventId: string): string {
  return `dictamen-${sanitizeEventId(eventId)}-signed.pdf`
}

/**
 * Defensa en profundidad: `eventId` debe ser un identificador "seguro"
 * (UUID, ULID, CUID2 o slug alfanumérico corto). Si trae caracteres
 * raros (`..`, `/`, `\`, `\0`, espacios), se colapsa al placeholder
 * `invalid-event-id`. Esto previene path traversal en
 * `os.path.basename(...)` del backend cuando un atacante controle el
 * `eventId`.
 */
export function sanitizeEventId(eventId: string): string {
  if (typeof eventId !== 'string') return 'invalid-event-id'
  // Sólo letras, dígitos, guion y guion bajo. Longitud 1-64.
  const safe = eventId.replace(/[^A-Za-z0-9_-]/g, '')
  if (safe.length === 0 || safe.length > 64) return 'invalid-event-id'
  return safe
}

/**
 * Builder puro del payload que necesita `<MedicalDictamenPDF data={...}>`.
 * Concentrarlo aquí permite reutilizar desde la server action.
 */
export function buildDictamenPdfPayload(
  input: BuildDictamenPayloadInput,
) {
  return {
    signedAt: input.signedAt,
    eventId: input.eventId,
    worker: {
      firstName: input.worker.firstName,
      lastName: input.worker.lastName,
      universalId: input.worker.universalId,
    },
    company: input.company ?? undefined,
    finalDiagnosis: input.finalDiagnosis,
    recommendations: input.recommendations ?? undefined,
    validator: input.validator,
    id: input.verdictId,
    // `MedicalDictamenPDF` exige `extractedData: unknown` (required).
    // Normalizamos `undefined`/`null` → `null` para mantener el shape.
    studies: (input.studies ?? []).map((s) => ({
      serviceName: s.serviceName,
      extractedData: s.extractedData ?? null,
    })),
    labs: (input.labs ?? []).map((l) => ({
      serviceName: l.serviceName,
      extractedData: l.extractedData ?? null,
    })),
    // IMPL-20260826-06: bloques consolidados por atención/cita. Si el
    // orquestador no los proporciona (compat legacy), se omiten en el
    // payload — el renderer los trata como ausentes y conserva el
    // comportamiento single-Event.
    consolidatedEvents: (input.consolidatedEvents ?? []).map((block) => ({
      eventId: block.eventId,
      eventShortId: block.eventShortId,
      isCurrent: block.isCurrent,
      studies: (block.studies ?? []).map((s) => ({
        serviceName: s.serviceName,
        extractedData: s.extractedData ?? null,
      })),
      labs: (block.labs ?? []).map((l) => ({
        serviceName: l.serviceName,
        extractedData: l.extractedData ?? null,
      })),
    })),
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Render (en memoria — sin disco)
// ──────────────────────────────────────────────────────────────────────────

export interface RenderDictamenInputMemoryInput {
  /** Snapshot del evento + verdict ya resuelto por la server action. */
  payload: BuildDictamenPayloadInput
}

/**
 * Renderiza el dictamen general con `<MedicalDictamenPDF>` en memoria.
 * Devuelve el `Buffer` listo para subir al backend mediante
 * `uploadOnlyDictamen` (FormData). No toca el filesystem.
 */
export async function renderDictamenInputToMemory(
  input: RenderDictamenInputMemoryInput,
): Promise<Buffer> {
  const payload = buildDictamenPdfPayload(input.payload)
  return await renderToBuffer(<MedicalDictamenPDF data={payload} />)
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers exportados para tests V1
// ──────────────────────────────────────────────────────────────────────────

export const __test__ = {
  buildDictamenPdfPayload,
}