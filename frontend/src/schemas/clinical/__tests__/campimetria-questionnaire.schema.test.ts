/**
 * Tests V1 del schema de captura de Campimetría (SPEC-FEATURE-20260914-01).
 */
import { describe, expect, it } from 'vitest'
import {
  CampimetriaQuestionnairePayloadSchema,
  CAMPIMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  defaultCampimetriaDraftPayload,
  defaultCampimetriaQuestionnairePayload,
  deriveIshiharaResultado,
  expectedIshiharaAnswers,
  isIshiharaPlateAnswerCorrect,
} from '../campimetria-questionnaire.schema'
import { buildCampimetriaImpresion, buildCampimetriaExtractedData } from '@/lib/clinical/campimetria-report'
import { inheritAcuityFromExam } from '@/lib/clinical/campimetria-inherited'

describe('Ishihara defaults y validación por placa', () => {
  it('borrador nuevo trae placas normales y resultado NORMAL', () => {
    const draft = defaultCampimetriaDraftPayload()
    const expected = expectedIshiharaAnswers()
    expect(draft.ishihara.resultado).toBe('NORMAL')
    expect(draft.ishihara.ojo_derecho).toEqual(expected)
    expect(draft.ishihara.ojo_izquierdo).toEqual(expected)
    expect(deriveIshiharaResultado(draft.ishihara)).toBe('NORMAL')
  })

  it('isIshiharaPlateAnswerCorrect: vacío ok; distinto al esperado no', () => {
    expect(isIshiharaPlateAnswerCorrect('p03', '')).toBe(true)
    expect(isIshiharaPlateAnswerCorrect('p03', '03')).toBe(true)
    expect(isIshiharaPlateAnswerCorrect('p03', '3')).toBe(true)
    expect(isIshiharaPlateAnswerCorrect('p03', '99')).toBe(false)
  })
})

describe('CampimetriaQuestionnairePayloadSchema', () => {
  it('acepta el payload default (caso feliz, todo normal)', () => {
    const parsed = CampimetriaQuestionnairePayloadSchema.safeParse(
      defaultCampimetriaQuestionnairePayload(),
    )
    expect(parsed.success).toBe(true)
  })

  it('rechaza schemaVersion distinto', () => {
    const parsed = CampimetriaQuestionnairePayloadSchema.safeParse({
      ...defaultCampimetriaQuestionnairePayload(),
      schemaVersion: 'otra',
    })
    expect(parsed.success).toBe(false)
  })

  it('exige tiempo de lentes si uso_lentes = SI', () => {
    const payload = defaultCampimetriaQuestionnairePayload()
    payload.antecedentes.uso_lentes = 'SI'
    const parsed = CampimetriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })

  it('exige observación si exploración está alterada', () => {
    const payload = defaultCampimetriaQuestionnairePayload()
    payload.exploracion.ojo_derecho.fondo_de_ojo = { estado: 'ALTERADO' }
    const parsed = CampimetriaQuestionnairePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(false)
  })
})

describe('buildCampimetriaImpresion', () => {
  it('arma el literal normal del Excel', () => {
    const payload = defaultCampimetriaQuestionnairePayload()
    const text = buildCampimetriaImpresion({
      payload,
      acuity: inheritAcuityFromExam({
        vision_lejana_od: '20/20',
        vision_lejana_oi: '20/20',
      }),
    })
    expect(text).toBe(
      'AGUDEZA VISUAL NORMAL, CAMPOS VISUALES EN PARAMETROS NORMALES, SIN ALTERACION EN DISCRIMINACION DE COLORES',
    )
  })

  it('marca agudeza pendiente si no hay Snellen en papeleta', () => {
    const payload = defaultCampimetriaQuestionnairePayload()
    const text = buildCampimetriaImpresion({
      payload,
      acuity: inheritAcuityFromExam(null),
    })
    expect(text).toContain('PENDIENTE EN PAPELETA')
  })
})

describe('buildCampimetriaExtractedData', () => {
  it('expone confrontación OD/OI para el prediagnóstico IA', () => {
    const payload = defaultCampimetriaQuestionnairePayload()
    const data = buildCampimetriaExtractedData({
      payload,
      acuity: inheritAcuityFromExam(null),
    })
    expect(data.confrontacion_od).toBe('CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES')
    expect(data.confrontacion_oi).toBe('CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES')
    expect(data.ishihara_resultado).toBe('NORMAL')
  })
})
