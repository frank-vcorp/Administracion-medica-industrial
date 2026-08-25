/**
 * @fileoverview Tests V1 focales del schema Zod del cuestionario auditivo
 *   de Audiometría (FEATURE-20260825-02).
 *
 * Cubre:
 *   - Payload mínimo válido (todas las secciones vacías).
 *   - Payload completo válido.
 *   - Rechazo por schemaVersion incorrecto (defensa contra prompt
 *     injection / versiones futuras).
 *   - Rechazo por capturedAt inválido.
 *   - Rechazo por Sí sin sub-campo (audiometria_previa, dificultad
 *     auditiva, exposición laboral, recreativa, explosión, infecciones,
 *     tinnitus, medicamentos).
 *   - Rechazo por `Otro` sin catálogo OTRO (en exposición laboral,
 *     recreativa, explosión, infecciones, medicamentos).
 *   - DEC-20260825-08 / BR-20260825-09: el payload NO contiene los
 *     campos administrativos `patientId`, `consentimiento`,
 *     `responsableCaptura` ni `responsableMedico`. Si se reciben
 *     payloads con esos campos, Zod los ignora (passthrough) o el
 *     caller puede fallar por "propiedades desconocidas" en
 *     `strictParse`. Nos aseguramos de que el schema SÓLO expone los
 *     campos permitidos.
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */
import {
  AudiometriaQuestionnairePayloadSchema,
  AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  type AudiometriaQuestionnairePayload,
} from '../audiometria-questionnaire.schema'

const MIN_VALID: AudiometriaQuestionnairePayload = {
  schemaVersion: AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  capturedAt: '2026-08-25T14:00:00.000Z',
  antecedentes: {
    audiometria_previa: undefined,
    audiometria_previa_rango: undefined,
    dificultad_auditiva: undefined,
    dificultad_auditiva_lado: undefined,
    exposicion_ruido_laboral: undefined,
    exposicion_tipos: undefined,
    exposicion_otro: undefined,
    exposicion_duracion_rango: undefined,
    exposicion_ruido_recreativa: undefined,
    exposicion_recreativa_tipos: undefined,
    exposicion_recreativa_otro: undefined,
    exposicion_recreativa_duracion_rango: undefined,
    explosion_o_trauma: undefined,
    explosion_tipos: undefined,
    explosion_otro: undefined,
    infecciones_oticas: undefined,
    infecciones_tipos: undefined,
    infecciones_otro: undefined,
    tinnitus_o_mareos: undefined,
    tinnitus_lado: undefined,
    medicamentos_otoxicos: undefined,
    medicamentos_tipos: undefined,
    medicamentos_otro: undefined,
    observaciones: undefined,
  },
  exploracionFisica: {
    faringe: { estado: 'NORMAL', observacion: undefined },
    cad: { estado: 'NORMAL', observacion: undefined },
    cai: { estado: 'NORMAL', observacion: undefined },
    mtd: { estado: 'NORMAL', observacion: undefined },
    mti: { estado: 'NORMAL', observacion: undefined },
  },
  observaciones: undefined,
}

describe('AudiometriaQuestionnairePayloadSchema — payload mínimo', () => {
  it('acepta un payload con todos los campos opcionales vacíos', () => {
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(MIN_VALID)
    expect(parsed.success).toBe(true)
  })
})

describe('AudiometriaQuestionnairePayloadSchema — payload completo', () => {
  it('acepta un payload completo de antecedentes y exploración alterada', () => {
    const payload: AudiometriaQuestionnairePayload = {
      schemaVersion: AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
      capturedAt: '2026-08-25T14:00:00.000Z',
      // DEC-20260825-08: el payload NO incluye los campos administrativos
      // retirados (patientId, consentimiento, responsableCaptura,
      // responsableMedico). Sólo antecedentes, exploración física y
      // observaciones clínicas.
      antecedentes: {
        audiometria_previa: 'SI',
        audiometria_previa_rango: 'MAS_5_ANIOS',
        dificultad_auditiva: 'SI',
        dificultad_auditiva_lado: 'OD',
        exposicion_ruido_laboral: 'SI',
        exposicion_tipos: ['INDUSTRIAL'],
        exposicion_otro: undefined,
        exposicion_duracion_rango: 'MAS_5_ANIOS',
        exposicion_ruido_recreativa: 'NO',
        exposicion_recreativa_tipos: undefined,
        exposicion_recreativa_otro: undefined,
        exposicion_recreativa_duracion_rango: undefined,
        explosion_o_trauma: 'NO',
        explosion_tipos: undefined,
        explosion_otro: undefined,
        infecciones_oticas: 'NO',
        infecciones_tipos: undefined,
        infecciones_otro: undefined,
        tinnitus_o_mareos: 'SI',
        tinnitus_lado: 'BILATERAL',
        medicamentos_otoxicos: 'NO',
        medicamentos_tipos: undefined,
        medicamentos_otro: undefined,
        observaciones: 'Sin hallazgos adicionales',
      },
      exploracionFisica: {
        faringe: { estado: 'NORMAL', observacion: undefined },
        cad: { estado: 'ALTERADO', observacion: 'Cerumen abundante' },
        cai: { estado: 'NORMAL', observacion: undefined },
        mtd: { estado: 'NORMAL', observacion: undefined },
        mti: { estado: 'NORMAL', observacion: undefined },
      },
      observaciones: 'Seguimiento audiométrico anual',
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(true)
  })
})

describe('AudiometriaQuestionnairePayloadSchema — rechazos', () => {
  it('rechaza schemaVersion distinto a audiometria-questionnaire-v1', () => {
    const payload = {
      ...MIN_VALID,
      schemaVersion: 'audiometria-questionnaire-v0',
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza capturedAt inválido', () => {
    const payload = { ...MIN_VALID, capturedAt: 'ayer' }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza audiometria_previa=SI sin rango', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        ...MIN_VALID.antecedentes,
        audiometria_previa: 'SI' as const,
      },
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('antecedentes.audiometria_previa_rango')
    }
  })

  it('rechaza dificultad_auditiva=SI sin lado', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        ...MIN_VALID.antecedentes,
        dificultad_auditiva: 'SI' as const,
      },
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza exposicion_ruido_laboral=SI sin tipos ni duración', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        ...MIN_VALID.antecedentes,
        exposicion_ruido_laboral: 'SI' as const,
      },
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza exposicion_ruido_laboral=SI con OTRO texto pero sin OTRO en catálogo', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        ...MIN_VALID.antecedentes,
        exposicion_ruido_laboral: 'SI' as const,
        exposicion_tipos: ['INDUSTRIAL'],
        exposicion_otro: 'taller de maquinaria',
        exposicion_duracion_rango: '1_A_3_ANIOS' as const,
      },
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza explosion_o_trauma=SI sin tipos', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        ...MIN_VALID.antecedentes,
        explosion_o_trauma: 'SI' as const,
      },
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza infecciones_oticas=SI sin tipos', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        ...MIN_VALID.antecedentes,
        infecciones_oticas: 'SI' as const,
      },
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza tinnitus_o_mareos=SI sin lado', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        ...MIN_VALID.antecedentes,
        tinnitus_o_mareos: 'SI' as const,
      },
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza medicamentos_otoxicos=SI sin tipos', () => {
    const payload = {
      ...MIN_VALID,
      antecedentes: {
        ...MIN_VALID.antecedentes,
        medicamentos_otoxicos: 'SI' as const,
      },
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('rechaza observación en exploración Normal/No realizado', () => {
    const payload = {
      ...MIN_VALID,
      exploracionFisica: {
        ...MIN_VALID.exploracionFisica,
        cad: { estado: 'NORMAL' as const, observacion: 'sin hallazgos' },
      },
    }
    const parsed =
      AudiometriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })
})

describe('AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION — constante', () => {
  it('es audiometria-questionnaire-v1', () => {
    expect(AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION).toBe(
      'audiometria-questionnaire-v1',
    )
  })
})