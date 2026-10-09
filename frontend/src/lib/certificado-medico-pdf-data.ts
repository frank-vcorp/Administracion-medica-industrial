import prisma from '@/lib/prisma'
import {
  isCertificadoMedicoTestName,
  parseCertificadoMedicoClinicalContext,
} from '@/lib/clinical/certificado-medico'
import type { CertificadoMedicoPdfInput } from '@/lib/certificado-medico-pdf'

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

  const certificado = parseCertificadoMedicoClinicalContext(eventTest.clinicalContext)
  if (!certificado) {
    return { ok: false, status: 404, message: 'El certificado aún no tiene captura.' }
  }
  if (!certificado.cerrada_at) {
    return { ok: false, status: 403, message: 'El certificado debe estar cerrado para generar PDF.' }
  }

  const event = eventTest.event
  const eventDateRaw = event.checkInDate ?? event.createdAt
  const worker = event.worker
  const hist = worker.clinicalHistory?.data
  const histObj =
    hist && typeof hist === 'object' && !Array.isArray(hist) ? (hist as Record<string, unknown>) : null
  const dp = histObj?.datos_personales as Record<string, unknown> | undefined

  const sexo =
    certificado.sexo_atencion?.trim() ||
    (typeof dp?.sexo === 'string' ? dp.sexo : null) ||
    (typeof dp?.genero === 'string' ? dp.genero : null) ||
    null

  const domicilio =
    certificado.domicilio_atencion?.trim() ||
    (typeof dp?.direccion === 'string' ? dp.direccion : null) ||
    (typeof dp?.domicilio === 'string' ? dp.domicilio : null) ||
    null

  const edadNum = worker.dob ? computeEdad(worker.dob, eventDateRaw) : null

  const data: CertificadoMedicoPdfInput = {
    lugarFecha: `${certificado.lugar_expedicion} a ${formatLongDate(eventDateRaw)}`,
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
