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
  const event = await prisma.medicalEvent.findUnique({
    where: { id: input.eventId },
    select: {
      checkInDate: true,
      createdAt: true,
      worker: {
        select: {
          dob: true,
          gender: true,
          company: { select: { name: true } },
        },
      },
    },
  })

  const eventDateRaw = event?.checkInDate ?? event?.createdAt ?? input.reviewCreatedAt
  const ageYears = (() => {
    const dob = event?.worker?.dob
    if (!dob) return null
    let age = eventDateRaw.getFullYear() - dob.getFullYear()
    const m = eventDateRaw.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && eventDateRaw.getDate() < dob.getDate())) age -= 1
    return age >= 0 && age < 130 ? age : null
  })()

  const ecg = parseEcgFromExtraction(input.extractionStructuredData)
  const narrativeParagraph = buildEcgNarrativeParagraph(ecg, input.doctorNotes)
  const diagnosisItems = parseEcgDiagnosisItems(input.doctorDiagnosis)

  const fullName = `${input.patient.firstName} ${input.patient.lastName}`.trim() || '—'
  const companyName =
    input.patient.companyName?.trim() ||
    event?.worker?.company?.name?.trim() ||
    '—'

  return {
    reviewId: input.reviewId,
    signedAt: input.reviewCreatedAt,
    patient: {
      fullName,
      sexLabel: event?.worker?.gender ?? '—',
      ageLabel: ageYears != null ? `${ageYears} años` : '—',
      companyName,
    },
    narrativeParagraph,
    diagnosisItems,
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
