import prisma from '@/lib/prisma'
import {
  isConsultaMedicaTestName,
  parseConsultaMedicaClinicalContext,
} from '@/lib/clinical/consulta-medica'
import type { ConsultaMedicaPdfInput } from '@/lib/consulta-medica-pdf'

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

  const consulta = parseConsultaMedicaClinicalContext(consultaTest.clinicalContext)
  if (!consulta) {
    return { ok: false, status: 404, message: 'La consulta médica aún no tiene captura.' }
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
      sexo: null,
      edad,
      empresa: event.worker.company?.name ?? null,
      departamento: null,
      fecha,
    },
    consulta,
  }

  return { ok: true, data }
}
