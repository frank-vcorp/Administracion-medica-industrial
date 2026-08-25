/**
 * @file Tests focales (V1) para el Zod schema del cuestionario de
 *   Espirometría (FEATURE-20260824-02).
 *
 * Cobertura:
 *   - Payload mínimo válido (todos en `undefined` excepto schemaVersion,
 *     capturedAt y exploración física) → PASS.
 *   - Payload completo con catálogos y rangos → PASS.
 *   - schemaVersion distinto a `espirometria-questionnaire-v1` → FAIL.
 *   - CapturedAt no-ISO → FAIL.
 *   - Respuesta Sí sin sub-campo condicional requerido → FAIL.
 *   - Texto libre "Otro" sin catálogo OTRO → FAIL.
 *   - Antecedentes médicos con campo Otro → FAIL (no aplica para catálogos canónicos).
 *   - Observación en exploración con estado Normal/No realizado → FAIL.
 *
 * @id IMPL-FEATURE-20260824-02
 * @backup context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md
 */

import { describe, it, expect } from 'vitest'
import {
  EspirometriaQuestionnairePayloadSchema,
  ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  type EspirometriaQuestionnairePayload,
} from '../espirometria-questionnaire.schema'

const VALID_EXPLORACION = {
  vias_respiratorias_superiores: { estado: 'NORMAL' as const },
  torax: { estado: 'NORMAL' as const },
  pulmones: { estado: 'NORMAL' as const },
}

const MIN_VALID: EspirometriaQuestionnairePayload = {
  schemaVersion: ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  capturedAt: '2026-08-24T12:00:00.000Z',
  antecedentes: {},
  exploracionFisica: VALID_EXPLORACION,
}

describe('EspirometriaQuestionnairePayloadSchema — payload mínimo', () => {
  it('acepta un payload mínimo válido (sin antecedentes)', () => {
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(MIN_VALID)
    expect(parsed.success).toBe(true)
  })
})

describe('EspirometriaQuestionnairePayloadSchema — payload completo', () => {
  it('acepta payload completo con catálogos y rangos', () => {
    const payload: EspirometriaQuestionnairePayload = {
      schemaVersion: ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
      capturedAt: '2026-08-24T12:00:00.000Z',
      antecedentes: {
        espirometria_previa: 'SI',
        espirometria_previa_rango: 'MAS_5_ANIOS',
        dificultad_respirar: 'NO',
        exposicion_ocupacional: 'SI',
        exposicion_tipos: ['POLVOS', 'GASES'],
        exposicion_otro: 'humo de soldadura',
        exposicion_duracion_rango: '1_A_3_ANIOS',
        fuma_o_fumo: 'SI',
        cigarrillos_por_dia_rango: '5_A_10',
        fuma_desde_rango: 'MAS_5_ANIOS',
        dejo_de_fumar_rango: 'MENOS_1_ANIO',
        antecedente_cardiopulmonar_o_epilepsia: 'NO',
        embarazo: 'NO_APLICA',
        usa_inhalador: 'SI',
        inhalador_tipos: ['BRONCODILATADOR', 'OTRO'],
        inhalador_otro: 'salbutamol + beclometasona',
        cirugia_reciente: 'SI',
        cirugia_tipos: ['OTORRINOLARINGOLOGIA'],
        cirugia_otro: undefined,
        observaciones: 'sin complicaciones previas',
      },
      exploracionFisica: {
        vias_respiratorias_superiores: {
          estado: 'ALTERADO',
          observacion: 'desviación septal leve',
        },
        torax: { estado: 'NORMAL' },
        pulmones: { estado: 'NO_REALIZADO' },
      },
      observaciones: 'control anual',
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(true)
  })
})

describe('EspirometriaQuestionnairePayloadSchema — rechazos', () => {
  it('rechaza schemaVersion incorrecto', () => {
    const payload = {
      ...MIN_VALID,
      schemaVersion: 'espirometria-questionnaire-v0',
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza capturedAt no-ISO', () => {
    const payload = { ...MIN_VALID, capturedAt: 'ayer' }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza espirometria_previa=SI sin rango', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: { espirometria_previa: 'SI' as const },
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const hasRangoError = parsed.error.issues.some(i =>
        i.path.join('.') === 'antecedentes.espirometria_previa_rango',
      )
      expect(hasRangoError).toBe(true)
    }
  })

  it('rechaza fuma_o_fumo=SI sin cigarrillos_por_dia_rango ni fuma_desde_rango', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: { fuma_o_fumo: 'SI' as const },
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza exposicion_ocupacional=SI sin tipos ni duración', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: { exposicion_ocupacional: 'SI' as const },
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza inhalador_otro sin seleccionar OTRO en catálogo', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        usa_inhalador: 'SI' as const,
        inhalador_tipos: ['BRONCODILATADOR' as const],
        inhalador_otro: 'valor libre',
      },
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza cirugia_otro sin seleccionar OTRO en catálogo', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        cirugia_reciente: 'SI' as const,
        cirugia_tipos: ['ABDOMINAL' as const],
        cirugia_otro: 'valor libre',
      },
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza antecedente_cardiopulmonar_o_epilepsia=SI con campo Otro libre', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        antecedente_cardiopulmonar_o_epilepsia: 'SI' as const,
        antecedente_medico_tipos: ['EPILEPSIA' as const],
        antecedente_medico_otro: 'otro antecedente',
      },
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza observación en exploración con estado Normal', () => {
    const payload = {
      ...MIN_VALID,
      exploracionFisica: {
        vias_respiratorias_superiores: {
          estado: 'NORMAL' as const,
          observacion: 'no debería',
        },
        torax: { estado: 'NORMAL' as const },
        pulmones: { estado: 'NORMAL' as const },
      },
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza observación en exploración con estado No realizado', () => {
    const payload = {
      ...MIN_VALID,
      exploracionFisica: {
        vias_respiratorias_superiores: { estado: 'NO_REALIZADO' as const },
        torax: { estado: 'NORMAL' as const },
        pulmones: {
          estado: 'NO_REALIZADO' as const,
          observacion: 'no debería',
        },
      },
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('acepta observación cuando el estado es Alterado', () => {
    const payload = {
      ...MIN_VALID,
      exploracionFisica: {
        vias_respiratorias_superiores: {
          estado: 'ALTERADO' as const,
          observacion: 'sibilancias bilaterales',
        },
        torax: { estado: 'NORMAL' as const },
        pulmones: { estado: 'NORMAL' as const },
      },
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(true)
  })

  it('rechaza enum de embarazo fuera del catálogo', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: { embarazo: 'TAL_VEZ' as unknown as 'NO_APLICA' },
    }
    const parsed = EspirometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })
})

describe('EspirometriaQuestionnairePayloadSchema — versión constante', () => {
  it('expone la constante de versión', () => {
    expect(ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION).toBe(
      'espirometria-questionnaire-v1',
    )
  })
})
