/**
 * Identificación del paciente — bloque común en PDFs validados por estudio.
 */
import prisma from '@/lib/prisma'

export type PatientIdentificationPdf = {
  fullName: string
  universalId: string | null
  companyName: string | null
  sexLabel: string | null
  ageLabel: string | null
  attentionDate: string | null
  /** Somatometría / vitales de referencia (mismo bloque en todos los PDF). */
  weightLabel: string | null
  heightLabel: string | null
  temperatureLabel: string | null
  heartRateLabel: string | null
  bloodPressureLabel: string | null
}

export function formatPdfGender(g: string | null | undefined): string {
  if (!g || g.trim() === '' || g === '—') return '—'
  const u = g.trim().toUpperCase()
  if (u === 'M' || u === 'MALE' || u === 'MASCULINO') return 'Masculino'
  if (u === 'F' || u === 'FEMALE' || u === 'FEMENINO') return 'Femenino'
  return g.trim()
}

export function formatPdfAgeYears(ageYears: number | null | undefined): string {
  if (ageYears == null || !Number.isFinite(ageYears) || ageYears < 0 || ageYears > 130) {
    return '—'
  }
  return `${ageYears} años`
}

export function formatPdfAttentionDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function buildPatientIdentificationPdf(input: {
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  universalId?: string | null
  companyName?: string | null
  sexLabel?: string | null
  ageYears?: number | null
  ageLabel?: string | null
  attentionDate?: Date | string | null
  weightLabel?: string | null
  heightLabel?: string | null
  temperatureLabel?: string | null
  heartRateLabel?: string | null
  bloodPressureLabel?: string | null
}): PatientIdentificationPdf {
  const fromParts = `${input.firstName ?? ''} ${input.lastName ?? ''}`.trim()
  const fullName = (input.fullName?.trim() || fromParts || '—').trim() || '—'

  const ageLabel =
    input.ageLabel?.trim() ||
    (input.ageYears != null ? formatPdfAgeYears(input.ageYears) : null) ||
    '—'

  return {
    fullName,
    universalId: input.universalId?.trim() || null,
    companyName: input.companyName?.trim() || null,
    sexLabel: input.sexLabel?.trim() || null,
    ageLabel: ageLabel === '—' ? null : ageLabel,
    attentionDate: input.attentionDate
      ? formatPdfAttentionDate(input.attentionDate)
      : null,
    weightLabel: normalizePdfVitalLabel(input.weightLabel),
    heightLabel: normalizePdfVitalLabel(input.heightLabel),
    temperatureLabel: normalizePdfVitalLabel(input.temperatureLabel),
    heartRateLabel: normalizePdfVitalLabel(input.heartRateLabel),
    bloodPressureLabel: normalizePdfVitalLabel(input.bloodPressureLabel),
  }
}

function normalizePdfVitalLabel(value: string | null | undefined): string | null {
  const t = value?.trim()
  if (!t || t === '—') return null
  return t
}

function readScalarField(
  ...candidates: Array<string | number | null | undefined>
): string | null {
  for (const c of candidates) {
    if (c === null || c === undefined) continue
    const t = String(c).trim()
    if (t.length > 0) return t
  }
  return null
}

function readBloodPressureLabel(
  somatometry: Record<string, unknown>,
  vitalSigns: Record<string, unknown>,
  physicalExamData: Record<string, unknown> | null,
): string | null {
  const sist = readScalarField(
    somatometry.ta_sistolica,
    vitalSigns.ta_sistolica,
  )
  const diast = readScalarField(
    somatometry.ta_diastolica,
    vitalSigns.ta_diastolica,
  )
  if (sist && diast) return `${sist}/${diast} mmHg`
  const combined = readScalarField(
    physicalExamData?.ta,
    physicalExamData?.tension_arterial,
    somatometry.ta,
    vitalSigns.ta,
    somatometry.tension_arterial,
    vitalSigns.tension_arterial,
  )
  if (!combined) return null
  return combined.includes('mmHg') ? combined : `${combined} mmHg`
}

/** Peso, talla, T°, FC y TA desde snapshots del examen (sin inventar). */
export function readBasicVitalsForPatientPdf(input: {
  somatometryData?: Record<string, unknown> | null
  vitalSignsData?: Record<string, unknown> | null
  physicalExamData?: Record<string, unknown> | null
}): Pick<
  PatientIdentificationPdf,
  | 'weightLabel'
  | 'heightLabel'
  | 'temperatureLabel'
  | 'heartRateLabel'
  | 'bloodPressureLabel'
> {
  const soma = input.somatometryData ?? {}
  const vitals = input.vitalSignsData ?? {}
  const pe = input.physicalExamData

  const peso = readScalarField(soma.peso_kg, vitals.peso_kg)
  const talla = readScalarField(soma.talla_m, vitals.talla_m)
  const temp = readScalarField(soma.temperatura, vitals.temperatura)
  const fc = readScalarField(soma.fc_min, vitals.fc_min)

  return {
    weightLabel: peso ? `${peso} kg` : null,
    heightLabel: talla ? `${talla} m` : null,
    temperatureLabel: temp ? `${temp} °C` : null,
    heartRateLabel: fc ? `${fc} lpm` : null,
    bloodPressureLabel: readBloodPressureLabel(soma, vitals, pe ?? null),
  }
}

function readSexFromPhysicalExam(
  physicalExamData: Record<string, unknown> | null,
): string | null {
  if (!physicalExamData) return null
  const datosPersonales =
    (physicalExamData.datos_personales as Record<string, unknown> | null) ?? {}
  const modulo1 = (physicalExamData.modulo1 as Record<string, unknown> | null) ?? {}
  const candidates = [
    physicalExamData.sexo,
    datosPersonales.sexo,
    modulo1.m1_sexo,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

/** Completa sexo, edad y fecha de atención desde el evento clínico. */
export async function resolvePatientIdentificationForPdf(args: {
  eventId: string | null | undefined
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  universalId?: string | null
  companyName?: string | null
  sexLabel?: string | null
  ageYears?: number | null
  ageLabel?: string | null
  attentionDate?: Date | string | null
}): Promise<PatientIdentificationPdf> {
  const base = buildPatientIdentificationPdf(args)
  if (!args.eventId) return base

  const event = await prisma.medicalEvent.findUnique({
    where: { id: args.eventId },
    select: {
      checkInDate: true,
      createdAt: true,
      worker: {
        select: {
          dob: true,
          universalId: true,
          company: { select: { name: true } },
        },
      },
    },
  })
  if (!event) return base

  const exam = await prisma.medicalExam.findUnique({
    where: { eventId: args.eventId },
    select: {
      physicalExamData: true,
      somatometryData: true,
      vitalSignsData: true,
    },
  })
  const physicalExamData =
    (exam?.physicalExamData as Record<string, unknown> | null) ?? null
  const basicVitals = readBasicVitalsForPatientPdf({
    somatometryData: (exam?.somatometryData as Record<string, unknown> | null) ?? null,
    vitalSignsData: (exam?.vitalSignsData as Record<string, unknown> | null) ?? null,
    physicalExamData,
  })

  const eventDate = event.checkInDate ?? event.createdAt
  const dob = event.worker?.dob
  let ageYears = args.ageYears ?? null
  if (ageYears == null && dob) {
    let age = eventDate.getFullYear() - dob.getFullYear()
    const m = eventDate.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && eventDate.getDate() < dob.getDate())) age -= 1
    if (age >= 0 && age < 130) ageYears = age
  }

  const sexLabel = base.sexLabel ?? readSexFromPhysicalExam(physicalExamData)

  return buildPatientIdentificationPdf({
    firstName: args.firstName,
    lastName: args.lastName,
    fullName: base.fullName,
    universalId: base.universalId ?? event.worker?.universalId ?? null,
    companyName: base.companyName ?? event.worker?.company?.name ?? null,
    sexLabel,
    ageYears,
    attentionDate: args.attentionDate ?? eventDate,
    weightLabel: args.weightLabel ?? basicVitals.weightLabel,
    heightLabel: args.heightLabel ?? basicVitals.heightLabel,
    temperatureLabel: args.temperatureLabel ?? basicVitals.temperatureLabel,
    heartRateLabel: args.heartRateLabel ?? basicVitals.heartRateLabel,
    bloodPressureLabel: args.bloodPressureLabel ?? basicVitals.bloodPressureLabel,
  })
}
