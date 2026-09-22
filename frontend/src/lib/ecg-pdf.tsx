/**
 * PDF validado de electrocardiograma (post revisión médica).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import prisma from '@/lib/prisma'
import { resolveAmiLogoDataUrl } from '@/lib/ami-brand'
import { EcgValidatedPDF } from '@/components/pdf/EcgValidatedPDF'
import type { EcgValidatedPDFData } from '@/components/pdf/EcgValidatedPDF'
import {
  buildEcgNarrativeParagraph,
  parseEcgDiagnosisItems,
  parseEcgFromExtraction,
} from '@/lib/clinical/ecg-report'
import { resolvePatientIdentificationForPdf } from '@/lib/pdf/patient-identification'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

export interface BuildEcgPdfInput {
  reviewId: string
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'
  doctorDiagnosis: string | null | undefined
  doctorNotes: string | null | undefined
  reviewCreatedAt: Date
  prediagnosisData: unknown
  extractionStructuredData: unknown
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

export async function buildEcgPdfDataAsync(input: BuildEcgPdfInput): Promise<EcgValidatedPDFData> {
  const ecg = parseEcgFromExtraction(input.extractionStructuredData)
  const narrativeParagraph = buildEcgNarrativeParagraph(ecg, input.doctorNotes)
  const diagnosisItems = parseEcgDiagnosisItems(input.doctorDiagnosis)

  const patient = await resolvePatientIdentificationForPdf({
    eventId: input.eventId,
    firstName: input.patient.firstName,
    lastName: input.patient.lastName,
    universalId: input.patient.universalId,
    companyName: input.patient.companyName,
  })

  return {
    reviewId: input.reviewId,
    signedAt: input.reviewCreatedAt,
    doctorStatus: input.doctorStatus,
    studyName: 'Electrocardiograma en reposo',
    studyType: 'Electrocardiograma',
    patient,
    narrativeParagraph,
    diagnosisItems,
    doctorNotes: input.doctorNotes ?? null,
    medico: input.medico,
    logoUrl: input.logoDataUrl ?? '',
  }
}

export async function generateEcgValidatedPdf(input: {
  reviewId: string
  data: EcgValidatedPDFData
}): Promise<{ buffer: Buffer; hash: string; url: string | null }> {
  const logoUrl = input.data.logoUrl || (await resolveAmiLogoDataUrl()) || ''
  const buffer = await renderToBuffer(
    <EcgValidatedPDF data={{ ...input.data, logoUrl }} />,
  )
  const hash = `sha256:${createHash('sha256').update(buffer).digest('hex')}`

  let url: string | null = null
  try {
    const dir = path.join(REPO_UPLOAD_DIR, 'ecg-pdfs')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, `${input.reviewId}.pdf`), buffer)
    url = `ecg-pdfs/${input.reviewId}.pdf`
  } catch (err) {
    console.warn(
      '[ecg-pdf] No se pudo persistir PDF en disco:',
      err instanceof Error ? err.message : err,
    )
  }

  return { buffer, hash, url }
}
