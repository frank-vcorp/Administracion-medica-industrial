/**
 * Generador server-side del PDF validado de Interpretación de Rayos X (SME).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { resolveAmiLogoDataUrl } from '@/lib/ami-brand'
import {
  RayosXValidatedPDF,
  type RayosXValidatedPDFData,
} from '@/components/pdf/RayosXValidatedPDF'
import {
  buildRayosXFindingsParagraphs,
  parseRayosXFromExtraction,
  parseRayosXImpressionItems,
  resolveRayosXStudyTypeLabel,
} from '@/lib/clinical/rayos-x-report'
import { resolvePatientIdentificationForPdf } from '@/lib/pdf/patient-identification'
import { resolveValidatedRecommendations } from '@/lib/espirometry-pdf'
import { uploadPdfBuffer } from '@/lib/upload-pdf-buffer'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

export interface BuildRayosXPdfInput {
  reviewId: string
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'
  doctorDiagnosis: string | null | undefined
  doctorNotes: string | null | undefined
  doctorRecommendations?: string | null | undefined
  reviewCreatedAt: Date
  prediagnosisData: unknown
  extractionStructuredData: unknown
  studyName: string | null | undefined
  eventId: string
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

export async function buildRayosXPdfDataAsync(
  input: BuildRayosXPdfInput,
): Promise<RayosXValidatedPDFData> {
  const extracted = parseRayosXFromExtraction(input.extractionStructuredData)
  const patient = await resolvePatientIdentificationForPdf({
    eventId: input.eventId,
    firstName: input.patient.firstName,
    lastName: input.patient.lastName,
    universalId: input.patient.universalId,
    companyName: input.patient.companyName,
    attentionDate: input.reviewCreatedAt,
  })

  const studyTypeLabel = resolveRayosXStudyTypeLabel(input.studyName, extracted)
  const findingsParagraphs = buildRayosXFindingsParagraphs({
    extracted,
    prediagnosisData: input.prediagnosisData,
    doctorNotes: input.doctorNotes,
    doctorDiagnosis: input.doctorDiagnosis,
  })
  const impressionItems = parseRayosXImpressionItems(input.doctorDiagnosis)
  const recLines = resolveValidatedRecommendations(
    (input.prediagnosisData as Record<string, unknown> | null) ?? {},
    input.doctorStatus,
    input.doctorRecommendations,
  )

  return {
    reviewId: input.reviewId,
    signedAt: input.reviewCreatedAt,
    studyTypeLabel,
    patientName: patient.fullName.toUpperCase(),
    companyName: (patient.companyName || input.patient.companyName || '—').toUpperCase(),
    universalId: patient.universalId ?? input.patient.universalId ?? null,
    findingsParagraphs,
    impressionItems,
    recommendations: recLines && recLines.length > 0 ? recLines.join(' ') : null,
    medico: {
      ...input.medico,
      title: 'Médico Validador — Salud Ocupacional',
    },
    logoUrl: input.logoDataUrl ?? '',
  }
}

export async function generateRayosXValidatedPdf(input: {
  reviewId: string
  data: RayosXValidatedPDFData
}): Promise<{ buffer: Buffer; hash: string; url: string | null }> {
  const logoUrl = input.data.logoUrl || (await resolveAmiLogoDataUrl()) || ''
  const buffer = await renderToBuffer(
    <RayosXValidatedPDF data={{ ...input.data, logoUrl }} />,
  )
  const hash = `sha256:${createHash('sha256').update(buffer).digest('hex')}`

  let url: string | null = null
  const key = `rayos-x-pdfs/${input.reviewId}.pdf`
  try {
    const dir = path.join(REPO_UPLOAD_DIR, 'rayos-x-pdfs')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, `${input.reviewId}.pdf`), buffer)
    url = key
  } catch (err) {
    console.warn(
      '[rayos-x-pdf] No se pudo persistir PDF en disco:',
      err instanceof Error ? err.message : err,
    )
  }

  if (!url) {
    try {
      const uploaded = await uploadPdfBuffer(buffer, key)
      if (uploaded.success) {
        url = uploaded.key
      } else {
        console.warn(
          '[rayos-x-pdf] Fallback uploadPdfBuffer no persistió PDF:',
          uploaded.error || 'error desconocido',
        )
      }
    } catch (err) {
      console.warn(
        '[rayos-x-pdf] Error en fallback uploadPdfBuffer:',
        err instanceof Error ? err.message : err,
      )
    }
  }

  return { buffer, hash, url }
}
