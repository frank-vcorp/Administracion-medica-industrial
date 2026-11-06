import prisma from '@/lib/prisma'
import {
  isConsultaMedicaTestName,
  parseConsultaMedicaClinicalContext,
} from '@/lib/clinical/consulta-medica'
import { normalizeConsultaClinicalContext } from '@/lib/clinical/consulta-medica-validate'
import {
  buildFechaLugarReceta,
  buildLugarReceta,
  formatFechaRecetaCorta,
} from '@/lib/clinical/consulta-receta-pdf-format'
import type { ConsultaMedicaPdfInput } from '@/lib/consulta-medica-pdf'
import {
  CONSULTA_MEDICA_SCHEMA_VERSION,
  emptySignosVitalesConsulta,
  type ConsultaMedicaPayload,
} from '@/schemas/clinical/consulta-medica.schema'

export async function loadConsultaMedicaPdfInput(
  eventId: string,
): Promise<{ ok: true; data: ConsultaMedicaPdfInput } | { ok: false; status: number; message: string }> {
  const event = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    include: {
      branch: { select: { name: true, address: true } },
      worker: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          dob: true,
          company: { select: { name: true } },
        },
      },
      eventTests: {
        select: {
          testNameSnapshot: true,
          clinicalContext: true,
        },
      },
    },
  })

  if (!event) {
    return { ok: false, status: 404, message: 'Evento no encontrado.' }
  }

  const consultaTest = event.eventTests.find((t) =>
    isConsultaMedicaTestName(t.testNameSnapshot),
  )
  if (!consultaTest) {
    return { ok: false, status: 404, message: 'No hay consulta médica en esta papeleta.' }
  }

  const stored = parseConsultaMedicaClinicalContext(consultaTest.clinicalContext)
  if (!stored) {
    return { ok: false, status: 404, message: 'La consulta médica aún no tiene captura.' }
  }

  const normalized = normalizeConsultaClinicalContext(stored as Record<string, unknown>)

  const consulta: ConsultaMedicaPayload = {
    schemaVersion: CONSULTA_MEDICA_SCHEMA_VERSION,
    tipo_consulta: (normalized.tipo_consulta as ConsultaMedicaPayload['tipo_consulta']) ?? 'ENFERMEDAD_GENERAL',
    motivo_consulta: String(normalized.motivo_consulta ?? ''),
    signos_vitales: (normalized.signos_vitales as ConsultaMedicaPayload['signos_vitales']) ?? emptySignosVitalesConsulta(),
    exploracion_fisica: String(normalized.exploracion_fisica ?? ''),
    diagnostico_unificado: String(normalized.diagnostico_unificado ?? ''),
    diagnostico_especifico: String(normalized.diagnostico_especifico ?? ''),
    incapacidad_aplica: Boolean(normalized.incapacidad_aplica),
    otorga_incapacidad: (normalized.otorga_incapacidad as 'SI' | 'NO') ?? 'NO',
    tipo_incapacidad: normalized.tipo_incapacidad as ConsultaMedicaPayload['tipo_incapacidad'],
    dias_incapacidad: normalized.dias_incapacidad as number | undefined,
    material_medico: normalized.material_medico as string | undefined,
    indicaciones_generales: normalized.indicaciones_generales as string | undefined,
    receta_lineas: ((normalized.receta_lineas ?? stored.receta_lineas) ?? [])
      .filter((line: { medicamento?: string }) => (line.medicamento ?? '').trim().length > 0)
      .map((line: {
        medicamento?: string
        presentacion?: string
        dosis?: string
        frecuencia?: string
        duracion?: string
      }) => ({
        medicamento: line.medicamento ?? '',
        presentacion: line.presentacion,
        dosis: line.dosis?.trim() || '—',
        frecuencia: line.frecuencia?.trim() || '—',
        duracion: line.duracion?.trim() || '—',
      })),
    medico_nombre: String(normalized.medico_nombre ?? stored.medico_nombre ?? '').trim() || 'Médico',
    medico_cedula: String(normalized.medico_cedula ?? stored.medico_cedula ?? '').trim() || '—',
    antecedentes: normalized.antecedentes ?? stored.antecedentes,
    antecedentes_consulta: normalized.antecedentes_consulta as ConsultaMedicaPayload['antecedentes_consulta'] ?? stored.antecedentes_consulta,
    modulo1: (normalized.modulo1 as ConsultaMedicaPayload['modulo1']) ?? stored.modulo1,
    cerrada_at: (normalized.cerrada_at as string | undefined) ?? stored.cerrada_at,
  }

  const eventDateRaw = stored.cerrada_at
    ? new Date(stored.cerrada_at)
    : (event.checkInDate ?? event.createdAt)
  const lugar = buildLugarReceta(event.branch)
  const fecha = formatFechaRecetaCorta(eventDateRaw)
  const fechaLegal = buildFechaLugarReceta(lugar, eventDateRaw)

  let edad: string | null = null
  if (event.worker.dob) {
    const asOf = eventDateRaw
    let years = asOf.getFullYear() - event.worker.dob.getFullYear()
    const m = asOf.getMonth() - event.worker.dob.getMonth()
    if (m < 0 || (m === 0 && asOf.getDate() < event.worker.dob.getDate())) years -= 1
    if (years >= 0 && years < 130) edad = `${years} años`
  }

  const data: ConsultaMedicaPdfInput = {
    patient: {
      nombre: `${event.worker.firstName} ${event.worker.lastName}`.trim(),
      telefono: event.worker.phone,
      sexo: stored.modulo1?.m1_sexo?.trim() || null,
      edad,
      empresa: event.worker.company?.name ?? null,
      departamento: null,
      fecha,
      fechaLegal,
      lugar,
      folio: event.id.slice(0, 8).toUpperCase(),
    },
    consulta,
  }

  return { ok: true, data }
}
