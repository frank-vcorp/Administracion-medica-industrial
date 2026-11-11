import { z } from 'zod'
import { applySentenceCase } from '@/lib/text/sentence-case'
import {
  formatCie10Unified,
  isKnownCie10Code,
  parseDiagnosticoUnificadoStored,
} from '@/lib/clinical/cie-10-catalog'
import { ClinicalHistoryDataSchema } from '@/schemas/clinical/history.schema'
import {
  CONSULTA_MEDICA_ACCEPTED_SCHEMA_VERSIONS,
  CONSULTA_MEDICA_SCHEMA_VERSION,
  TIPO_CONSULTA_VALUES,
  TIPO_INCAPACIDAD_CONSULTA_VALUES,
} from '@/schemas/clinical/consulta-medica.constants'

export {
  CONSULTA_MEDICA_ACCEPTED_SCHEMA_VERSIONS,
  CONSULTA_MEDICA_SCHEMA_VERSION,
  CONSULTA_MEDICA_SCHEMA_VERSION_V1,
  TIPO_CONSULTA_VALUES,
  TIPO_CONSULTA_LABELS,
  TIPO_INCAPACIDAD_CONSULTA_VALUES,
  TIPO_INCAPACIDAD_CONSULTA_LABELS,
  buildDefaultExploracionPlantilla,
  emptySignosVitalesConsulta,
  type ConsultaMedicaPayload,
  type RecetaLinea,
  type TipoConsultaValue,
} from '@/schemas/clinical/consulta-medica.constants'

const freeText = (max: number, min = 0) =>
  z.string().trim().min(min).max(max).transform(applySentenceCase)
const plainString = z.string().trim()
const optionalString = z
  .union([z.literal(''), z.string().trim().max(8000).transform(applySentenceCase)])
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

/** Texto libre de fecha/hora. Vacío, null o ausente quedan fuera del payload (DA-1). */
const optionalManualText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(''), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return undefined
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : undefined
    })

const optionalAppointmentId = (strict: boolean) =>
  z
    .union([z.string(), z.literal(''), z.null()])
    .optional()
    .superRefine((value, ctx) => {
      if (value == null) return
      const trimmed = value.trim()
      if (!trimmed) return
      if (strict) {
        if (!z.string().uuid().safeParse(trimmed).success) {
          ctx.addIssue({
            code: 'custom',
            message: 'El id de la cita debe ser un UUID.',
          })
        }
        return
      }
      if (trimmed.length > 64) {
        ctx.addIssue({
          code: 'custom',
          message: 'El id de la cita es demasiado largo.',
        })
      }
    })
    .transform((value) => {
      if (value == null) return undefined
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : undefined
    })

const proximaCitaDraftFields = {
  proxima_cita_fecha: optionalManualText(200),
  proxima_cita_hora: optionalManualText(80),
  proxima_cita_appointment_id: optionalAppointmentId(false),
}

const proximaCitaFinalFields = {
  proxima_cita_fecha: optionalManualText(200),
  proxima_cita_hora: optionalManualText(80),
  proxima_cita_appointment_id: optionalAppointmentId(true),
}

const acceptedSchemaVersion = z
  .enum(CONSULTA_MEDICA_ACCEPTED_SCHEMA_VERSIONS)
  .transform(() => CONSULTA_MEDICA_SCHEMA_VERSION)

export const RecetaLineaSchema = z.object({
  medicamento: freeText(500, 1),
  presentacion: optionalString,
  dosis: freeText(300, 1),
  frecuencia: freeText(300, 1),
  duracion: freeText(300, 1),
})

export const AntecedentesConsultaResumenSchema = z.object({
  cronico_degenerativos: optionalString,
  traumaticos: optionalString,
  quirurgicos: optionalString,
  transfusionales: optionalString,
  alergicos: optionalString,
  toxicomanias: optionalString,
})

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

export const ConsultaMedicaPayloadSchema = z
  .object({
    schemaVersion: acceptedSchemaVersion,
    tipo_consulta: z.enum(TIPO_CONSULTA_VALUES),
    motivo_consulta: freeText(8000, 10),
    signos_vitales: SignosVitalesConsultaSchema,
    exploracion_fisica: freeText(12000, 10),
    diagnostico_unificado: diagnosticoUnificadoCieFinal,
    diagnostico_especifico: freeText(2000, 1),
    incapacidad_aplica: z.boolean(),
    otorga_incapacidad: z.enum(['SI', 'NO']),
    tipo_incapacidad: z.enum(TIPO_INCAPACIDAD_CONSULTA_VALUES).optional(),
    dias_incapacidad: z.number().int().min(0).max(365).optional(),
    /** Legacy v1; se limpia al guardar v2. */
    pase_salida: z.enum(['SI', 'NO']).optional(),
    material_medico: optionalString,
    indicaciones_generales: optionalString,
    ...proximaCitaFinalFields,
    receta_lineas: z.array(RecetaLineaSchema).max(30),
    medico_nombre: freeText(200, 1),
    medico_cedula: plainString.min(1).max(50),
    antecedentes: ClinicalHistoryDataSchema.optional(),
    antecedentes_consulta: AntecedentesConsultaResumenSchema.optional(),
    modulo1: z.record(z.string(), z.string()).optional(),
    cerrada_at: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.otorga_incapacidad === 'NO') return
    const t = data.tipo_incapacidad
    if (!t || t === 'NINGUNA') {
      ctx.addIssue({
        code: 'custom',
        message: 'Seleccione el tipo de incapacidad o documentación.',
        path: ['tipo_incapacidad'],
      })
      return
    }
    if (t === 'INTERNA_SME') {
      const d = data.dias_incapacidad
      if (d === undefined || d < 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Indique los días de incapacidad interna (SME).',
          path: ['dias_incapacidad'],
        })
      }
    }
  })

const draftText = (max: number) =>
  z.string().trim().max(max).transform(applySentenceCase)

/**
 * Borrador: solo exige la versión. Los textos vacíos y las líneas de
 * medicamento a medias son válidos. El cierre sigue usando el schema estricto.
 * `.partial()` no sirve: si el campo viene como "" igual exige min().
 */
export const ConsultaMedicaDraftSchema = z.object({
  schemaVersion: acceptedSchemaVersion,
  tipo_consulta: z.enum(TIPO_CONSULTA_VALUES).optional(),
  motivo_consulta: draftText(12000).optional(),
  signos_vitales: SignosVitalesConsultaSchema.optional(),
  exploracion_fisica: draftText(12000).optional(),
  diagnostico_unificado: diagnosticoUnificadoCieDraft,
  diagnostico_especifico: draftText(2000).optional(),
  incapacidad_aplica: z.boolean().optional(),
  otorga_incapacidad: z.enum(['SI', 'NO']).optional(),
  tipo_incapacidad: z.enum(TIPO_INCAPACIDAD_CONSULTA_VALUES).optional(),
  dias_incapacidad: z.number().int().min(0).max(365).optional(),
  pase_salida: z.enum(['SI', 'NO']).optional(),
  material_medico: optionalString,
  indicaciones_generales: optionalString,
  ...proximaCitaDraftFields,
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
  antecedentes_consulta: AntecedentesConsultaResumenSchema.optional(),
  modulo1: z.record(z.string(), z.string()).optional(),
  cerrada_at: z.string().datetime().optional(),
})
