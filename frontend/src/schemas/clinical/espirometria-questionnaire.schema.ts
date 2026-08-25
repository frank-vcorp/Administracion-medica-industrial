/**
 * @fileoverview Zod schema — Cuestionario emergente de Espirometría
 *   (FEATURE-20260824-02 / SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA).
 *
 * Diseño:
 *   - Payload versionado `schemaVersion: "espirometria-questionnaire-v1"`.
 *   - Preguntas predominantemente seleccionables (Sí/No, No aplica, rangos,
 *     catálogos). Texto libre sólo para `Otro` y observaciones.
 *   - Campos condicionales: cada campo `_otro` y de duración sólo se acepta
 *     cuando su pregunta padre tiene la respuesta adecuada.
 *   - Exploración física por estados Normal/Alterado/No realizado + observación
 *     opcional.
 *   - No incluye PII del encabezado (la papeleta ya lo aporta). Aquí sólo
 *     antecedentes clínicos y exploración física del estudio.
 *
 * El schema es server-side enforced: el server action rechaza payloads que
 * no cumplan con `EspirometriaQuestionnairePayloadSchema` y devuelve un error
 * visible a la UI (AC-4).
 *
 * @id IMPL-FEATURE-20260824-02
 * @backup context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md
 */
import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────────────
// Rangos y catálogos (FEATURE-20260824-02 §Antecedentes)
// ──────────────────────────────────────────────────────────────────────────

export const TIEMPO_RANGO_VALUES = [
  'MENOS_1_ANIO',
  '1_A_3_ANIOS',
  '3_A_5_ANIOS',
  'MAS_5_ANIOS',
] as const
export type TiempoRango = (typeof TIEMPO_RANGO_VALUES)[number]

export const CIGARRILLOS_RANGO_VALUES = [
  'MENOS_5',
  '5_A_10',
  '11_A_20',
  'MAS_20',
] as const
export type CigarrillosRango = (typeof CIGARRILLOS_RANGO_VALUES)[number]

export const EXPOSICION_TIPO_VALUES = [
  'HUMOS',
  'VAPORES',
  'GASES',
  'SUSTANCIAS_QUIMICAS',
  'POLVOS',
  'SOLVENTES',
] as const
export type ExposicionTipo = (typeof EXPOSICION_TIPO_VALUES)[number]

export const ANTECEDENTE_MEDICO_TIPO_VALUES = [
  'EPILEPSIA',
  'CARDIACA',
  'PULMONAR',
] as const
export type AntecedenteMedicoTipo = (typeof ANTECEDENTE_MEDICO_TIPO_VALUES)[number]

export const INHALADOR_TIPO_VALUES = [
  'BRONCODILATADOR',
  'CORTICOIDE_INHALADO',
  'OTRO',
] as const
export type InhaladorTipo = (typeof INHALADOR_TIPO_VALUES)[number]

export const CIRUGIA_TIPO_VALUES = [
  'TORAXICA',
  'ABDOMINAL',
  'OTORRINOLARINGOLOGIA',
  'CARDIACA',
  'OTRO',
] as const
export type CirugiaTipo = (typeof CIRUGIA_TIPO_VALUES)[number]

// Estados de exploración física (FEATURE-20260824-02 §Exploración física)
export const EXPLORACION_ESTADO_VALUES = [
  'NORMAL',
  'ALTERADO',
  'NO_REALIZADO',
] as const
export type ExploracionEstado = (typeof EXPLORACION_ESTADO_VALUES)[number]

// ──────────────────────────────────────────────────────────────────────────
// Sub-schemas (DRY: reutilizables + testeables)
// ──────────────────────────────────────────────────────────────────────────

const optString = z
  .string()
  .trim()
  .max(500, 'Máximo 500 caracteres')
  .optional()

/**
 * Antecedentes respiratorios del XLS AMI.
 * `fumaba_cigarrillos_rango` / `dejo_de_fumar_rango` sólo aplican cuando la
 * pregunta padre lo habilita (validado por `superRefine`).
 */
const AntecedentesSchema = z
  .object({
    // Espirometría previa (Sí/No + rango)
    espirometria_previa: z.enum(['SI', 'NO']).optional(),
    espirometria_previa_rango: z.enum(TIEMPO_RANGO_VALUES).optional(),

    // Dificultad para respirar (Sí/No)
    dificultad_respirar: z.enum(['SI', 'NO']).optional(),

    // Exposición ocupacional (Sí/No + tipo catálogo + rango duración)
    exposicion_ocupacional: z.enum(['SI', 'NO']).optional(),
    exposicion_tipos: z.array(z.enum(EXPOSICION_TIPO_VALUES)).optional(),
    exposicion_otro: optString,
    exposicion_duracion_rango: z.enum(TIEMPO_RANGO_VALUES).optional(),

    // Tabaquismo (Sí/No + cigarrillos + desde + dejó de fumar)
    fuma_o_fumo: z.enum(['SI', 'NO']).optional(),
    cigarrillos_por_dia_rango: z.enum(CIGARRILLOS_RANGO_VALUES).optional(),
    fuma_desde_rango: z.enum(TIEMPO_RANGO_VALUES).optional(),
    dejo_de_fumar_rango: z.enum(TIEMPO_RANGO_VALUES).optional(),

    // Epilepsia o enfermedad cardiaca/pulmonar (Sí/No + catálogo)
    antecedente_cardiopulmonar_o_epilepsia: z.enum(['SI', 'NO']).optional(),
    antecedente_medico_tipos: z
      .array(z.enum(ANTECEDENTE_MEDICO_TIPO_VALUES))
      .optional(),
    antecedente_medico_otro: optString,

    // Embarazo (No aplica / Sí / No)
    embarazo: z.enum(['NO_APLICA', 'NO', 'SI']).optional(),

    // Medicamento inhalador/bronco­dilatador (Sí/No + catálogo)
    usa_inhalador: z.enum(['SI', 'NO']).optional(),
    inhalador_tipos: z.array(z.enum(INHALADOR_TIPO_VALUES)).optional(),
    inhalador_otro: optString,

    // Procedimiento quirúrgico en últimos tres meses (Sí/No + catálogo)
    cirugia_reciente: z.enum(['SI', 'NO']).optional(),
    cirugia_tipos: z.array(z.enum(CIRUGIA_TIPO_VALUES)).optional(),
    cirugia_otro: optString,

    // Observaciones opcionales (texto libre controlado)
    observaciones: optString,
  })
  .superRefine((val, ctx) => {
    // Espirometría previa → rango requerido si Sí
    if (val.espirometria_previa === 'SI' && !val.espirometria_previa_rango) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['espirometria_previa_rango'],
        message:
          'Indique el rango de tiempo de la espirometría previa cuando la respuesta es Sí.',
      })
    }
    // Exposición ocupacional → tipos o `otro` requerido si Sí
    if (val.exposicion_ocupacional === 'SI') {
      const tieneTipo =
        (val.exposicion_tipos && val.exposicion_tipos.length > 0) ||
        (val.exposicion_otro && val.exposicion_otro.length > 0)
      if (!tieneTipo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exposicion_tipos'],
          message:
            'Indique al menos un tipo de exposición (catálogo u Otro) cuando la respuesta es Sí.',
        })
      }
      if (!val.exposicion_duracion_rango) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exposicion_duracion_rango'],
          message: 'Indique la duración de la exposición.',
        })
      }
    }
    // Tabaquismo → cigarrillos + desde cuando Sí
    if (val.fuma_o_fumo === 'SI') {
      if (!val.cigarrillos_por_dia_rango) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cigarrillos_por_dia_rango'],
          message: 'Indique el rango de cigarrillos por día.',
        })
      }
      if (!val.fuma_desde_rango) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fuma_desde_rango'],
          message: 'Indique desde cuándo fuma.',
        })
      }
    }
    // Antecedente médico → tipo catálogo u Otro requerido si Sí
    if (val.antecedente_cardiopulmonar_o_epilepsia === 'SI') {
      const tieneTipo =
        (val.antecedente_medico_tipos && val.antecedente_medico_tipos.length > 0) ||
        (val.antecedente_medico_otro && val.antecedente_medico_otro.length > 0)
      if (!tieneTipo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['antecedente_medico_tipos'],
          message:
            'Indique al menos un antecedente (catálogo u Otro) cuando la respuesta es Sí.',
        })
      }
    }
    // Inhalador → tipo catálogo u Otro requerido si Sí
    if (val.usa_inhalador === 'SI') {
      const tieneTipo =
        (val.inhalador_tipos && val.inhalador_tipos.length > 0) ||
        (val.inhalador_otro && val.inhalador_otro.length > 0)
      if (!tieneTipo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['inhalador_tipos'],
          message:
            'Indique al menos un inhalador (catálogo u Otro) cuando la respuesta es Sí.',
        })
      }
    }
    // Cirugía → tipo catálogo u Otro requerido si Sí
    if (val.cirugia_reciente === 'SI') {
      const tieneTipo =
        (val.cirugia_tipos && val.cirugia_tipos.length > 0) ||
        (val.cirugia_otro && val.cirugia_otro.length > 0)
      if (!tieneTipo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cirugia_tipos'],
          message:
            'Indique al menos un tipo de cirugía (catálogo u Otro) cuando la respuesta es Sí.',
        })
      }
    }
    // `Otro` texto libre: sólo válido si se eligió el catálogo `OTRO`
    if (
      val.usa_inhalador === 'SI' &&
      val.inhalador_otro &&
      val.inhalador_otro.length > 0 &&
      !(val.inhalador_tipos ?? []).includes('OTRO')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inhalador_otro'],
        message: 'Para escribir Otro debe seleccionar la opción OTRO en el catálogo.',
      })
    }
    if (
      val.cirugia_reciente === 'SI' &&
      val.cirugia_otro &&
      val.cirugia_otro.length > 0 &&
      !(val.cirugia_tipos ?? []).includes('OTRO')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cirugia_otro'],
        message: 'Para escribir Otro debe seleccionar la opción OTRO en el catálogo.',
      })
    }
    if (
      val.antecedente_cardiopulmonar_o_epilepsia === 'SI' &&
      val.antecedente_medico_otro &&
      val.antecedente_medico_otro.length > 0
    ) {
      // Sin catálogo `OTRO` para antecedentes médicos (los 3 valores son
      // canónicos: epilepsia, cardiaca, pulmonar); rechazar libre.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['antecedente_medico_otro'],
        message:
          'Para antecedentes médicos use el catálogo; el campo Otro no aplica.',
      })
    }
  })

/**
 * Sub-schema para un campo de exploración física.
 * Estado seleccionable + observación opcional (sólo si el estado lo justifica).
 */
const ExploracionFieldSchema = z
  .object({
    estado: z.enum(EXPLORACION_ESTADO_VALUES),
    observacion: optString,
  })
  .superRefine((val, ctx) => {
    if (
      val.estado !== 'ALTERADO' &&
      val.observacion &&
      val.observacion.trim().length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['observacion'],
        message:
          'La observación sólo aplica cuando el estado es Alterado.',
      })
    }
  })

/**
 * Exploración física: vías respiratorias superiores, tórax, pulmones.
 * Cada campo usa `ExploracionFieldSchema` (Normal/Alterado/No realizado).
 */
const ExploracionFisicaSchema = z.object({
  vias_respiratorias_superiores: ExploracionFieldSchema,
  torax: ExploracionFieldSchema,
  pulmones: ExploracionFieldSchema,
})

/**
 * Payload completo del cuestionario. El server action rechaza payloads sin
 * `schemaVersion` igual a `ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION` para
 * permitir evolución futura sin romper contratos.
 */
export const ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION =
  'espirometria-questionnaire-v1' as const

export const EspirometriaQuestionnairePayloadSchema = z.object({
  schemaVersion: z.literal(ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION),
  capturedAt: z.string().datetime({
    message: 'capturedAt debe ser un ISO 8601 válido.',
  }),
  antecedentes: AntecedentesSchema,
  exploracionFisica: ExploracionFisicaSchema,
  observaciones: optString,
})

export type EspirometriaQuestionnairePayload = z.infer<
  typeof EspirometriaQuestionnairePayloadSchema
>

export type AntecedentesEspirometria = z.infer<typeof AntecedentesSchema>
export type ExploracionFisicaEspirometria = z.infer<typeof ExploracionFisicaSchema>
export type ExploracionFieldValue = z.infer<typeof ExploracionFieldSchema>
