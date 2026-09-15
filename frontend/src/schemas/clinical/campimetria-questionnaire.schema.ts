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
    for (const plate of ISHIHARA_PLATES) {
      if (!val.ojo_derecho[plate.id]?.trim() || !val.ojo_izquierdo[plate.id]?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Completa el número referido en cada placa o marca No aplica.',
          path: ['ojo_derecho', plate.id],
        })
      }
    }
    const derived = deriveIshiharaResultado(val)
    if (derived !== 'INCOMPLETO' && derived !== val.resultado) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `El resultado (${val.resultado}) no coincide con los números capturados (${derived}).`,
        path: ['resultado'],
      })
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
  /** Legacy: la aptitud la define el médico en la revisión IA, no en captura. */
  aptitud: z.enum(APTITUD_OFTALMO_VALUES).optional(),
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

export function emptyIshiharaPlates(): Record<IshiharaPlateId, string> {
  return Object.fromEntries(
    ISHIHARA_PLATES.map(plate => [plate.id, '']),
  ) as Record<IshiharaPlateId, string>
}

/** Normaliza respuesta de placa (ej. "03" → "3") para comparar con lo esperado. */
export function normalizeIshiharaAnswer(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return trimmed.replace(/^0+(?=\d)/, '')
}

export function deriveIshiharaResultado(input: {
  resultado: IshiharaResultado
  ojo_derecho: Record<IshiharaPlateId, string>
  ojo_izquierdo: Record<IshiharaPlateId, string>
}): IshiharaResultado | 'INCOMPLETO' {
  if (input.resultado === 'NO APLICA') return 'NO APLICA'

  const expected = expectedIshiharaAnswers()
  for (const plate of ISHIHARA_PLATES) {
    const od = normalizeIshiharaAnswer(input.ojo_derecho[plate.id] ?? '')
    const oi = normalizeIshiharaAnswer(input.ojo_izquierdo[plate.id] ?? '')
    if (!od || !oi) return 'INCOMPLETO'
    const exp = expected[plate.id]
    if (od !== exp || oi !== exp) return 'ALTERADO'
  }
  return 'NORMAL'
}

export function applyIshiharaDerivation<
  T extends {
    resultado: IshiharaResultado
    ojo_derecho: Record<IshiharaPlateId, string>
    ojo_izquierdo: Record<IshiharaPlateId, string>
  },
>(ishihara: T): T {
  if (ishihara.resultado === 'NO APLICA') return ishihara
  const derived = deriveIshiharaResultado(ishihara)
  if (derived === 'INCOMPLETO') return ishihara
  return { ...ishihara, resultado: derived }
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

/** Borrador vacío para abrir captura nueva (Ishihara pendiente hasta llenar placas). */
export function defaultCampimetriaDraftPayload(): CampimetriaQuestionnairePayload {
  const emptyPlates = emptyIshiharaPlates()
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
      resultado: 'ALTERADO',
      ojo_derecho: { ...emptyPlates },
      ojo_izquierdo: { ...emptyPlates },
    },
  }
}

/** Payload completo “todo normal” (tests y atajo de relleno). */
export function defaultCampimetriaQuestionnairePayload(): CampimetriaQuestionnairePayload {
  const plates = expectedIshiharaAnswers()
  return {
    ...defaultCampimetriaDraftPayload(),
    ishihara: applyIshiharaDerivation({
      resultado: 'NORMAL',
      ojo_derecho: { ...plates },
      ojo_izquierdo: { ...plates },
    }),
  }
}
