/**
 * @fileoverview Generador server-side del PDF validado de Audiometría.
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 *
 * Patrón (paralelo a `espirometry-pdf.tsx`):
 *   - Toma los datos de la revisión + snapshot congelado + identidad
 *     congelada del médico (`DoctorStudyReview.validatorSnapshot*`).
 *   - Resuelve criterios audiométricos (PTA3 calculado, PTA fuente por
 *     separado, criterio AMI ≤25 dB) desde la presentación clínica
 *     estructurada de Audiometría. NO copia el diagnóstico textual AMI
 *     como IA.
 *   - Renderiza `<AudiometriaValidatedPDF>` con `@react-pdf/renderer`.
 *   - Persiste el PDF a disco en `uploads/audiometry-pdfs/<reviewId>.pdf`
 *     y devuelve URL relativa + hash SHA-256 + bytes para que la server
 *     action los persista en `DoctorStudyReview`.
 *
 * Advertencias operativas:
 *   - El filesystem local NO está disponible en Vercel serverless. Aquí
 *     escribimos al filesystem del runtime Node; si la escritura falla,
 *     devolvemos sólo el buffer + hash y la API route lo regenera en cada
 *     descarga.
 *   - QA-20260825-01 P3-G: el logo AMI se descarga UNA VEZ al server
 *     start (cacheado en memoria) y se reusa con `resolveAmiLogoDataUrl`.
 *
 * Privacidad:
 *   - El PDF incluye datos clínicos del paciente (PII). La URL del
 *     archivo generado NO se expone públicamente; sólo se sirve por la
 *     API route autenticada `/api/pdf/audiometry/[reviewId]`.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { AudiometriaValidatedPDF } from '@/components/pdf/AudiometriaValidatedPDF'
import type { AudiometriaValidatedPDFData } from '@/components/pdf/AudiometriaValidatedPDF'
import { resolveAudiometriaCriteria } from '@/components/clinical/AudiometriaClinicalCriteriaPanel'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

// Reutiliza el cache del logo AMI (una descarga por proceso). Si la red
// falla al boot, el logo queda null y el PDF cae al fallback "AMI".
export {
  resolveAmiLogoDataUrl,
  AMI_LOGO_URL,
} from '@/lib/espirometry-pdf'

// ──────────────────────────────────────────────────────────────────────────
// Helpers puros — testeables y reutilizables desde la API route
// ──────────────────────────────────────────────────────────────────────────

/**
 * Recomendaciones validadas: si el médico ACEPTA tal cual, conservamos
 * las del snapshot IA (`recommendation` singular + `recommendations[]` +
 * `recommended_actions[]`); si EDITA, NO se renderizan las
 * recomendaciones IA (para no contaminar el documento firmado con texto
 * que el médico NO avaló).
 *
 * NOTA: el SPEC §3 prohíbe copiar el diagnóstico nosológico ni la
 * recomendación textual del PDF AMI como salida IA. El extractor NO
 * genera recomendaciones diagnósticas etiológicas (sólo patrón +
 * criterio AMI), por lo que la única fuente de recomendaciones es el
 * snapshot IA. El helper replica el patrón defensivo de Espirometría.
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
  return Array.from(new Set(result))
}

export interface BuildAudiometriaPdfInput {
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
  logoDataUrl: string | null
}

export function buildAudiometriaPdfData(
  input: BuildAudiometriaPdfInput,
): AudiometriaValidatedPDFData {
  const predxData =
    (input.prediagnosisData as Record<string, unknown> | null) ?? {}
  const recomendacionesValidadas = extractValidatedRecommendationsFromPredx(
    predxData,
    input.doctorStatus,
  )

  // Resolver criterios audiométricos desde el structuredData del snapshot
  // de extracción. Soporta tanto `extracted_data` anidado como root.
  const sd =
    (input.extractionStructuredData as Record<string, unknown> | null) ?? {}
  const extracted =
    sd && typeof sd.extracted_data === 'object' && !Array.isArray(sd.extracted_data)
      ? (sd.extracted_data as Record<string, unknown>)
      : sd
  const resolved = resolveAudiometriaCriteria(extracted)

  // Frecuencias detectadas + TA/VO por oído
  const frecuencias = resolved.frecuenciasDetectadas
  const od =
    extracted?.oido_derecho && typeof extracted.oido_derecho === 'object'
      ? (extracted.oido_derecho as Record<string, unknown>)
      : {}
  const oi =
    extracted?.oido_izquierdo && typeof extracted.oido_izquierdo === 'object'
      ? (extracted.oido_izquierdo as Record<string, unknown>)
      : {}
  const taMap = (side: Record<string, unknown>): Record<number, number | null> => {
    const vaRaw = side.va ?? side.via_aerea ?? {}
    const out: Record<number, number | null> = {}
    if (vaRaw && typeof vaRaw === 'object' && !Array.isArray(vaRaw)) {
      for (const [k, v] of Object.entries(vaRaw as Record<string, unknown>)) {
        const freq = Number(k)
        if (!Number.isFinite(freq)) continue
        const n = typeof v === 'number' && Number.isFinite(v) ? v : null
        out[freq] = n
      }
    }
    // Para frecuencias detectadas pero no presentes en va, dejar null
    for (const f of frecuencias) {
      if (!(f in out)) out[f] = null
    }
    return out
  }
  const voMap = (side: Record<string, unknown>): Record<number, number | null> => {
    const voRaw = side.vo ?? side.via_osea ?? {}
    const out: Record<number, number | null> = {}
    if (voRaw && typeof voRaw === 'object' && !Array.isArray(voRaw)) {
      for (const [k, v] of Object.entries(voRaw as Record<string, unknown>)) {
        const freq = Number(k)
        if (!Number.isFinite(freq)) continue
        const n = typeof v === 'number' && Number.isFinite(v) ? v : null
        out[freq] = n
      }
    }
    for (const f of frecuencias) {
      if (!(f in out)) out[f] = null
    }
    return out
  }

  const odInterp = resolved.oidos.find((o) => o.oido === 'OD') ?? null
  const oiInterp = resolved.oidos.find((o) => o.oido === 'OI') ?? null

  const patientFullName = `${input.patient.firstName} ${input.patient.lastName}`.trim()
  const diagnosis = (input.doctorDiagnosis ?? '').trim()

  return {
    reviewId: input.reviewId,
    signedAt: input.reviewCreatedAt,
    studyName: input.studyName ?? 'Audiometría',
    studyType: input.studyType ?? 'Audiometria',
    patient: {
      fullName: patientFullName.length > 0 ? patientFullName : '—',
      universalId: input.patient.universalId ?? null,
      companyName: input.patient.companyName ?? null,
    },
    doctorStatus: input.doctorStatus,
    doctorDiagnosis:
      diagnosis.length > 0
        ? diagnosis
        : 'Aceptado sin diagnóstico adicional explícito.',
    doctorNotes: input.doctorNotes ?? null,
    frecuencias,
    taOd: taMap(od),
    taOi: taMap(oi),
    voOd: voMap(od),
    voOi: voMap(oi),
    criterios: {
      ptaCalculadoOd: odInterp?.ptaCalculado ?? null,
      ptaCalculadoOi: oiInterp?.ptaCalculado ?? null,
      ptaCompletoOd: odInterp?.ptaCalculadoCompleto ?? false,
      ptaCompletoOi: oiInterp?.ptaCalculadoCompleto ?? false,
      ptaFuenteOd: odInterp?.ptaFuente ?? null,
      ptaFuenteOi: oiInterp?.ptaFuente ?? null,
      criterioAmiOd: odInterp?.criterioAmi ?? 'NO_CONCLUYENTE',
      criterioAmiOi: oiInterp?.criterioAmi ?? 'NO_CONCLUYENTE',
      patronOd: odInterp?.patronAmi ?? 'NO_CONCLUYENTE',
      patronOi: oiInterp?.patronAmi ?? 'NO_CONCLUYENTE',
      bilateralEstado: resolved.bilateral.estado,
      bilateralNota: resolved.bilateral.nota,
      completitud: resolved.completitudDocumental,
      advertencias: resolved.advertencias,
    },
    recomendacionesValidadas,
    medico: input.medico,
    logoUrl: input.logoDataUrl ?? '',
  }
}

export interface GenerateAudiometriaPdfResult {
  buffer: Buffer
  hash: string
  url: string | null
  absolutePath: string | null
}

export interface GenerateAudiometriaPdfInput {
  data: AudiometriaValidatedPDFData
  reviewId: string
}

/**
 * Genera el PDF validado de Audiometría. Devuelve buffer + hash + url
 * relativa (si la persistencia en disco fue exitosa). Lanza excepción si
 * la renderización falla.
 */
export async function generateAudiometriaValidatedPdf(
  input: GenerateAudiometriaPdfInput,
): Promise<GenerateAudiometriaPdfResult> {
  const buffer = await renderToBuffer(
    <AudiometriaValidatedPDF data={input.data} />,
  )
  const hash = `sha256:${createHash('sha256').update(buffer).digest('hex')}`

  let url: string | null = null
  let absolutePath: string | null = null
  try {
    const dir = path.join(REPO_UPLOAD_DIR, 'audiometry-pdfs')
    await mkdir(dir, { recursive: true })
    absolutePath = path.join(dir, `${input.reviewId}.pdf`)
    await writeFile(absolutePath, buffer)
    url = `audiometry-pdfs/${input.reviewId}.pdf`
  } catch (err) {
    console.warn(
      '[IMPL-FEATURE-20260825-02] No se pudo persistir PDF validado de audiometría en disco:',
      err instanceof Error ? err.message : err,
    )
  }

  return { buffer, hash, url, absolutePath }
}