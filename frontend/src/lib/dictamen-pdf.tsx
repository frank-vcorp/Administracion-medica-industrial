/**
 * @fileoverview Generador server-side del PDF del dictamen general
 *   (MedicalDictamenPDF), escritura en disco y builder del payload.
 *
 * @id IMPL-FEATURE-20260825-03 (ronda 7 / FND-20260825-24)
 * @finding discovery/FINDINGS.md FND-20260825-24
 *
 * IMPLEMENTATION_DEFECT observado en producción: `signMedicalDictamPDF`
 * construía el nombre del archivo temporal y llamaba a
 * `/api/v1/sign-pdf` sin haber renderizado el PDF, lo que provocaba
 * `404: Archivo no encontrado: dictamen-<eventId>-<timestamp>.pdf`.
 *
 * Corrección: este módulo concentra la lógica pura y testeable para
 * (1) construir el payload que necesita `MedicalDictamenPDF` desde los
 * snapshots de `MedicalEvent` + `MedicalVerdict`, (2) resolver los
 * nombres canónicos de archivos de entrada/salida (sin path
 * traversal), (3) renderizar a buffer y (4) escribir el PDF de
 * entrada al directorio compartido con el backend (`<repo>/uploads/`,
 * montado en Docker como `/uploads/`).
 *
 * Patrón (paralelo a `examen-medico-pdf.tsx`, `espirometry-pdf.tsx`,
 * `audiometry-pdf.tsx`): helpers puros exportados + función async que
 * hace IO. El caller (`signature.actions.tsx`) orquesta el flujo
 * completo: helper → render → write → backend sign → persist
 * `MedicalVerdict.pdfUrl` (con el nombre firmado devuelto por el
 * backend).
 *
 * Guardrails:
 *   - No auto-decide aptitud ni firma: sólo renderiza el dictamen
 *     previamente persistido en `MedicalVerdict`.
 *   - Mantiene identidad congelada: el `validator.fullName` viene del
 *     snapshot de la sesión + User del Verdict (no inventa identidad).
 *   - NO toca Audiometría/Espirometría.
 *   - Sin cambios en schema Prisma.
 */
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { renderToBuffer } from '@react-pdf/renderer'
import { MedicalDictamenPDF } from '@/components/pdf/MedicalDictamenPDF'

/**
 * Directorio compartido con el backend (`/uploads/`). El backend en
 * Docker monta `<repo>/uploads/` como `/uploads/` y espera los PDFs
 * de entrada/salida en esa ruta. El frontend escribe/lee aquí para que
 * el backend pueda firmar y consumir el archivo firmado.
 *
 * Configurable vía `DICTAMEN_UPLOAD_DIR` para entornos serverless
 * (Vercel) donde `process.cwd()` no permite escapes a `../`.
 */
const REPO_UPLOAD_DIR =
  process.env.DICTAMEN_UPLOAD_DIR ?? path.join(process.cwd(), '..', 'uploads')

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
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers puros — testeables sin DOM ni FS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Construye el nombre canónico del PDF temporal de entrada (sin
 * firmar). El backend (`/api/v1/sign-pdf`) busca este archivo en
 * `/uploads/<input_pdf>` y rechaza cualquier path que escape del
 * directorio compartido (security check en `os.path.basename`).
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
 * Concentrarlo aquí permite reutilizar desde la server action y desde
 * la ruta legacy `/api/pdf/[eventId]` si más adelante se quisiera
 * consolidar (paridad con `examen-medico-pdf.tsx`).
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
  }
}

/**
 * Resuelve la ruta absoluta del directorio compartido (`<repo>/uploads/`
 * o el override `DICTAMEN_UPLOAD_DIR`). Pure wrapper para tests sin
 * tocar el FS.
 */
export function dictamenSharedDir(): string {
  return REPO_UPLOAD_DIR
}

/**
 * Resuelve la ruta absoluta del PDF de entrada. Helper para tests sin
 * FS.
 */
export function dictamenInputPath(inputFileName: string): string {
  return path.join(REPO_UPLOAD_DIR, inputFileName)
}

/**
 * Resuelve la ruta absoluta del PDF firmado. Helper para tests sin FS.
 */
export function dictamenSignedPath(signedFileName: string): string {
  return path.join(REPO_UPLOAD_DIR, signedFileName)
}

// ──────────────────────────────────────────────────────────────────────────
// Render + persistencia (side effects)
// ──────────────────────────────────────────────────────────────────────────

export interface RenderDictamenInputToDiskInput {
  /** Snapshot del evento + verdict ya resuelto por la server action. */
  payload: BuildDictamenPayloadInput
  /** Timestamp ms para el nombre de archivo. */
  nowMs: number
  /** Nombre del archivo de entrada (default: `dictamenInputFileName(payload.eventId, nowMs)`). */
  inputFileName?: string
  /**
   * Directorio compartido a usar (override para tests). Default:
   * `dictamenSharedDir()` (`<repo>/uploads/`).
   */
  sharedDir?: string
}

export interface RenderDictamenInputToDiskResult {
  /** Buffer PDF renderizado (útil para tests sin FS). */
  buffer: Buffer
  /** Ruta absoluta del archivo escrito. */
  absolutePath: string
  /** Sólo basename (lo que el backend acepta). */
  fileName: string
  /** Payload final pasado a `<MedicalDictamenPDF>` (para inspección). */
  payload: ReturnType<typeof buildDictamenPdfPayload>
}

/**
 * Renderiza el dictamen general con `<MedicalDictamenPDF>` y lo escribe
 * al directorio compartido con el backend. El archivo queda listo
 * para que `/api/v1/sign-pdf` lo lea.
 *
 * Crea el directorio si no existe. Si el directorio está en un FS
 * read-only (Vercel serverless) lanza error — la caller decide si
 * persistir en otro backend o abortar.
 */
export async function renderDictamenInputToDisk(
  input: RenderDictamenInputToDiskInput,
): Promise<RenderDictamenInputToDiskResult> {
  const sharedDir = input.sharedDir ?? REPO_UPLOAD_DIR
  const fileName = input.inputFileName
    ?? dictamenInputFileName(input.payload.eventId, input.nowMs)

  const payload = buildDictamenPdfPayload(input.payload)
  const buffer = await renderToBuffer(
    <MedicalDictamenPDF data={payload} />,
  )

  const absolutePath = path.join(sharedDir, fileName)
  await mkdir(sharedDir, { recursive: true })
  await writeFile(absolutePath, buffer)

  return { buffer, absolutePath, fileName, payload }
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers exportados para tests V1
// ──────────────────────────────────────────────────────────────────────────

export const __test__ = {
  REPO_UPLOAD_DIR,
  buildDictamenPdfPayload,
}