import { z } from 'zod'
import { ClinicalHistoryDataSchema } from '@/schemas/clinical/history.schema'

export const CERTIFICADO_MEDICO_SCHEMA_VERSION = 'certificado-medico-v1' as const

export const DICTAMEN_LABORAL_VALUES = [
  'APTO',
  'NO_APTO',
  'CON_OBSERVACIONES',
  'OTRO',
] as const

export type DictamenLaboralValue = (typeof DICTAMEN_LABORAL_VALUES)[number]

export const DICTAMEN_LABORAL_LABELS: Record<DictamenLaboralValue, string> = {
  APTO: 'Apto para actividades laborales',
  NO_APTO: 'No apto para actividades laborales',
  CON_OBSERVACIONES: 'Apto con observaciones',
  OTRO: 'Otro (texto libre)',
}

export const DEFAULT_DICTAMEN_LABORAL_TEXTO: Record<DictamenLaboralValue, string> = {
  APTO: 'Apto para realizar actividades laborales.',
  NO_APTO: 'No apto para realizar actividades laborales en las condiciones evaluadas.',
  CON_OBSERVACIONES:
    'Apto para realizar actividades laborales con las observaciones descritas en la integración diagnóstica.',
  OTRO: '',
}

export const DEFAULT_LUGAR_EXPEDICION = 'Santiago de Querétaro, Querétaro'

const cleanString = z.string().trim()
const optionalString = cleanString.max(8000).optional().or(z.literal(''))

export const SignosVitalesCertificadoSchema = z.object({
  peso_kg: optionalString,
  talla_m: optionalString,
  imc: optionalString,
  complexion: optionalString,
  ta_sistolica: optionalString,
  ta_diastolica: optionalString,
  fc_min: optionalString,
  fr_min: optionalString,
  temperatura: optionalString,
  spo2_pct: optionalString,
  agudeza_vl: optionalString,
  agudeza_vlc: optionalString,
  agudeza_vc: optionalString,
  agudeza_vcc: optionalString,
})

export const CertificadoMedicoPayloadSchema = z.object({
  schemaVersion: z.literal(CERTIFICADO_MEDICO_SCHEMA_VERSION),
  lugar_expedicion: cleanString.min(3).max(200),
  hora_atencion: optionalString,
  sexo_atencion: optionalString,
  domicilio_atencion: optionalString,
  identificacion_tipo: optionalString,
  identificacion_folio: optionalString,
  medico_nombre: cleanString.min(1).max(200),
  medico_cedula: cleanString.min(1).max(50),
  medico_titulo: optionalString,
  medico_universidad: optionalString,
  signos_vitales: SignosVitalesCertificadoSchema,
  exploracion_fisica: cleanString.min(10).max(12000),
  integracion_diagnostica: cleanString.min(3).max(4000),
  dictamen_laboral: z.enum(DICTAMEN_LABORAL_VALUES),
  dictamen_laboral_texto: cleanString.min(3).max(2000),
  antecedentes: ClinicalHistoryDataSchema.optional(),
  cerrada_at: z.string().datetime().optional(),
})

export type CertificadoMedicoPayload = z.infer<typeof CertificadoMedicoPayloadSchema>

export const CertificadoMedicoDraftSchema = CertificadoMedicoPayloadSchema.partial().required({
  schemaVersion: true,
})

export function emptySignosVitalesCertificado(): z.infer<typeof SignosVitalesCertificadoSchema> {
  return {
    peso_kg: '',
    talla_m: '',
    imc: '',
    complexion: '',
    ta_sistolica: '',
    ta_diastolica: '',
    fc_min: '',
    fr_min: '',
    temperatura: '',
    spo2_pct: '',
    agudeza_vl: '',
    agudeza_vlc: '',
    agudeza_vc: '',
    agudeza_vcc: '',
  }
}

export function buildDefaultExploracionCertificado(): string {
  return [
    'Se encuentra paciente consciente, orientado en espacio, tiempo, persona y situación.',
    'Con buen estado de hidratación. Resto de la exploración sin alteraciones relevantes.',
  ].join(' ')
}
