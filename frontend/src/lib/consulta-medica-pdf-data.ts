import prisma from '@/lib/prisma'
import {
  isConsultaMedicaTestName,
  parseConsultaMedicaClinicalContext,
} from '@/lib/clinical/consulta-medica'
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

  const consulta: ConsultaMedicaPayload = {
    schemaVersion: CONSULTA_MEDICA_SCHEMA_VERSION,
    tipo_consulta: stored.tipo_consulta ?? 'ENFERMEDAD_GENERAL',
    motivo_consulta: stored.motivo_consulta ?? '',
    signos_vitales: stored.signos_vitales ?? emptySignosVitalesConsulta(),
    exploracion_fisica: stored.exploracion_fisica ?? '',
    diagnostico_unificado: stored.diagnostico_unificado ?? '',
    diagnostico_especifico: stored.diagnostico_especifico ?? '',
    incapacidad_aplica: stored.incapacidad_aplica ?? false,
    otorga_incapacidad: stored.otorga_incapacidad ?? 'NO',
    dias_incapacidad: stored.dias_incapacidad,
    pase_salida: stored.pase_salida,
    material_medico: stored.material_medico,
    indicaciones_generales: stored.indicaciones_generales,
    receta_lineas: (stored.receta_lineas ?? [])
      .filter((line) => (line.medicamento ?? '').trim().length > 0)
      .map((line) => ({
        medicamento: line.medicamento ?? '',
        presentacion: line.presentacion,
        dosis: line.dosis?.trim() || '—',
        frecuencia: line.frecuencia?.trim() || '—',
        duracion: line.duracion?.trim() || '—',
      })),
    medico_nombre: stored.medico_nombre?.trim() || 'Médico',
    medico_cedula: stored.medico_cedula?.trim() || '—',
    antecedentes: stored.antecedentes,
    modulo1: stored.modulo1,
    cerrada_at: stored.cerrada_at,
  }

  const eventDateRaw = event.checkInDate ?? event.createdAt
  const fecha = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(eventDateRaw)

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
    },
    consulta,
  }

  return { ok: true, data }
}
