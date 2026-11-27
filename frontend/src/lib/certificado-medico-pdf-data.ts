import prisma from '@/lib/prisma'
import {
  isCertificadoMedicoTestName,
  parseCertificadoMedicoDraftContext,
} from '@/lib/clinical/certificado-medico'
import type { CertificadoMedicoPdfInput } from '@/lib/certificado-medico-pdf'
import { resolveCertificadoMedicoMetadata } from '@/lib/clinical/certificado-medico-metadata'
import { mergeCertificadoSignosPrefill } from '@/lib/clinical/certificado-medico-prefill'
import { computeBmi, complexionFromImc } from '@/lib/clinical/talla-meters'
import {
  CERTIFICADO_MEDICO_SCHEMA_VERSION,
  DEFAULT_DICTAMEN_LABORAL_TEXTO,
  buildDefaultExploracionCertificado,
  type CertificadoMedicoPayload,
} from '@/schemas/clinical/certificado-medico.schema'
import { resolveSmeLogoDataUrl } from '@/lib/sme-brand'

function deepMergeAntecedentes(
  longitudinal: Record<string, unknown> | null | undefined,
  studySpecific: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const section of ['heredo_familiares', 'no_patologicos', 'patologicos'] as const) {
    const longSec =
      longitudinal?.[section] && typeof longitudinal[section] === 'object'
        ? (longitudinal[section] as Record<string, unknown>)
        : {}
    const studySec =
      studySpecific?.[section] && typeof studySpecific[section] === 'object'
        ? (studySpecific[section] as Record<string, unknown>)
        : {}
    const hasStudyFields = Object.values(studySec).some(
      (v) => v !== null && v !== undefined && (typeof v !== 'object' || Object.keys(v as object).length > 0),
    )
    result[section] = hasStudyFields ? { ...longSec, ...studySec } : longSec
  }
  return result
}

function formatLongDate(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function computeEdad(dob: Date, asOf: Date): string | null {
  let years = asOf.getFullYear() - dob.getFullYear()
  const m = asOf.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) years -= 1
  if (years < 0 || years >= 130) return null
  return `${years}`
}

export async function loadCertificadoMedicoPdfInput(
  eventId: string,
  eventTestId: string,
  options?: { userId?: string },
): Promise<
  { ok: true; data: CertificadoMedicoPdfInput } | { ok: false; status: number; message: string }
> {
  if (!eventTestId?.trim()) {
    return { ok: false, status: 400, message: 'eventTestId requerido.' }
  }

  const eventTest = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: {
      id: true,
      eventId: true,
      testNameSnapshot: true,
      clinicalContext: true,
      event: {
        select: {
          id: true,
          checkInDate: true,
          createdAt: true,
          exam: {
            select: {
              somatometryData: true,
              eyeAcuityData: true,
            },
          },
          worker: {
            select: {
              firstName: true,
              lastName: true,
              nationalId: true,
              dob: true,
              clinicalHistory: { select: { data: true } },
            },
          },
        },
      },
    },
  })

  if (!eventTest || eventTest.eventId !== eventId) {
    return { ok: false, status: 404, message: 'Estudio no encontrado en este evento.' }
  }
  if (!isCertificadoMedicoTestName(eventTest.testNameSnapshot)) {
    return { ok: false, status: 400, message: 'El estudio no es un certificado médico.' }
  }

  const certificadoRaw = parseCertificadoMedicoDraftContext(eventTest.clinicalContext)
  const isDraft = !certificadoRaw?.cerrada_at?.trim()

  const event = eventTest.event
  const eventDateRaw = event.checkInDate ?? event.createdAt
  const worker = event.worker
  const hist = worker.clinicalHistory?.data
  const histObj =
    hist && typeof hist === 'object' && !Array.isArray(hist) ? (hist as Record<string, unknown>) : null

  let doctorFullName: string | null = null
  let doctorLicense: string | null = null
  if (
    options?.userId &&
    (!certificadoRaw?.medico_nombre?.trim() || !certificadoRaw?.medico_cedula?.trim())
  ) {
    const user = await prisma.user.findUnique({
      where: { id: options.userId },
      select: { fullName: true, professionalLicense: true },
    })
    doctorFullName = user?.fullName ?? null
    doctorLicense = user?.professionalLicense ?? null
  }

  const metadata = resolveCertificadoMedicoMetadata({
    parsed: certificadoRaw,
    workerNationalId: worker.nationalId,
    longitudinalData: histObj,
    doctorFullName,
    doctorLicense,
    eventAt: eventDateRaw,
  })

  const somaData =
    event.exam?.somatometryData &&
    typeof event.exam.somatometryData === 'object' &&
    !Array.isArray(event.exam.somatometryData)
      ? (event.exam.somatometryData as Record<string, unknown>)
      : null
  const eyeData =
    event.exam?.eyeAcuityData &&
    typeof event.exam.eyeAcuityData === 'object' &&
    !Array.isArray(event.exam.eyeAcuityData)
      ? (event.exam.eyeAcuityData as Record<string, unknown>)
      : null

  const mergedSignos = mergeCertificadoSignosPrefill(
    certificadoRaw?.signos_vitales,
    somaData,
    eyeData,
  )
  const { imc, imcValue } = computeBmi(mergedSignos.peso_kg, mergedSignos.talla_m)
  const complexion = complexionFromImc(imcValue)
  const signosVitales = {
    ...mergedSignos,
    imc: mergedSignos.imc?.trim() || imc || '',
    complexion: mergedSignos.complexion?.trim() || complexion || '',
  }

  const dictamen = certificadoRaw?.dictamen_laboral ?? 'APTO'
  const certificado: CertificadoMedicoPayload = {
    schemaVersion: CERTIFICADO_MEDICO_SCHEMA_VERSION,
    ...metadata,
    signos_vitales: signosVitales,
    exploracion_fisica:
      certificadoRaw?.exploracion_fisica !== undefined
        ? certificadoRaw.exploracion_fisica
        : buildDefaultExploracionCertificado(),
    integracion_diagnostica: certificadoRaw?.integracion_diagnostica ?? '',
    dictamen_laboral: dictamen,
    dictamen_laboral_texto:
      certificadoRaw?.dictamen_laboral_texto !== undefined
        ? certificadoRaw.dictamen_laboral_texto
        : DEFAULT_DICTAMEN_LABORAL_TEXTO[dictamen],
    antecedentes: deepMergeAntecedentes(
      histObj,
      certificadoRaw?.antecedentes as Record<string, unknown> | null | undefined,
    ) as CertificadoMedicoPayload['antecedentes'],
    cerrada_at: certificadoRaw?.cerrada_at,
  }

  const sexo = certificado.sexo_atencion?.trim() || null
  const domicilio = certificado.domicilio_atencion?.trim() || null

  const edadNum = worker.dob ? computeEdad(worker.dob, eventDateRaw) : null
  const logoUrl = await resolveSmeLogoDataUrl()
  const folio = `CM-${eventTest.event.id.slice(0, 8).toUpperCase()}`

  const data: CertificadoMedicoPdfInput = {
    lugarFecha: `${certificado.lugar_expedicion} a ${formatLongDate(eventDateRaw)}`,
    isDraft,
    logoUrl,
    folio,
    patient: {
      nombre: `${worker.firstName} ${worker.lastName}`.trim(),
      edad: edadNum,
      sexo,
      domicilio,
      identificacionTipo: certificado.identificacion_tipo?.trim() || 'INE',
      identificacionFolio: certificado.identificacion_folio?.trim() || worker.nationalId,
      horaAtencion: certificado.hora_atencion?.trim() || null,
    },
    certificado,
  }

  return { ok: true, data }
}
