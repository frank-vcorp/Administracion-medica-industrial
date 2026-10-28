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
  /** Gineco / vacunas (ex Módulo 1) copiados del perfil o del examen de la visita. */
  modulo1: z.record(z.string(), z.string()).optional(),
  cerrada_at: z.string().datetime().optional(),
})

export type ConsultaMedicaPayload = z.infer<typeof ConsultaMedicaPayloadSchema>

const draftText = z.string().trim().max(12000)

/**
 * Borrador: solo exige la versión. Los textos vacíos y las líneas de
 * medicamento a medias son válidos. El cierre sigue usando el schema estricto.
 * `.partial()` no sirve: si el campo viene como "" igual exige min().
 */
export const ConsultaMedicaDraftSchema = z.object({
  schemaVersion: z.literal(CONSULTA_MEDICA_SCHEMA_VERSION),
  tipo_consulta: z.enum(TIPO_CONSULTA_VALUES).optional(),
  motivo_consulta: draftText.optional(),
  signos_vitales: SignosVitalesConsultaSchema.optional(),
  exploracion_fisica: draftText.optional(),
  diagnostico_sistema: draftText.max(500).optional(),
  diagnostico_unificado: draftText.max(500).optional(),
  diagnostico_especifico: draftText.max(2000).optional(),
  incapacidad_aplica: z.boolean().optional(),
  otorga_incapacidad: z.enum(['SI', 'NO']).optional(),
  dias_incapacidad: z.number().int().min(0).max(365).optional(),
  pase_salida: z.enum(['SI', 'NO']).optional(),
  material_medico: optionalString,
  indicaciones_generales: optionalString,
  receta_lineas: z
    .array(
      z.object({
        medicamento: draftText.max(500).optional().or(z.literal('')),
        presentacion: optionalString,
        dosis: draftText.max(300).optional().or(z.literal('')),
        frecuencia: draftText.max(300).optional().or(z.literal('')),
        duracion: draftText.max(300).optional().or(z.literal('')),
      }),
    )
    .max(30)
    .optional(),
  medico_nombre: draftText.max(200).optional(),
  medico_cedula: draftText.max(50).optional(),
  antecedentes: ClinicalHistoryDataSchema.optional(),
  modulo1: z.record(z.string(), z.string()).optional(),
  cerrada_at: z.string().datetime().optional(),
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
