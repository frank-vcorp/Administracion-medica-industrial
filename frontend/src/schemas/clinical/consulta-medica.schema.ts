import { z } from 'zod'
import { applySentenceCaseIfAllCaps } from '@/lib/text/sentence-case'
import {
  formatCie10Unified,
  isKnownCie10Code,
  parseDiagnosticoUnificadoStored,
} from '@/lib/clinical/cie-10-catalog'
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

const freeText = (max: number, min = 0) =>
  z.string().trim().min(min).max(max).transform(applySentenceCaseIfAllCaps)
const plainString = z.string().trim()
const optionalString = z
  .union([z.literal(''), z.string().trim().max(8000).transform(applySentenceCaseIfAllCaps)])
  .optional()

const diagnosticoUnificadoCieFinal = z
  .string()
  .trim()
  .min(1, 'Selecciona un diagnóstico CIE-10 del catálogo.')
  .max(500)
  .superRefine((val, ctx) => {
    const parsed = parseDiagnosticoUnificadoStored(val)
    if (!parsed || !isKnownCie10Code(parsed.code)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Debe ser un código CIE-10 válido del catálogo.',
      })
    }
  })
  .transform((val) => {
    const parsed = parseDiagnosticoUnificadoStored(val)
    if (parsed) return formatCie10Unified({ code: parsed.code, description: parsed.description })
    return val
  })

const diagnosticoUnificadoCieDraft = z.union([z.literal(''), z.string().trim().max(500)]).optional()

export const RecetaLineaSchema = z.object({
  medicamento: freeText(500, 1),
  presentacion: optionalString,
  dosis: freeText(300, 1),
  frecuencia: freeText(300, 1),
  duracion: freeText(300, 1),
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
  motivo_consulta: freeText(8000, 10),
  signos_vitales: SignosVitalesConsultaSchema,
  exploracion_fisica: freeText(12000, 10),
  diagnostico_unificado: diagnosticoUnificadoCieFinal,
  diagnostico_especifico: freeText(2000, 1),
  incapacidad_aplica: z.boolean(),
  otorga_incapacidad: z.enum(['SI', 'NO']),
  dias_incapacidad: z.number().int().min(0).max(365).optional(),
  pase_salida: z.enum(['SI', 'NO']).optional(),
  material_medico: optionalString,
  indicaciones_generales: optionalString,
  receta_lineas: z.array(RecetaLineaSchema).max(30),
  medico_nombre: freeText(200, 1),
  medico_cedula: plainString.min(1).max(50),
  antecedentes: ClinicalHistoryDataSchema.optional(),
  /** Gineco / vacunas (ex Módulo 1) copiados del perfil o del examen de la visita. */
  modulo1: z.record(z.string(), z.string()).optional(),
  cerrada_at: z.string().datetime().optional(),
})

export type ConsultaMedicaPayload = z.infer<typeof ConsultaMedicaPayloadSchema>

const draftText = (max: number) =>
  z.string().trim().max(max).transform(applySentenceCaseIfAllCaps)

/**
 * Borrador: solo exige la versión. Los textos vacíos y las líneas de
 * medicamento a medias son válidos. El cierre sigue usando el schema estricto.
 * `.partial()` no sirve: si el campo viene como "" igual exige min().
 */
export const ConsultaMedicaDraftSchema = z.object({
  schemaVersion: z.literal(CONSULTA_MEDICA_SCHEMA_VERSION),
  tipo_consulta: z.enum(TIPO_CONSULTA_VALUES).optional(),
  motivo_consulta: draftText(12000).optional(),
  signos_vitales: SignosVitalesConsultaSchema.optional(),
  exploracion_fisica: draftText(12000).optional(),
  diagnostico_unificado: diagnosticoUnificadoCieDraft,
  diagnostico_especifico: draftText(2000).optional(),
  incapacidad_aplica: z.boolean().optional(),
  otorga_incapacidad: z.enum(['SI', 'NO']).optional(),
  dias_incapacidad: z.number().int().min(0).max(365).optional(),
  pase_salida: z.enum(['SI', 'NO']).optional(),
  material_medico: optionalString,
  indicaciones_generales: optionalString,
  receta_lineas: z
    .array(
      z.object({
        medicamento: z.union([z.literal(''), draftText(500)]).optional(),
        presentacion: optionalString,
        dosis: z.union([z.literal(''), draftText(300)]).optional(),
        frecuencia: z.union([z.literal(''), draftText(300)]).optional(),
        duracion: z.union([z.literal(''), draftText(300)]).optional(),
      }),
    )
    .max(30)
    .optional(),
  medico_nombre: draftText(200).optional(),
  medico_cedula: plainString.max(50).optional(),
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
