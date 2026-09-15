/**
 * @fileoverview Zod schema — Captura de Campimetría (formato 005-2018).
 *   SPEC-FEATURE-20260914-01.
 *
 * Solo captura lo propio de la prueba. PII, agudeza Snellen, diabetes/HTA
 * y cirugías generales se heredan de la papeleta y NO van en este payload.
 *
 * @id IMPL-FEATURE-20260914-01
 * @backup context/SPECs/SPEC-FEATURE-20260914-01-CAMPIMETRIA-CUESTIONARIO.md
 */
import { z } from 'zod'

export const CAMPIMETRIA_QUESTIONNAIRE_SCHEMA_VERSION =
  'campimetria-questionnaire-v1' as const

export const SI_NO_VALUES = ['SI', 'NO'] as const
export type CampimetriaSiNo = (typeof SI_NO_VALUES)[number]

export const TIEMPO_LENTES_VALUES = [
  'MENOS_1_ANIO',
  '1_A_3_ANIOS',
  '3_A_5_ANIOS',
  'MAS_5_ANIOS',
] as const
export type TiempoLentes = (typeof TIEMPO_LENTES_VALUES)[number]

export const EXPLORACION_ESTADO_VALUES = [
  'NORMAL',
  'ALTERADO',
  'NO_REALIZADO',
] as const
export type ExploracionEstadoCampimetria =
  (typeof EXPLORACION_ESTADO_VALUES)[number]

export const CONFRONTACION_VALUES = [
  'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES',
  'ALTERADOS',
  'NO APLICA',
] as const
export type ConfrontacionValue = (typeof CONFRONTACION_VALUES)[number]

export const ISHIHARA_RESULTADO_VALUES = [
  'NORMAL',
  'ALTERADO',
  'NO APLICA',
] as const
export type IshiharaResultado = (typeof ISHIHARA_RESULTADO_VALUES)[number]

export const APTITUD_OFTALMO_VALUES = [
  'OFTALMOLOGICAMENTE APTA PARA LABORAR',
  'APTA CON RESTRICCIONES',
  'NO APTA',
] as const
export type AptitudOftalmo = (typeof APTITUD_OFTALMO_VALUES)[number]

/** Placas del Excel CAMPI (fila de números por ojo). */
export type IshiharaPlateId = 'p12' | 'p45' | 'p03' | 'p05' | 'p02' | 'p26' | 'p74'

export const ISHIHARA_PLATES: ReadonlyArray<{
  id: IshiharaPlateId
  expected: string
  src: string
  displayExpected?: string
}> = [
  { id: 'p12', expected: '12', src: '/clinical/campimetria/ishihara-12.png' },
  { id: 'p45', expected: '45', src: '/clinical/campimetria/ishihara-45.png' },
  { id: 'p03', expected: '03', src: '/clinical/campimetria/ishihara-03.png', displayExpected: '3' },
  { id: 'p05', expected: '05', src: '/clinical/campimetria/ishihara-05.png', displayExpected: '5' },
  { id: 'p02', expected: '02', src: '/clinical/campimetria/ishihara-02.png', displayExpected: '2' },
  { id: 'p26', expected: '26', src: '/clinical/campimetria/ishihara-26.png' },
  { id: 'p74', expected: '74', src: '/clinical/campimetria/ishihara-74.png' },
]

export const EXPLORACION_OJO_FIELDS = [
  'movimientos',
  'reflejos',
  'pupilas',
  'conjuntiva',
  'esclera',
  'fondo_de_ojo',
  'anexos',
] as const
export type ExploracionOjoField = (typeof EXPLORACION_OJO_FIELDS)[number]

export const EXPLORACION_OJO_LABEL: Record<ExploracionOjoField, string> = {
  movimientos: 'Movimientos oculares',
  reflejos: 'Reflejos pupilares',
  pupilas: 'Pupilas',
  conjuntiva: 'Conjuntiva',
  esclera: 'Esclera',
  fondo_de_ojo: 'Fondo de ojo',
  anexos: 'Anexos y glándulas',
}

/** Plantillas Normal del Excel CAMPI (mismo texto OD/OI). */
export const EXPLORACION_OJO_PLANTILLA: Record<ExploracionOjoField, string> = {
  movimientos: 'PRESENTES, NORMALES',
  reflejos:
    'CONSENSUAL, DE CONVERGENCIA Y ACOMODACIÓN PRESENTES, CONSERVADOS Y SIN DATOS PATOLOGICOS.',
  pupilas: 'ISOCORICAS Y NORMOREFLEXICAS',
  conjuntiva: 'SIN DATOS PATOLOGICOS',
  esclera: 'SIN ALTERACIONES.',
  fondo_de_ojo:
    'RETINA, COROIDES, FOVEA, MACULA, PAPILA OPTICA Y VASOS RETINIANOS NORMALES, SIN DATOS PATOLOGICOS',
  anexos: 'SIN ALTERACIONES.',
}

const optString = z.string().trim().max(500).optional()

const ExploracionCampoSchema = z
  .object({
    estado: z.enum(EXPLORACION_ESTADO_VALUES),
    observacion: optString,
  })
  .superRefine((val, ctx) => {
    if (val.estado === 'ALTERADO' && !val.observacion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indica el hallazgo si está alterado.',
        path: ['observacion'],
      })
    }
    if (val.estado !== 'ALTERADO' && val.observacion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La observación sólo aplica si está alterado.',
        path: ['observacion'],
      })
    }
  })

const ExploracionOjoSchema = z.object({
  movimientos: ExploracionCampoSchema,
  reflejos: ExploracionCampoSchema,
  pupilas: ExploracionCampoSchema,
  conjuntiva: ExploracionCampoSchema,
  esclera: ExploracionCampoSchema,
  fondo_de_ojo: ExploracionCampoSchema,
  anexos: ExploracionCampoSchema,
})

const AntecedentesCampimetriaSchema = z
  .object({
    uso_lentes: z.enum(SI_NO_VALUES),
    tiempo_lentes: z.enum(TIEMPO_LENTES_VALUES).optional(),
    cirugias_oculares: z.enum(SI_NO_VALUES),
    causa_cirugia: optString,
  })
  .superRefine((val, ctx) => {
    if (val.uso_lentes === 'SI' && !val.tiempo_lentes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indica desde cuándo usa lentes.',
        path: ['tiempo_lentes'],
      })
    }
    if (val.uso_lentes === 'NO' && val.tiempo_lentes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El tiempo de lentes sólo aplica si usa lentes.',
        path: ['tiempo_lentes'],
      })
    }
    if (val.cirugias_oculares === 'SI' && !val.causa_cirugia) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indica la causa de la cirugía.',
        path: ['causa_cirugia'],
      })
    }
    if (val.cirugias_oculares === 'NO' && val.causa_cirugia) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La causa sólo aplica si hubo cirugía ocular.',
        path: ['causa_cirugia'],
      })
    }
  })

const plateAnswer = z.string().trim().max(8)

const IshiharaOjoSchema = z.object({
  p12: plateAnswer,
  p45: plateAnswer,
  p03: plateAnswer,
  p05: plateAnswer,
  p02: plateAnswer,
  p26: plateAnswer,
  p74: plateAnswer,
})

const IshiharaSchema = z
  .object({
    resultado: z.enum(ISHIHARA_RESULTADO_VALUES),
    ojo_derecho: IshiharaOjoSchema,
    ojo_izquierdo: IshiharaOjoSchema,
  })
  .superRefine((val, ctx) => {
    if (val.resultado === 'NO APLICA') return
    const expected: Record<IshiharaPlateId, string> = {
      p12: '12',
      p45: '45',
      p03: '3',
      p05: '5',
      p02: '2',
      p26: '26',
      p74: '74',
    }
    for (const plate of ISHIHARA_PLATES) {
      const exp = expected[plate.id]
      if (!val.ojo_derecho[plate.id] || !val.ojo_izquierdo[plate.id]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Completa el número referido en cada placa.',
          path: ['ojo_derecho', plate.id],
        })
      }
      if (val.resultado === 'NORMAL') {
        if (val.ojo_derecho[plate.id] !== exp || val.ojo_izquierdo[plate.id] !== exp) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Normal requiere ${exp} en ambos ojos.`,
            path: ['ojo_derecho', plate.id],
          })
        }
      }
    }
  })

export const CampimetriaQuestionnairePayloadSchema = z.object({
  schemaVersion: z.literal(CAMPIMETRIA_QUESTIONNAIRE_SCHEMA_VERSION),
  capturedAt: z.string().datetime({
    message: 'capturedAt debe ser un ISO 8601 válido.',
  }),
  antecedentes: AntecedentesCampimetriaSchema,
  exploracion: z.object({
    ojo_izquierdo: ExploracionOjoSchema,
    ojo_derecho: ExploracionOjoSchema,
  }),
  confrontacion: z.object({
    ojo_izquierdo: z.enum(CONFRONTACION_VALUES),
    ojo_derecho: z.enum(CONFRONTACION_VALUES),
  }),
  ishihara: IshiharaSchema,
  aptitud: z.enum(APTITUD_OFTALMO_VALUES),
  observaciones: optString,
})

export type CampimetriaQuestionnairePayload = z.infer<
  typeof CampimetriaQuestionnairePayloadSchema
>
export type AntecedentesCampimetria = z.infer<typeof AntecedentesCampimetriaSchema>
export type ExploracionOjoCampimetria = z.infer<typeof ExploracionOjoSchema>
export type IshiharaCampimetria = z.infer<typeof IshiharaSchema>

export function expectedIshiharaAnswers(): Record<IshiharaPlateId, string> {
  return {
    p12: '12',
    p45: '45',
    p03: '3',
    p05: '5',
    p02: '2',
    p26: '26',
    p74: '74',
  }
}

export function defaultExploracionCampo(): {
  estado: 'NORMAL'
  observacion?: undefined
} {
  return { estado: 'NORMAL' }
}

export function defaultExploracionOjo(): ExploracionOjoCampimetria {
  return {
    movimientos: defaultExploracionCampo(),
    reflejos: defaultExploracionCampo(),
    pupilas: defaultExploracionCampo(),
    conjuntiva: defaultExploracionCampo(),
    esclera: defaultExploracionCampo(),
    fondo_de_ojo: defaultExploracionCampo(),
    anexos: defaultExploracionCampo(),
  }
}

export function defaultCampimetriaQuestionnairePayload(): CampimetriaQuestionnairePayload {
  const plates = expectedIshiharaAnswers()
  return {
    schemaVersion: CAMPIMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
    capturedAt: new Date().toISOString(),
    antecedentes: {
      uso_lentes: 'NO',
      cirugias_oculares: 'NO',
    },
    exploracion: {
      ojo_izquierdo: defaultExploracionOjo(),
      ojo_derecho: defaultExploracionOjo(),
    },
    confrontacion: {
      ojo_izquierdo: 'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES',
      ojo_derecho: 'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES',
    },
    ishihara: {
      resultado: 'NORMAL',
      ojo_derecho: { ...plates },
      ojo_izquierdo: { ...plates },
    },
    aptitud: 'OFTALMOLOGICAMENTE APTA PARA LABORAR',
  }
}
