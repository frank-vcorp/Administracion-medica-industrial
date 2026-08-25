/**
 * @fileoverview Zod schema — Cuestionario auditivo de Audiometría
 *   (FEATURE-20260825-02 / SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE).
 *
 * Diseño (paralelo a `espirometria-questionnaire.schema`, con campos propios):
 *   - Payload versionado `schemaVersion: "audiometria-questionnaire-v1"`.
 *   - Preguntas predominantemente seleccionables (Sí/No, No aplica, rangos,
 *     catálogos). Texto libre sólo para `Otro` y observaciones.
 *   - Campos condicionales: cada campo `_otro` y de rango sólo se acepta
 *     cuando su pregunta padre tiene la respuesta adecuada.
 *   - Exploración física por estados Normal/Alterado/No realizado + observación
 *     opcional (faringe, CAD, CAI, MTD, MTI).
 *   - NO incluye PII ni metadatos administrativos redundantes. La identidad
 *     del paciente/Event viene de la papeleta; el médico y el usuario de
 *     sesión se derivan de la sesión y del documento fuente — NO se
 *     duplican aquí.
 *
 * DEC-20260825-08 / BR-20260825-09 (rectificación Frank) — la iteración
 * previa incluía `Patient ID del formato`, `consentimiento`,
 * `responsableCaptura` y `responsableMedico` como campos del payload.
 * Esos campos fueron RETIRADOS completamente: ni aparecen en UI ni
 * forman parte del payload/schema guardado. El cuestionario guarda SÓLO
 * antecedentes auditivos, exploración física y observaciones clínicas.
 *
 * El schema es server-side enforced: el server action rechaza payloads que
 * no cumplan con `AudiometriaQuestionnairePayloadSchema` y devuelve un error
 * visible a la UI (AC-1, AC-4).
 *
 * REGLA explícita SPEC §4.3:
 *   - PTA calculado = (TA500 + TA1000 + TA2000) / 3 por oído.
 *     `1000 Hz` es frontera: NO se duplica en promedios.
 *   - `pta_fuente` (PTA del documento) se conserva por separado, no se
 *     sustituye por el calculado. Ningún campo se inventa.
 *   - Graves = 250/500/1000 Hz. Agudas = 2000/3000/4000/6000/8000 Hz.
 *   - TA = vía aérea; VO = vía ósea (visibles en el documento cuando aplica).
 *   - Clasificación combina patrón + PTA/criterio AMI; umbrales en huecos
 *     → `NO_CONCLUYENTE_PARA_CLASIFICACION`.
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */
import { z } from 'zod'

// ──────────────────────────────────────────────────────────────────────────
// Rangos y catálogos (FEATURE-20260825-02 §4.1)
// ──────────────────────────────────────────────────────────────────────────

export const TIEMPO_RANGO_VALUES = [
  'MENOS_1_ANIO',
  '1_A_3_ANIOS',
  '3_A_5_ANIOS',
  'MAS_5_ANIOS',
] as const
export type TiempoRango = (typeof TIEMPO_RANGO_VALUES)[number]

export const TIPO_EXPOSICION_RUIDO_VALUES = [
  'INDUSTRIAL',
  'RECREATIVA',
  'MILITAR',
  'MUSICAL',
  'CONSTRUCCION',
  'OTRO',
] as const
export type TipoExposicionRuido = (typeof TIPO_EXPOSICION_RUIDO_VALUES)[number]

export const TIPO_TRAUMA_VALUES = [
  'EXPLOSION',
  'GOLPE',
  'ACCIDENTE',
  'OTRO',
] as const
export type TipoTrauma = (typeof TIPO_TRAUMA_VALUES)[number]

export const INFECCION_OTICA_VALUES = [
  'OTITIS_MEDIA',
  'OTITIS_EXTERNA',
  'SARAMPION',
  'RUBEOLA',
  'PAROTIDITIS',
  'MENINGITIS',
  'OTRO',
] as const
export type InfeccionOtica = (typeof INFECCION_OTICA_VALUES)[number]

export const MEDICAMENTO_OTOTOXICO_VALUES = [
  'AMINOGLUCOSIDOS',
  'DIURETICOS',
  'QUIMIOTERAPIA',
  'AAS_ALTAS_DOSIS',
  'OTRO',
] as const
export type MedicamentoOtoxico = (typeof MEDICAMENTO_OTOTOXICO_VALUES)[number]

// Estados de exploración física (FEATURE-20260825-02 §4.1)
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
 * Antecedentes auditivos del cuestionario de Audiometría.
 * Cada bloque Sí/No habilita su sub-campo (rango, tipo, etc.) validado por
 * `superRefine`. Texto libre sólo en `Otro` (que requiere `OTRO` en el
 * catálogo) y observaciones.
 */
const AntecedentesSchema = z
  .object({
    // Audiometría previa
    audiometria_previa: z.enum(['SI', 'NO']).optional(),
    audiometria_previa_rango: z.enum(TIEMPO_RANGO_VALUES).optional(),

    // Dificultad auditiva subjetiva
    dificultad_auditiva: z.enum(['SI', 'NO']).optional(),
    dificultad_auditiva_lado: z
      .enum(['OD', 'OI', 'BILATERAL', 'NO_APLICA'])
      .optional(),

    // Exposición a ruido laboral (Sí/No + tipo catálogo + rango duración)
    exposicion_ruido_laboral: z.enum(['SI', 'NO']).optional(),
    exposicion_tipos: z.array(z.enum(TIPO_EXPOSICION_RUIDO_VALUES)).optional(),
    exposicion_otro: optString,
    exposicion_duracion_rango: z.enum(TIEMPO_RANGO_VALUES).optional(),

    // Exposición recreativa a ruido (Sí/No + tipo catálogo + rango duración)
    exposicion_ruido_recreativa: z.enum(['SI', 'NO']).optional(),
    exposicion_recreativa_tipos: z
      .array(z.enum(TIPO_EXPOSICION_RUIDO_VALUES))
      .optional(),
    exposicion_recreativa_otro: optString,
    exposicion_recreativa_duracion_rango: z.enum(TIEMPO_RANGO_VALUES).optional(),

    // Explosión o trauma acústico (Sí/No + catálogo)
    explosion_o_trauma: z.enum(['SI', 'NO']).optional(),
    explosion_tipos: z.array(z.enum(TIPO_TRAUMA_VALUES)).optional(),
    explosion_otro: optString,

    // Infecciones óticas / meningitis (Sí/No + catálogo)
    infecciones_oticas: z.enum(['SI', 'NO']).optional(),
    infecciones_tipos: z.array(z.enum(INFECCION_OTICA_VALUES)).optional(),
    infecciones_otro: optString,

    // Tinnitus o mareos (Sí/No + lado)
    tinnitus_o_mareos: z.enum(['SI', 'NO']).optional(),
    tinnitus_lado: z.enum(['OD', 'OI', 'BILATERAL', 'NO_APLICA']).optional(),

    // Medicamentos ototóxicos (Sí/No + catálogo)
    medicamentos_otoxicos: z.enum(['SI', 'NO']).optional(),
    medicamentos_tipos: z.array(z.enum(MEDICAMENTO_OTOTOXICO_VALUES)).optional(),
    medicamentos_otro: optString,

    // Observaciones opcionales (texto libre controlado)
    observaciones: optString,
  })
  .superRefine((val, ctx) => {
    // Audiometría previa → rango requerido si Sí
    if (val.audiometria_previa === 'SI' && !val.audiometria_previa_rango) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audiometria_previa_rango'],
        message:
          'Indique el rango de tiempo de la audiometría previa cuando la respuesta es Sí.',
      })
    }
    // Dificultad auditiva → lado requerido si Sí
    if (val.dificultad_auditiva === 'SI' && !val.dificultad_auditiva_lado) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dificultad_auditiva_lado'],
        message:
          'Indique el oído afectado cuando la respuesta es Sí.',
      })
    }
    // Exposición laboral → tipos o `otro` requerido si Sí
    if (val.exposicion_ruido_laboral === 'SI') {
      const tieneTipo =
        (val.exposicion_tipos && val.exposicion_tipos.length > 0) ||
        (val.exposicion_otro && val.exposicion_otro.length > 0)
      if (!tieneTipo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exposicion_tipos'],
          message:
            'Indique al menos un tipo de exposición laboral (catálogo u Otro) cuando la respuesta es Sí.',
        })
      }
      if (!val.exposicion_duracion_rango) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exposicion_duracion_rango'],
          message: 'Indique la duración de la exposición laboral.',
        })
      }
    }
    // Exposición recreativa → tipos o `otro` requerido si Sí
    if (val.exposicion_ruido_recreativa === 'SI') {
      const tieneTipo =
        (val.exposicion_recreativa_tipos &&
          val.exposicion_recreativa_tipos.length > 0) ||
        (val.exposicion_recreativa_otro &&
          val.exposicion_recreativa_otro.length > 0)
      if (!tieneTipo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exposicion_recreativa_tipos'],
          message:
            'Indique al menos un tipo de exposición recreativa (catálogo u Otro) cuando la respuesta es Sí.',
        })
      }
      if (!val.exposicion_recreativa_duracion_rango) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exposicion_recreativa_duracion_rango'],
          message: 'Indique la duración de la exposición recreativa.',
        })
      }
    }
    // Explosión / trauma → tipo catálogo u Otro requerido si Sí
    if (val.explosion_o_trauma === 'SI') {
      const tieneTipo =
        (val.explosion_tipos && val.explosion_tipos.length > 0) ||
        (val.explosion_otro && val.explosion_otro.length > 0)
      if (!tieneTipo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['explosion_tipos'],
          message:
            'Indique al menos un tipo de evento (catálogo u Otro) cuando la respuesta es Sí.',
        })
      }
    }
    // Infecciones óticas → tipo catálogo u Otro requerido si Sí
    if (val.infecciones_oticas === 'SI') {
      const tieneTipo =
        (val.infecciones_tipos && val.infecciones_tipos.length > 0) ||
        (val.infecciones_otro && val.infecciones_otro.length > 0)
      if (!tieneTipo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['infecciones_tipos'],
          message:
            'Indique al menos una infección (catálogo u Otro) cuando la respuesta es Sí.',
        })
      }
    }
    // Tinnitus/mareos → lado requerido si Sí
    if (val.tinnitus_o_mareos === 'SI' && !val.tinnitus_lado) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tinnitus_lado'],
        message:
          'Indique el oído afectado cuando tinnitus/mareos es Sí.',
      })
    }
    // Medicamentos ototóxicos → tipo catálogo u Otro requerido si Sí
    if (val.medicamentos_otoxicos === 'SI') {
      const tieneTipo =
        (val.medicamentos_tipos && val.medicamentos_tipos.length > 0) ||
        (val.medicamentos_otro && val.medicamentos_otro.length > 0)
      if (!tieneTipo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['medicamentos_tipos'],
          message:
            'Indique al menos un medicamento (catálogo u Otro) cuando la respuesta es Sí.',
        })
      }
    }
    // `Otro` texto libre: sólo válido si se eligió el catálogo `OTRO`
    if (
      val.exposicion_ruido_laboral === 'SI' &&
      val.exposicion_otro &&
      val.exposicion_otro.length > 0 &&
      !(val.exposicion_tipos ?? []).includes('OTRO')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exposicion_otro'],
        message:
          'Para escribir Otro debe seleccionar la opción OTRO en el catálogo.',
      })
    }
    if (
      val.exposicion_ruido_recreativa === 'SI' &&
      val.exposicion_recreativa_otro &&
      val.exposicion_recreativa_otro.length > 0 &&
      !(val.exposicion_recreativa_tipos ?? []).includes('OTRO')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exposicion_recreativa_otro'],
        message:
          'Para escribir Otro debe seleccionar la opción OTRO en el catálogo.',
      })
    }
    if (
      val.explosion_o_trauma === 'SI' &&
      val.explosion_otro &&
      val.explosion_otro.length > 0 &&
      !(val.explosion_tipos ?? []).includes('OTRO')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['explosion_otro'],
        message:
          'Para escribir Otro debe seleccionar la opción OTRO en el catálogo.',
      })
    }
    if (
      val.infecciones_oticas === 'SI' &&
      val.infecciones_otro &&
      val.infecciones_otro.length > 0 &&
      !(val.infecciones_tipos ?? []).includes('OTRO')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['infecciones_otro'],
        message:
          'Para escribir Otro debe seleccionar la opción OTRO en el catálogo.',
      })
    }
    if (
      val.medicamentos_otoxicos === 'SI' &&
      val.medicamentos_otro &&
      val.medicamentos_otro.length > 0 &&
      !(val.medicamentos_tipos ?? []).includes('OTRO')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['medicamentos_otro'],
        message:
          'Para escribir Otro debe seleccionar la opción OTRO en el catálogo.',
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
 * Exploración física: faringe, conducto auditivo derecho (CAD), izquierdo
 * (CAI), membrana timpánica derecha (MTD), membrana timpánica izquierda
 * (MTI). Cada campo usa `ExploracionFieldSchema`.
 */
const ExploracionFisicaSchema = z.object({
  faringe: ExploracionFieldSchema,
  cad: ExploracionFieldSchema,
  cai: ExploracionFieldSchema,
  mtd: ExploracionFieldSchema,
  mti: ExploracionFieldSchema,
})

/**
 * Payload completo del cuestionario. El server action rechaza payloads sin
 * `schemaVersion` igual a `AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION` para
 * permitir evolución futura sin romper contratos.
 *
 * DEC-20260825-08 / BR-20260825-09 — el payload guarda SÓLO:
 *   - `antecedentes` (antecedentes auditivos del paciente).
 *   - `exploracionFisica` (faringe / CAD / CAI / MTD / MTI).
 *   - `observaciones` (texto libre controlado, opcional).
 *
 * Quedan EXCLUIDOS por diseño y por rectificación (`DEC-20260825-08`):
 *   - `Patient ID del formato` — la trazabilidad del paciente/Event la
 *     aporta la papeleta, no el cuestionario.
 *   - `consentimiento` — el consentimiento informado tiene su propio
 *     punto de captura y no es un dato del cuestionario clínico.
 *   - `responsableCaptura` / `responsableMedico` — la identidad del
 *     médico y del usuario de captura se derivan de la sesión, no del
 *     payload. El documento fuente audiométrico ya tiene su propia
 *     cadena de responsabilidad.
 *
 * NO duplica PII del encabezado de la papeleta. La identidad clínica
 * efectiva del médico firmante se congela en `DoctorStudyReview`
 * (firma/cédula) en el momento de la revisión médica.
 */
export const AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION =
  'audiometria-questionnaire-v1' as const

export const AudiometriaQuestionnairePayloadSchema = z.object({
  schemaVersion: z.literal(AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION),
  capturedAt: z.string().datetime({
    message: 'capturedAt debe ser un ISO 8601 válido.',
  }),
  antecedentes: AntecedentesSchema,
  exploracionFisica: ExploracionFisicaSchema,
  observaciones: optString,
})

export type AudiometriaQuestionnairePayload = z.infer<
  typeof AudiometriaQuestionnairePayloadSchema
>

export type AntecedentesAudiometria = z.infer<typeof AntecedentesSchema>
export type ExploracionFisicaAudiometria = z.infer<typeof ExploracionFisicaSchema>
export type ExploracionFieldValue = z.infer<typeof ExploracionFieldSchema>