/**
 * @fileoverview Generador server-side del PDF validado de Audiometría.
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 *
 * Patrón (paralelo a `espirometry-pdf.tsx`):
 *   - Toma los datos de la revisión + snapshot congelado + identidad
 *     congelada del médico (`DoctorStudyReview.validatorSnapshot*`).
 *   - Resuelve la EVIDENCIA DOCUMENTAL (TA/VO por frecuencia y por
 *     oído) desde la presentación clínica estructurada de Audiometría.
 *     NO calcula ni renderiza criterios DERIVADOS (PTA3, criterio AMI,
 *     patrón, completitud) — viven sólo en el panel clínico.
 *   - Renderiza `<AudiometriaValidatedPDF>` con `@react-pdf/renderer`.
 *   - Persiste el PDF a disco en `uploads/audiometry-pdfs/<reviewId>.pdf`
 *     y devuelve URL relativa + hash SHA-256 + bytes para que la server
 *     action los persista en `DoctorStudyReview`.
 *
 * Decisiones recientes (corregidas por Frank):
 *   - FND-20260825-14: la sección IV "Criterio audiométrico AMI
 *     (referencia)" se retiró del PDF; vive sólo en el panel.
 *   - FND-20260825-15: la sección III "Criterios audiométricos
 *     derivados" también se retiró del PDF; vive sólo en el panel.
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

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

// Reutiliza helpers del PDF de espirometría (misma semántica de recomendaciones).
import {
  resolveAmiLogoDataUrl,
  AMI_LOGO_URL,
  extractValidatedRecommendationsFromPredx,
  resolveValidatedRecommendations,
} from '@/lib/espirometry-pdf'

export {
  resolveAmiLogoDataUrl,
  AMI_LOGO_URL,
  extractValidatedRecommendationsFromPredx,
  resolveValidatedRecommendations,
}

export interface BuildAudiometriaPdfInput {
  reviewId: string
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'
  doctorDiagnosis: string | null | undefined
  doctorNotes: string | null | undefined
  doctorRecommendations?: string | null | undefined
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
  const recomendacionesValidadas = resolveValidatedRecommendations(
    predxData,
    input.doctorStatus,
    input.doctorRecommendations,
  )

  // FND-20260825-15: el PDF ya NO computa PTA3 / criterio AMI / patrón /
  // completitud. Sólo formamos la EVIDENCIA DOCUMENTAL (TA/VO por
  // frecuencia y por oído) desde el snapshot estructurado de extracción.
  // Soporta tanto `extracted_data` anidado como root.
  const sd =
    (input.extractionStructuredData as Record<string, unknown> | null) ?? {}
  const extracted =
    sd && typeof sd.extracted_data === 'object' && !Array.isArray(sd.extracted_data)
      ? (sd.extracted_data as Record<string, unknown>)
      : sd
  // Frecuencias detectadas: unión simple de las claves presentes en
  // `va` y `vo` de ambos oídos; sin invención.
  const frecuenciasSet = new Set<number>()
  for (const sideKey of ['oido_derecho', 'oido_izquierdo'] as const) {
    const side = extracted?.[sideKey]
    if (side && typeof side === 'object' && !Array.isArray(side)) {
      for (const vaOrVo of ['va', 'vo']) {
        const obj = (side as Record<string, unknown>)[vaOrVo]
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const k of Object.keys(obj as Record<string, unknown>)) {
            const freq = Number(k)
            if (Number.isFinite(freq)) frecuenciasSet.add(freq)
          }
        }
      }
    }
  }
  const frecuencias = Array.from(frecuenciasSet).sort((a, b) => a - b)

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