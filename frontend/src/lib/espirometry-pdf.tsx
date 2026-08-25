/**
 * @fileoverview Generador server-side del PDF validado de Espirometría.
 * @id IMPL-FEATURE-20260825-01
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * Patrón:
 *   - Toma los datos de la revisión + snapshot congelado + identidad congelada
 *     del médico (que ya vienen en `DoctorStudyReview.validatorSnapshot*`).
 *   - Resuelve los criterios de repetibilidad desde la presentación clínica
 *     estructurada (espirometría); NO copia texto del PDF fuente como IA.
 *   - Renderiza el componente `<EspirometryValidatedPDF>` con `@react-pdf/renderer`.
 *   - Persiste el PDF a disco en `uploads/espirometry-pdfs/<reviewId>.pdf` y
 *     devuelve URL relativa + hash SHA-256 + bytes para que la server action
 *     los persista en `DoctorStudyReview`.
 *
 * Advertencias operativas:
 *   - El filesystem local NO está disponible en Vercel serverless. La SPEC
 *     autoriza descarga/cache local cuando la infraestructura lo permita
 *     (recomendado Coolify/Contabo). Aquí escribimos al filesystem del
 *     runtime Node; si la escritura falla, devolvemos sólo el buffer
 *     + hash y la API route lo regenera en cada descarga.
 *   - QA-20260825-01 P3-G: el logo AMI se descarga UNA VEZ al server start
 *     (cacheado en memoria) y se incrusta como data-URL en el PDF. Si la
 *     red está caída al boot, se sustituye por texto "AMI" sin abortar la
 *     generación.
 *
 * Privacidad:
 *   - El PDF incluye datos clínicos del paciente (PII). La URL del archivo
 *     generado NO se expone públicamente; sólo se sirve por la API route
 *     autenticada `/api/pdf/espirometry/[reviewId]` (control de acceso
 *     aplicado en el handler, fuera de este helper).
 *
 * QA-20260825-01 P3-F: las funciones puras `extractValidatedRecommendationsFromPredx`
 * y `extractRepetibilidadFromExtraction` se exportan para que la action y
 * la API route regeneren el MISMO contenido (mismo hash si todo lo demás
 * coincide). Antes la action leía 3 campos del prediagnóstico y la route
 * sólo 1 → contenido divergente en regeneración.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { EspirometryValidatedPDF } from '@/components/pdf/EspirometryValidatedPDF'
import type { EspirometryValidatedPDFData } from '@/components/pdf/EspirometryValidatedPDF'
import {
  resolveCriteria,
  type ResolvedCriteria,
} from '@/components/clinical/EspirometriaClinicalCriteriaPanel'

export const AMI_LOGO_URL =
  'https://medicaindustrial.com/sites/default/files/logo-2023.fw_.png'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

/**
 * Umbral AMI oficial para repetibilidad FVC/FEV1 (BR-20260824-01).
 * NO usar 200 ml: es criterio ATS/ERS del equipo, distinto del criterio
 * AMI que exige el panel clínico.
 */
export const REPETIBILIDAD_UMBRAL_ML = 150

// ── QA-20260825-01 P3-G: cache de logo con fallback ─────────────────────────
/**
 * Cache en memoria del logo AMI como data-URL PNG. Se descarga una sola vez
 * por proceso Node; si la red falla al boot, `amiLogoDataUrl` queda null y
 * el PDF cae al fallback de texto "AMI" sin lanzar excepción.
 *
 * Esto evita (a) que `@react-pdf/renderer` falle en build-time cuando la
 * red está caída, (b) re-descargar el logo en cada generación de PDF.
 */
let amiLogoCache: string | null = null
let amiLogoResolved = false

async function resolveAmiLogoDataUrl(): Promise<string | null> {
  if (amiLogoResolved) return amiLogoCache
  amiLogoResolved = true
  try {
    const resp = await fetch(AMI_LOGO_URL, {
      // headers mínimos para evitar bloqueos por UA o referrer
      headers: { 'User-Agent': 'AMI-PDF-Generator/1.0' },
    })
    if (!resp.ok) {
      console.warn(
        `[IMPL-FEATURE-20260825-01] Logo AMI no disponible: HTTP ${resp.status}`,
      )
      amiLogoCache = null
      return null
    }
    const ct = resp.headers.get('content-type') || 'image/png'
    const buf = Buffer.from(await resp.arrayBuffer())
    amiLogoCache = `data:${ct};base64,${buf.toString('base64')}`
    return amiLogoCache
  } catch (err) {
    console.warn(
      `[IMPL-FEATURE-20260825-01] Logo AMI no descargable:`,
      err instanceof Error ? err.message : err,
    )
    amiLogoCache = null
    return null
  }
}

// ── QA-20260825-01 P3-F: helper puro compartido action/route ───────────────

/**
 * Recomendaciones validadas: si el médico ACEPTA tal cual, conservamos las
 * del snapshot IA (`recommendation` singular + `recommendations[]` +
 * `recommended_actions[]`); si EDITA, sólo el `doctorDiagnosis`/`doctorNotes`
 * del médico son la verdad y se omiten las recomendaciones IA (para no
 * contaminar el documento firmado con texto que el médico NO avaló).
 *
 * IMPORTANTE: REJECTED no entra aquí (la SPEC no genera PDF).
 */
export function extractValidatedRecommendationsFromPredx(
  predxData: Record<string, unknown> | null,
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED',
): string[] {
  if (doctorStatus !== 'REVIEWED_ACCEPTED') return []
  const data = predxData ?? {}
  const result: string[] = []
  const recSingular =
    typeof data.recommendation === 'string' ? data.recommendation.trim() : ''
  if (recSingular) result.push(recSingular)
  const arrKeys = ['recommendations', 'recommended_actions'] as const
  for (const key of arrKeys) {
    const arr = data[key]
    if (Array.isArray(arr)) {
      for (const r of arr) {
        if (typeof r === 'string' && r.trim().length > 0) {
          result.push(r.trim())
        }
      }
    }
  }
  // dedup preservando orden
  return Array.from(new Set(result))
}

/**
 * QA-20260825-01 P2-D: extrae los valores de repetibilidad del
 * `structuredData` del snapshot de extracción (mismo cálculo que usa el
 * panel `EspirometriaClinicalCriteriaPanel`, sin recalcular). Devuelve
 * los valores en el formato que espera `resolveRepetibilidadForPdf`.
 *
 * El snapshot puede ser:
 *   - `StudyExtractionSnapshot.structuredData` que contiene
 *     `{ extracted_data: { calidad, parametros }, missing_fields, ... }`
 *   - O el objeto root con `calidad/parametros` directamente (compat).
 */
export function extractRepetibilidadFromExtraction(
  structuredData: unknown,
): Parameters<typeof resolveRepetibilidadForPdf>[0] {
  const sd = (structuredData ?? {}) as Record<string, unknown>
  // Soportar tanto `extracted_data` anidado como root.
  const extracted =
    sd && typeof sd.extracted_data === 'object' && !Array.isArray(sd.extracted_data)
      ? (sd.extracted_data as Record<string, unknown>)
      : sd
  const resolved: ResolvedCriteria = resolveCriteria(extracted)

  return {
    repetibilidadFvcMl: resolved.repetibilidadFvcMl,
    repetibilidadFev1Ml: resolved.repetibilidadFev1Ml,
    // El panel deriva el booleano ≤150 desde el numérico (regla AMI).
    // `SI` → cumple=true; `NO` → cumple=false; `null` → null.
    cumpleRepetibilidadFvc:
      resolved.repetibilidadFvcMenor150 === 'SI'
        ? true
        : resolved.repetibilidadFvcMenor150 === 'NO'
          ? false
          : null,
    cumpleRepetibilidadFev1:
      resolved.repetibilidadFev1Menor150 === 'SI'
        ? true
        : resolved.repetibilidadFev1Menor150 === 'NO'
          ? false
          : null,
    // El panel calcula `pruebasAceptables` sobre la fila estándar; mismo
    // valor aplica a FVC y FEV1 (mismas maniobras M1/M2/M3 de la prueba).
    pruebasAceptablesFvc: resolved.pruebasAceptables,
    pruebasAceptablesFev1: resolved.pruebasAceptables,
    umbralMl: REPETIBILIDAD_UMBRAL_ML,
    fuente: resolved.repetibilidadFvcSource === 'computed' ? 'derived' : 'extracted',
  }
}

// ── QA-20260825-01 P2-D: repetibilidad estructurada para el PDF ──────────────
/**
 * Devuelve un objeto con los criterios de repetibilidad listos para el PDF.
 * QA-20260825-01 P2-D: ANTES la implementación devolvía `null` cuando todos
 * los valores estaban ausentes y eso ocultaba la sección II. Ahora SIEMPRE
 * devuelve un objeto (los campos ausentes quedan `null`); el componente
 * PDF renderiza la sección II aunque los valores sean `—` para que el
 * médico sepa que el criterio AMI fue evaluado.
 */
export interface EspirometryRepetibilidadForPdf {
  fvc: {
    diferenciaMl: number | null
    cumple: boolean | null
    maniobrasValidas: number | null
  }
  fev1: {
    diferenciaMl: number | null
    cumple: boolean | null
    maniobrasValidas: number | null
  }
  umbralMl: number
  fuente: 'extracted' | 'derived' | null
}

export function resolveRepetibilidadForPdf(input: {
  repetibilidadFvcMl?: number | null
  repetibilidadFev1Ml?: number | null
  cumpleRepetibilidadFvc?: boolean | null
  cumpleRepetibilidadFev1?: boolean | null
  pruebasAceptablesFvc?: number | null
  pruebasAceptablesFev1?: number | null
  umbralMl?: number | null
  fuente?: 'extracted' | 'derived' | null
}): EspirometryRepetibilidadForPdf {
  return {
    fvc: {
      diferenciaMl: input.repetibilidadFvcMl ?? null,
      cumple: input.cumpleRepetibilidadFvc ?? null,
      maniobrasValidas: input.pruebasAceptablesFvc ?? null,
    },
    fev1: {
      diferenciaMl: input.repetibilidadFev1Ml ?? null,
      cumple: input.cumpleRepetibilidadFev1 ?? null,
      maniobrasValidas: input.pruebasAceptablesFev1 ?? null,
    },
    umbralMl: input.umbralMl ?? REPETIBILIDAD_UMBRAL_ML,
    fuente: input.fuente ?? null,
  }
}

export interface GenerateEspirometryPdfResult {
  /** Buffer con el PDF (siempre presente si no lanzó excepción) */
  buffer: Buffer
  /** Hash SHA-256 en formato `sha256:<hex>` */
  hash: string
  /** URL relativa servible por la API route, o null si la persistencia en
   *  disco no fue posible (modo buffer-only) */
  url: string | null
  /** Ruta absoluta en disco, sólo para diagnóstico (no se expone al cliente) */
  absolutePath: string | null
}

export interface GenerateEspirometryPdfInput {
  data: EspirometryValidatedPDFData
  reviewId: string
}

/**
 * Construye el payload completo para el PDF desde los datos del snapshot +
 * revisión. Esta función concentra la preparación del input para que la
 * action y la API route de descarga produzcan exactamente el mismo hash
 * si los datos base no cambian.
 *
 * QA-20260825-01 P3-F + P2-D + P1-A: las recomendaciones, repetibilidad e
 * identidad del médico se extraen SIEMPRE de los snapshots congelados
 * (`prediagnosisSnapshot.prediagnosisData`,
 * `extractionSnapshot.structuredData` y `DoctorStudyReview.validatorSnapshot*`).
 */
export interface BuildEspirometryPdfInput {
  reviewId: string
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'
  doctorDiagnosis: string | null | undefined
  doctorNotes: string | null | undefined
  reviewCreatedAt: Date
  prediagnosisData: unknown
  extractionStructuredData: unknown
  studyName: string | null | undefined
  studyType: string | null | undefined
  patient: {
    firstName: string
    lastName: string
    universalId?: string | null
    companyName?: string | null
  }
  medico: {
    fullName: string
    professionalLicense: string
    signatureImageUrl: string
  }
  /** Data-URL del logo AMI (si fue descargable) o null para fallback texto. */
  logoDataUrl: string | null
}

export function buildEspirometryPdfData(
  input: BuildEspirometryPdfInput,
): EspirometryValidatedPDFData {
  const predxData = (input.prediagnosisData as Record<string, unknown> | null) ?? {}
  const recomendacionesValidadas = extractValidatedRecommendationsFromPredx(
    predxData,
    input.doctorStatus,
  )
  const repetibilidad = resolveRepetibilidadForPdf(
    extractRepetibilidadFromExtraction(input.extractionStructuredData),
  )

  const patientFullName = `${input.patient.firstName} ${input.patient.lastName}`.trim()
  const diagnosis = (input.doctorDiagnosis ?? '').trim()
  return {
    reviewId: input.reviewId,
    signedAt: input.reviewCreatedAt,
    studyName: input.studyName ?? 'Espirometría',
    studyType: input.studyType ?? 'Espirometria',
    patient: {
      fullName: patientFullName.length > 0 ? patientFullName : '—',
      universalId: input.patient.universalId ?? null,
      companyName: input.patient.companyName ?? null,
    },
    doctorStatus: input.doctorStatus,
    doctorDiagnosis: diagnosis.length > 0 ? diagnosis : 'Aceptado sin diagnóstico adicional explícito.',
    doctorNotes: input.doctorNotes ?? null,
    repetibilidad,
    recomendacionesValidadas,
    medico: input.medico,
    logoUrl: input.logoDataUrl ?? '',
  }
}

/**
 * Genera el PDF validado de Espirometría. Devuelve buffer + hash + url
 * relativa (si la persistencia en disco fue exitosa). Lanza excepción si
 * la renderización falla; el caller decide qué hacer (persistir error en
 * `DoctorStudyReview.validatedPdfError`).
 */
export async function generateEspirometryValidatedPdf(
  input: GenerateEspirometryPdfInput,
): Promise<GenerateEspirometryPdfResult> {
  const buffer = await renderToBuffer(<EspirometryValidatedPDF data={input.data} />)
  const hash = `sha256:${createHash('sha256').update(buffer).digest('hex')}`

  // Persistencia opcional en disco (cache para descargas subsecuentes).
  // Si el filesystem no está disponible (Vercel serverless), la API route
  // regenera el PDF en cada descarga a partir de los datos estructurados.
  let url: string | null = null
  let absolutePath: string | null = null
  try {
    const dir = path.join(REPO_UPLOAD_DIR, 'espirometry-pdfs')
    await mkdir(dir, { recursive: true })
    absolutePath = path.join(dir, `${input.reviewId}.pdf`)
    await writeFile(absolutePath, buffer)
    // QA-20260825-01 P3-E: la URL se persiste SIN prefijo `uploads/` porque
    // la API route hace `path.join(REPO_UPLOAD_DIR, validatedPdfUrl)` y
    // `REPO_UPLOAD_DIR` ya apunta a `<repo>/uploads/`.
    url = `espirometry-pdfs/${input.reviewId}.pdf`
  } catch (err) {
    // No fatal: el caller aún tiene el buffer + hash y puede regenerar.
    console.warn(
      `[IMPL-FEATURE-20260825-01] No se pudo persistir PDF validado de espirometría en disco:`,
      err instanceof Error ? err.message : err,
    )
  }

  return { buffer, hash, url, absolutePath }
}

/**
 * Resuelve el logo AMI una sola vez por proceso. Lo expone para que tanto
 * la action como la API route usen la misma data-URL cacheada y produzcan
 * el mismo hash.
 */
export { resolveAmiLogoDataUrl }
