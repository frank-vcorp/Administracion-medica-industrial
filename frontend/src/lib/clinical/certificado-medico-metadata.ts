import {
  DEFAULT_LUGAR_EXPEDICION,
  type CertificadoMedicoPayload,
} from '@/schemas/clinical/certificado-medico.schema'
import {
  defaultHoraAtencionMexico,
  prefillCertificadoPatientFields,
} from '@/lib/clinical/certificado-medico-prefill'

export type CertificadoMetadataSources = {
  parsed?: Partial<CertificadoMedicoPayload> | null
  workerNationalId?: string | null
  longitudinalData?: Record<string, unknown> | null
  doctorFullName?: string | null
  doctorLicense?: string | null
  sessionUserName?: string | null
  /** Momento de la visita (check-in del evento) para hora de atención en PDF. */
  eventAt?: Date | string | null
}

export function formatHoraAtencionFromEvent(eventAt: Date): string {
  return eventAt.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Mexico_City',
  })
}

function coerceEventDate(eventAt: CertificadoMetadataSources['eventAt']): Date {
  if (eventAt instanceof Date && !Number.isNaN(eventAt.getTime())) return eventAt
  if (typeof eventAt === 'string' && eventAt.trim()) {
    const d = new Date(eventAt)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

/**
 * Campos de expedición / paciente / médico: no se capturan en UI;
 * se resuelven al guardar, cerrar o generar PDF.
 */
export function resolveCertificadoMedicoMetadata(
  sources: CertificadoMetadataSources,
): Pick<
  CertificadoMedicoPayload,
  | 'lugar_expedicion'
  | 'hora_atencion'
  | 'sexo_atencion'
  | 'domicilio_atencion'
  | 'identificacion_tipo'
  | 'identificacion_folio'
  | 'medico_nombre'
  | 'medico_cedula'
  | 'medico_titulo'
  | 'medico_universidad'
> {
  const parsed = sources.parsed
  const patient = prefillCertificadoPatientFields({
    parsedFolio: parsed?.identificacion_folio,
    workerNationalId: sources.workerNationalId,
    parsedSexo: parsed?.sexo_atencion,
    parsedDomicilio: parsed?.domicilio_atencion,
    longitudinalData: sources.longitudinalData ?? null,
  })

  const eventDate = coerceEventDate(sources.eventAt)
  const hora =
    parsed?.hora_atencion?.trim() ||
    formatHoraAtencionFromEvent(eventDate) ||
    defaultHoraAtencionMexico(eventDate)

  const medicoNombre =
    parsed?.medico_nombre?.trim() ||
    sources.doctorFullName?.trim() ||
    sources.sessionUserName?.trim() ||
    'Médico'
  const medicoCedula =
    parsed?.medico_cedula?.trim() || sources.doctorLicense?.trim() || '—'

  return {
    lugar_expedicion: parsed?.lugar_expedicion?.trim() || DEFAULT_LUGAR_EXPEDICION,
    hora_atencion: hora,
    sexo_atencion: patient.sexo_atencion.trim() || undefined,
    domicilio_atencion: patient.domicilio_atencion.trim() || undefined,
    identificacion_tipo: parsed?.identificacion_tipo?.trim() || 'INE',
    identificacion_folio: patient.identificacion_folio.trim() || undefined,
    medico_nombre: medicoNombre,
    medico_cedula: medicoCedula,
    medico_titulo: parsed?.medico_titulo?.trim() || 'Médico General',
    medico_universidad: parsed?.medico_universidad?.trim() || undefined,
  }
}
