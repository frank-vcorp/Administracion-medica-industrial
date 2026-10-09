import { z } from 'zod'
import { ClinicalHistoryDataSchema } from '@/schemas/clinical/history.schema'

export const CONSULTA_MEDICA_SCHEMA_VERSION = 'consulta-medica-v1' as const

export const TIPO_CONSULTA_VALUES = [
  'ENFERMEDAD_GENERAL',
  'ENFERMEDAD_PROFESIONAL',
  'ACCIDENTE_TRABAJO',
  'ACCIDENTE_TRAYECTO',
  'PRIMER_AUXILIO',
  'INCIDENTE',
] as const

export type TipoConsultaValue = (typeof TIPO_CONSULTA_VALUES)[number]

export const TIPO_CONSULTA_LABELS: Record<TipoConsultaValue, string> = {
  ENFERMEDAD_GENERAL: 'Enfermedad general',
  ENFERMEDAD_PROFESIONAL: 'Enfermedad profesional',
  ACCIDENTE_TRABAJO: 'Accidente de trabajo',
  ACCIDENTE_TRAYECTO: 'Accidente de trayecto',
  PRIMER_AUXILIO: 'Primer auxilio',
  INCIDENTE: 'Incidente',
}

const cleanString = z.string().trim()
const optionalString = cleanString.max(8000).optional().or(z.literal(''))

export const RecetaLineaSchema = z.object({
  medicamento: cleanString.min(1).max(500),
  presentacion: optionalString,
  dosis: cleanString.min(1).max(300),
  frecuencia: cleanString.min(1).max(300),
  duracion: cleanString.min(1).max(300),
})

export type RecetaLinea = z.infer<typeof RecetaLineaSchema>

export const SignosVitalesConsultaSchema = z.object({
  ta_sistolica: optionalString,
  ta_diastolica: optionalString,
  fc_min: optionalString,
  fr_min: optionalString,
  temperatura: optionalString,
  peso_kg: optionalString,
  talla_m: optionalString,
  imc: optionalString,
  complexion: optionalString,
})

export const ConsultaMedicaPayloadSchema = z.object({
  schemaVersion: z.literal(CONSULTA_MEDICA_SCHEMA_VERSION),
  tipo_consulta: z.enum(TIPO_CONSULTA_VALUES),
  motivo_consulta: cleanString.min(10).max(8000),
  signos_vitales: SignosVitalesConsultaSchema,
  exploracion_fisica: cleanString.min(10).max(12000),
  diagnostico_sistema: cleanString.min(1).max(500),
  diagnostico_unificado: cleanString.min(1).max(500),
  diagnostico_especifico: cleanString.min(1).max(2000),
  incapacidad_aplica: z.boolean(),
  otorga_incapacidad: z.enum(['SI', 'NO']),
  dias_incapacidad: z.number().int().min(0).max(365).optional(),
  pase_salida: z.enum(['SI', 'NO']).optional(),
  material_medico: optionalString,
  indicaciones_generales: optionalString,
  receta_lineas: z.array(RecetaLineaSchema).max(30),
  medico_nombre: cleanString.min(1).max(200),
  medico_cedula: cleanString.min(1).max(50),
  antecedentes: ClinicalHistoryDataSchema.optional(),
  cerrada_at: z.string().datetime().optional(),
})

export type ConsultaMedicaPayload = z.infer<typeof ConsultaMedicaPayloadSchema>

/** Borrador: guardado parcial (solo exige schemaVersion). */
export const ConsultaMedicaDraftSchema = ConsultaMedicaPayloadSchema.partial().required({
  schemaVersion: true,
})

export function emptySignosVitalesConsulta(): z.infer<typeof SignosVitalesConsultaSchema> {
  return {
    ta_sistolica: '',
    ta_diastolica: '',
    fc_min: '',
    fr_min: '',
    temperatura: '',
    peso_kg: '',
    talla_m: '',
    imc: '',
    complexion: '',
  }
}

export function buildDefaultExploracionPlantilla(): string {
  return [
    'PACIENTE CONSCIENTE, ORIENTADO EN TIEMPO, LUGAR Y PERSONA, ALERTA, COOPERADOR, ADECUADA COLORACIÓN MUCOTEGUMENTARIA.',
    'CAMPOS PULMONARES CON ADECUADA ENTRADA Y SALIDA DE AIRE; RUIDOS CARDÍACOS RÍTMICOS, SIN SOPLOS; ABDOMEN BLANDO, DEPRESIBLE.',
  ].join(' ')
}
