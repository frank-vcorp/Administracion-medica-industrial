/**
 * Genera PDF desde un evento real en BD (misma lógica que la ruta API).
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'node:fs'
import {
  buildExamenMedicoPdfData,
  generateExamenMedicoValidatedPdf,
  resolveAmiLogoDataUrl,
} from '../src/lib/examen-medico-pdf'
import {
  isExamenMedicoTestName,
  resolveExamenMedicoVariant,
} from '../src/lib/clinical/examen-medico-variant'

const eventId = process.argv[2] ?? '5fc474fb-f995-4f40-a73c-54ee2a9bac9a'
const prisma = new PrismaClient()

function str(v: unknown): string {
  return typeof v === 'string' ? v : v != null ? String(v) : ''
}

async function main() {
  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    include: {
      worker: { include: { company: true, clinicalHistory: true } },
      exam: true,
      verdict: { include: { validator: true } },
      eventTests: true,
    },
  })
  if (!event?.exam || !event.verdict) throw new Error('Event missing exam or verdict')

  const physical = (event.exam.physicalExamData as Record<string, unknown>) ?? {}
  const examTest = event.eventTests.find((t) => isExamenMedicoTestName(t.testNameSnapshot))
  const variant = resolveExamenMedicoVariant(
    examTest?.testNameSnapshot,
    str(physical.exam_variant) || null,
  )
  const variantExtensions =
    (physical.variant_extensions as Record<string, unknown> | undefined) ?? {}

  const soma = (event.exam.somatometryData as Record<string, unknown>) ?? {}
  const taSist = soma.ta_sistolica
  const taDiast = soma.ta_diastolica
  const ta =
    taSist && taDiast ? `${taSist}/${taDiast}` : str(event.exam.bloodPressure)

  const data = buildExamenMedicoPdfData({
    folio: event.verdict.id.slice(0, 8),
    signedAt: event.verdict.signedAt,
    status: 'SIGNED',
    worker: {
      nombreCompleto: `${event.worker.firstName} ${event.worker.lastName}`,
      fechaNacimiento: event.worker.dob?.toLocaleDateString('es-MX') ?? '',
      edad: '',
      sexo: 'M',
      empresa: event.worker.company?.name ?? '',
      puesto: '',
    },
    ahf: {},
    apnp: {},
    historiaOcupacional: { narrativa: str(physical.historia_ocupacional) },
    app: { texto: str(physical.app) },
    somatometria: {
      peso: str(soma.peso_kg),
      talla: str(soma.talla_m),
      imc: str(soma.imc),
      ta,
    },
    agudezaVisual: {},
    exploracion: (physical.exploracion as Record<string, string>) ?? {},
    impresionDiagnostica: str(physical.impresion_diagnostica),
    aptitud: str(physical.aptitud),
    restricciones: '',
    observacionesFinales: event.verdict.recommendations ?? '',
    medico: {
      fullName: event.verdict.validator.fullName ?? 'Dr',
      professionalLicense: event.verdict.validator.professionalLicense ?? '',
      signatureImageUrl: event.verdict.validator.signatureImageUrl ?? '',
    },
    slots: {},
    logoDataUrl: await resolveAmiLogoDataUrl(),
    variant,
    variantExtensions,
  })

  const result = await generateExamenMedicoValidatedPdf({ data, eventId })
  const out = `/tmp/examen-event-${eventId.slice(0, 8)}.pdf`
  writeFileSync(out, result.buffer)
  console.log('variant:', variant)
  console.log('PDF:', out, result.buffer.length, 'bytes')
  console.log('extensions:', JSON.stringify(variantExtensions, null, 2).slice(0, 500))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
