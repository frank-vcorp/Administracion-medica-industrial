/**
 * Generador server-side del PDF validado de Campimetría (formato 005-2018).
 * @id IMPL-FEATURE-20260914-01
 */
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import prisma from '@/lib/prisma'
import { CampimetriaValidatedPDF } from '@/components/pdf/CampimetriaValidatedPDF'
import type { CampimetriaValidatedPDFData } from '@/components/pdf/CampimetriaValidatedPDF'
import {
  buildCampimetriaImpresion,
  buildCampimetriaRecomendaciones,
  deriveAptitudCampimetria,
  formatExploracionCampoPdf,
} from '@/lib/clinical/campimetria-report'
import { inheritAcuityFromExam, inheritAntecedentesFromPapeleta } from '@/lib/clinical/campimetria-inherited'
import { validateCampimetriaQuestionnairePayload } from '@/lib/clinical/campimetria-questionnaire-validate'
import { ISHIHARA_PLATES, type TiempoLentes } from '@/schemas/clinical/campimetria-questionnaire.schema'
import {
  parseDoctorRecommendationsLines,
  resolveValidatedRecommendations,
} from '@/lib/espirometry-pdf'
import { resolveAmiLogoDataUrl } from '@/lib/ami-brand'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

const TIEMPO_LENTES_LABEL: Record<TiempoLentes, string> = {
  MENOS_1_ANIO: 'MENOS DE 1 AÑO',
  '1_A_3_ANIOS': '1 A 3 AÑOS',
  '3_A_5_ANIOS': '3 A 5 AÑOS',
  MAS_5_ANIOS: 'MÁS DE 5 AÑOS',
}

function loadPublicImageDataUrl(publicPath: string): string | null {
  try {
    const rel = publicPath.replace(/^\//, '')
    const filePath = path.join(process.cwd(), 'public', rel)
    const buf = readFileSync(filePath)
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function siNoLabel(v: string): string {
  return v === 'SI' ? 'SI' : 'NO'
}

function antecedenteEstado(items: ReturnType<typeof inheritAntecedentesFromPapeleta>, label: string): string {
  const row = items.find(a => a.label === label)
  if (!row || row.estado === 'Sin dato en papeleta') return 'NO'
  const e = row.estado.toUpperCase()
  if (e.includes('SI') || e.includes('POSIT') || e.includes('PADECE')) return 'SI'
  if (e.includes('NEG')) return 'NO'
  return row.estado
}

export interface BuildCampimetriaPdfInput {
  reviewId: string
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'
  doctorDiagnosis: string | null | undefined
  doctorNotes: string | null | undefined
  doctorRecommendations?: string | null | undefined
  reviewCreatedAt: Date
  prediagnosisData: unknown
  clinicalContext: unknown
  eventId: string
  studyName: string | null | undefined
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

export async function buildCampimetriaPdfDataAsync(
  input: BuildCampimetriaPdfInput,
): Promise<CampimetriaValidatedPDFData> {
  const validation = validateCampimetriaQuestionnairePayload(input.clinicalContext)
  if (!validation.valid) {
    throw new Error('No hay captura de campimetría válida para generar el PDF.')
  }
  const payload = validation.payload

  const event = await prisma.medicalEvent.findUnique({
    where: { id: input.eventId },
    select: {
      checkInDate: true,
      createdAt: true,
      worker: { select: { dob: true, company: { select: { name: true } } } },
    },
  })
  const exam = await prisma.medicalExam.findUnique({
    where: { eventId: input.eventId },
    select: { eyeAcuityData: true, physicalExamData: true },
  })
  const acuity = inheritAcuityFromExam(
    (exam?.eyeAcuityData as Record<string, unknown> | null) ?? null,
  )
  const inheritedAnt = inheritAntecedentesFromPapeleta({
    physicalExamData: (exam?.physicalExamData as Record<string, unknown> | null) ?? null,
    longitudinalData: null,
  })

  const eventDateRaw = event?.checkInDate ?? event?.createdAt ?? input.reviewCreatedAt
  const eventDateLabel = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(eventDateRaw)

  const ageYears = (() => {
    const dob = event?.worker?.dob
    if (!dob) return null
    let age = eventDateRaw.getFullYear() - dob.getFullYear()
    const m = eventDateRaw.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && eventDateRaw.getDate() < dob.getDate())) age -= 1
    return age >= 0 && age < 130 ? age : null
  })()

  const predxData = (input.prediagnosisData as Record<string, unknown> | null) ?? {}
  const recomendacionesValidadas = resolveValidatedRecommendations(
    predxData,
    input.doctorStatus,
    input.doctorRecommendations,
  )
  const recomendacionesExtra = parseDoctorRecommendationsLines(
    buildCampimetriaRecomendaciones({ payload, acuity }),
  )
  const recomendaciones = Array.from(
    new Set([...(recomendacionesValidadas ?? []), ...recomendacionesExtra]),
  )

  const exploracionOd = Object.fromEntries(
    (['movimientos', 'reflejos', 'pupilas', 'conjuntiva', 'esclera', 'fondo_de_ojo', 'anexos'] as const).map(
      field => [field, formatExploracionCampoPdf(field, payload.exploracion.ojo_derecho[field])],
    ),
  ) as CampimetriaValidatedPDFData['exploracionOd']

  const exploracionOi = Object.fromEntries(
    (['movimientos', 'reflejos', 'pupilas', 'conjuntiva', 'esclera', 'fondo_de_ojo', 'anexos'] as const).map(
      field => [field, formatExploracionCampoPdf(field, payload.exploracion.ojo_izquierdo[field])],
    ),
  ) as CampimetriaValidatedPDFData['exploracionOi']

  const ishiharaOd = Object.fromEntries(
    ISHIHARA_PLATES.map(p => [p.id, payload.ishihara.ojo_derecho[p.id] ?? '']),
  ) as Record<string, string>
  const ishiharaOi = Object.fromEntries(
    ISHIHARA_PLATES.map(p => [p.id, payload.ishihara.ojo_izquierdo[p.id] ?? '']),
  ) as Record<string, string>

  const patientFullName = `${input.patient.firstName} ${input.patient.lastName}`.trim()

  return {
    reviewId: input.reviewId,
    signedAt: input.reviewCreatedAt,
    formatCode: '005-2018',
    studyName: input.studyName ?? 'Campimetría',
    patient: {
      fullName: patientFullName || '—',
      companyName:
        input.patient.companyName ??
        event?.worker?.company?.name ??
        null,
      ageYears,
      eventDate: eventDateLabel,
    },
    antecedentes: {
      usoLentes: siNoLabel(payload.antecedentes.uso_lentes),
      tiempoLentes:
        payload.antecedentes.uso_lentes === 'SI' && payload.antecedentes.tiempo_lentes
          ? TIEMPO_LENTES_LABEL[payload.antecedentes.tiempo_lentes]
          : 'N/A',
      cirugiasOculares: siNoLabel(payload.antecedentes.cirugias_oculares),
      causaCirugia:
        payload.antecedentes.cirugias_oculares === 'SI'
          ? (payload.antecedentes.causa_cirugia ?? 'N/A')
          : 'N/A',
      diabetes: antecedenteEstado(inheritedAnt, 'Diabetes'),
      hipertension: antecedenteEstado(inheritedAnt, 'Hipertensión arterial'),
    },
    agudeza: {
      od: {
        lejanaSin: acuity.vision_lejana_od ?? '—',
        lejanaCon: acuity.lejana_corregida_od ?? '—',
        cercanaSin: acuity.vision_cercana_od ?? '—',
        cercanaCon: acuity.cercana_corregida_od ?? '—',
      },
      oi: {
        lejanaSin: acuity.vision_lejana_oi ?? '—',
        lejanaCon: acuity.lejana_corregida_oi ?? '—',
        cercanaSin: acuity.vision_cercana_oi ?? '—',
        cercanaCon: acuity.cercana_corregida_oi ?? '—',
      },
      pending: acuity.pending,
    },
    exploracionOd,
    exploracionOi,
    confrontacion: {
      od: payload.confrontacion.ojo_derecho,
      oi: payload.confrontacion.ojo_izquierdo,
    },
    ishihara: {
      resultado: payload.ishihara.resultado,
      od: ishiharaOd,
      oi: ishiharaOi,
    },
    resumenClinico: buildCampimetriaImpresion({ payload, acuity }),
    impresionDiagnostica:
      (input.doctorDiagnosis ?? '').trim() ||
      buildCampimetriaImpresion({ payload, acuity }),
    aptitud: deriveAptitudCampimetria({ payload, acuity }),
    recomendaciones,
    medico: input.medico,
    logoUrl: input.logoDataUrl ?? '',
    confrontacionOdImage: loadPublicImageDataUrl('/clinical/campimetria/confrontacion-od.png'),
    confrontacionOiImage: loadPublicImageDataUrl('/clinical/campimetria/confrontacion-oi.png'),
    ishiharaImage: loadPublicImageDataUrl('/clinical/campimetria/ishihara.png'),
  }
}

export async function generateCampimetriaValidatedPdf(input: {
  reviewId: string
  data: CampimetriaValidatedPDFData
}): Promise<{ buffer: Buffer; hash: string; url: string | null }> {
  const logoUrl = input.data.logoUrl || (await resolveAmiLogoDataUrl()) || ''
  const buffer = await renderToBuffer(
    <CampimetriaValidatedPDF data={{ ...input.data, logoUrl }} />,
  )
  const hash = `sha256:${createHash('sha256').update(buffer).digest('hex')}`

  let url: string | null = null
  try {
    const dir = path.join(REPO_UPLOAD_DIR, 'campimetria-pdfs')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, `${input.reviewId}.pdf`), buffer)
    url = `campimetria-pdfs/${input.reviewId}.pdf`
  } catch (err) {
    console.warn(
      '[campimetria-pdf] No se pudo persistir PDF en disco:',
      err instanceof Error ? err.message : err,
    )
  }

  return { buffer, hash, url }
}
