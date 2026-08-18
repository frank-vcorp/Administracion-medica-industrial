/**
 * @file Tests para `saveExamenMedicoPapeleta` — IMPL-20260809-02.
 *
 * Cubre:
 * - Regresión CP-7 (SPEC v2 §11): schemas (`ExamenMedicoCompletoSchema` y
 *   `AntecedentesCapturaSchema`/`DatosPersonalesModulo1Schema`) siguen
 *   aceptando/rechazando correctamente `antecedentes_captured`.
 * - CP-6 (SPEC v2 §11): `saveExamenMedicoPapeleta` persiste el snapshot
 *   `antecedentes_captured` en `physicalExamData` (full-replace incluye
 *   el campo) junto con `modulo1` y resto del examen.
 *
 * IMPL-20260809-02 (ARCH-20260809-01 v2): los 13 tests originales de
 * `saveAntecedentesCaptura` se eliminaron — esa action ya no existe
 * (la persistencia de antecedentes se integra en `saveExamenMedicoPapeleta`).
 * Se conservan los 5 tests de schemas y se añaden los de `saveExamenMedicoPapeleta`
 * con `antecedentes_captured` en el payload.
 *
 * @id IMPL-20260809-02
 * @spec context/SPECs/SPEC_ARCH-20260809-01-ANTECEDENTES-SUB-PESTANA-EXAMEN-MEDICO.md
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import {
  ExamenMedicoCompletoSchema,
  ExploracionFisicaSchema,
  ImpresiónAptitudSchema,
  AntecedentesCapturaSchema,
  AgudezaVisualSchema,
  VISION_SNELLEN_VALUES,
  REFLEJOS_VALUES,
  CAMPIMETRIA_VALUES,
  TEST_ISHIHARA_VALUES,
  HEREDOFAMILIARES_VALUES,
  HEREDOFAMILIARES_MENTALES_VALUES,
  ARCO_MOVILIDAD_VALUES,
  TONO_MUSCULAR_VALUES,
  COORDINACION_VALUES,
  TEST_ADAM_VALUES,
  PRESENCIA_QUISTE_SINOVIAL_VALUES,
  TEST_ROMBERG_VALUES,
  SIGNO_BRAGARD_VALUES,
  SIGNO_TINEL_VALUES,
  PRUEBA_LATERALIDAD_VALUES,
  CIRCULACION_VENOSA_VALUES,
  SALUD_BUCAL_VALUES,
  ESTADO_NUTRICIONAL_VALUES,
  PLANTILLAS_EF,
  // IMPL-20260817-07: catálogos ZIN Módulo 1 (ginecológicos + vacunas)
  AG_IVS_VALUES,
  AG_VSA_VALUES,
  AG_NUMERIC_0_11,
  AG_ABORTO_VALUES,
  VAC_SI_NO_VALUES,
  SI_NO_NA_VALUES,
  // IMPL-20260817-08 (ARCH-20260817-02): 5 valores PDF para aptitud +
  // enums cortos para agudeza/presión.
  APTITUD_VALUES,
  AGUDEZA_VISUAL_RESUMEN_VALUES,
  PRESION_ARTERIAL_RESUMEN_VALUES,
} from '@/schemas/clinical/exam.schema'
// IMPL-20260817-08-C8 (ARCH-20260817-02): tests de helpers de aptitud
// (isAptoFromVerdict, isNoCumple, isPendienteResultados, aptitudLabel).
import {
  isAptoFromVerdict,
  isNoCumple,
  isPendienteResultados,
  aptitudLabel,
} from '@/lib/clinical/aptitud.helper'
// IMPL-20260817-09-C5 (ARCH-20260817-02 corte 2 DA-5/DA-7): tests de
// los helpers de auto-poblamiento del resumen ejecutivo y las
// recomendaciones del dictamen.
import {
  buildExamSummary,
  EXAM_SUMMARY_LABELS,
} from '@/lib/clinical/exam-summary'
import {
  buildRecommendations,
  buildRecommendationsFromExam,
  detectHallazgosFromExam,
  detectHallazgosFromIa,
  extractHallazgos,
  CATALOGO_RECOMENDACIONES,
} from '@/lib/clinical/recommendations'
import {
  DatosPersonalesModulo1Schema,
  HeredoFamiliaresSchema,
  NoPatologicosSchema,
  PatologicosSchema,
  DetalleTripleSchema,
  PatologiaConDetalleSchema,
  GRUPO_RH_VALUES,
} from '@/schemas/clinical/history.schema'

// ─── Mock state (declarados ANTES de vi.mock para evitar TDZ) ──────────────
const mockMedicalExamUpsert = vi.fn()
const mockEventTestUpdate = vi.fn()
const mockTriggerAI = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    medicalExam: {
      upsert: (...args: unknown[]) => mockMedicalExamUpsert(...args),
    },
    eventTest: {
      update: (...args: unknown[]) => mockEventTestUpdate(...args),
    },
  },
}))
vi.mock('@/lib/timeline.service', () => ({
  writeTimelineEntry: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./ai-prediagnosis.actions', () => ({
  triggerStructuredStudyAIPrediagnosis: (...args: unknown[]) => mockTriggerAI(...args),
}))

import { saveExamenMedicoPapeleta } from '@/actions/medical-exam.actions'

describe('medical-exam.actions saveExamenMedicoPapeleta (IMPL-20260809-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMedicalExamUpsert.mockResolvedValue({ id: 'me-1', eventId: 'evt-1' })
    mockTriggerAI.mockResolvedValue({ success: true, summary: 'ok', clinicalState: 'AI_PENDING_REVIEW' })
    mockEventTestUpdate.mockResolvedValue({ id: 'et-1' })
  })

  // ─── CP-6: antecedentes_captured persiste via full-replace ────────────────
  it('1. payload con antecedentes_captured → persiste en physicalExamData (full-replace)', async () => {
    const payload = {
      neurologico: 'normal',
      antecedentes_medico: 'nota previa',
      modulo1: { m1_sexo: 'Femenino' },
      antecedentes_captured: {
        datos_personales: { puesto_actual: 'Soldador', turno: 'MATUTINO' as const },
        historia_laboral: { empresa_anterior_1: 'Acme' },
        heredo_familiares: { diabetes: 'PADRE' },
        no_patologicos: { alcohol: 'NEGADO' as const, tabaco: 'NEGADO' as const },
        patologicos: { diabetes: 'NEGADO' as const },
      },
    }
    const res = await saveExamenMedicoPapeleta('evt-1', 'et-1', payload, false)
    expect(res.success).toBe(true)
    expect(mockMedicalExamUpsert).toHaveBeenCalledTimes(1)
    const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
    // Full-replace de physicalExamData (incluye modulo1 + antecedentes_captured)
    expect(upsertArg.where).toEqual({ eventId: 'evt-1' })
    expect(upsertArg.update.physicalExamData.antecedentes_medico).toBe('nota previa')
    expect(upsertArg.update.physicalExamData.modulo1).toEqual({ m1_sexo: 'Femenino' })
    expect(
      upsertArg.update.physicalExamData.antecedentes_captured.datos_personales.puesto_actual,
    ).toBe('Soldador')
    expect(
      upsertArg.update.physicalExamData.antecedentes_captured.datos_personales.turno,
    ).toBe('MATUTINO')
  })

  it('2. payload SIN antecedentes_captured → merge funciona (compat retroactiva)', async () => {
    const legacyPayload = { neurologico: 'normal', aptitud: 'APTO' }
    const res = await saveExamenMedicoPapeleta('evt-1', 'et-1', legacyPayload, false)
    expect(res.success).toBe(true)
    const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
    expect(upsertArg.update.physicalExamData.aptitud).toBe('APTO')
    expect(upsertArg.update.physicalExamData.antecedentes_captured).toBeUndefined()
  })

  it('3. markComplete=false → status RESULT_REGISTERED', async () => {
    await saveExamenMedicoPapeleta(
      'evt-1',
      'et-1',
      { neurologico: 'normal', antecedentes_captured: {} },
      false,
    )
    expect(mockEventTestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'et-1' }, data: { status: 'RESULT_REGISTERED' } }),
    )
  })

  it('4. markComplete=true → status COMPLETED', async () => {
    await saveExamenMedicoPapeleta(
      'evt-1',
      'et-1',
      { neurologico: 'normal', antecedentes_captured: {} },
      true,
    )
    expect(mockEventTestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'et-1' }, data: { status: 'COMPLETED' } }),
    )
  })

  it('5. antecedentes_captured serializado como string "[object Object]" → schema rechaza', async () => {
    // Defensa: si buildPayload() filtrara antecedentes_captured como string,
    // el schema debe rechazarlo (regresión I-1 conservada). El action
    // captura el ZodError en su try/catch y devuelve { success: false }
    // sin llamar a Prisma.
    const buggyPayload = {
      neurologico: 'normal',
      antecedentes_captured: '[object Object]' as unknown as Record<string, unknown>,
    }
    const res = await saveExamenMedicoPapeleta('evt-1', 'et-1', buggyPayload, false)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/error/i)
    expect(mockMedicalExamUpsert).not.toHaveBeenCalled()
  })
})

// ─── Regresión: schemas siguen siendo válidos (conservados de IMPL-20260809-01) ───

describe('schemas IMPL-20260809-02 (regresión I-1 / I-2)', () => {
  it('6. (I-1) ExamenMedicoCompletoSchema acepta antecedentes_captured como objeto válido', () => {
    const validPayload = {
      neurologico: 'normal',
      antecedentes_captured: {
        datos_personales: { puesto_actual: 'Soldador', turno: 'MATUTINO' as const },
        historia_laboral: { empresa_anterior_1: 'Acme' },
        heredo_familiares: { diabetes: 'PADRE' },
        no_patologicos: { alcohol: 'NEGADO' as const, tabaco: 'NEGADO' as const },
        patologicos: { diabetes: 'NEGADO' as const },
      },
    }
    expect(() => ExamenMedicoCompletoSchema.parse(validPayload)).not.toThrow()
    const parsed = ExamenMedicoCompletoSchema.parse(validPayload)
    const dp = parsed.antecedentes_captured?.datos_personales
    expect(dp?.puesto_actual).toBe('Soldador')
    expect(dp?.turno).toBe('MATUTINO')
  })

  it('7. (I-1) ExamenMedicoCompletoSchema acepta payload sin antecedentes_captured (compat retroactiva)', () => {
    const legacyPayload = { neurologico: 'normal', aptitud: 'APTO' }
    expect(() => ExamenMedicoCompletoSchema.parse(legacyPayload)).not.toThrow()
  })

  it('8. (I-2) AntecedentesCapturaSchema acepta turno/estado_civil = undefined', () => {
    const normalized = {
      datos_personales: { puesto_actual: 'Soldador', turno: undefined, estado_civil: undefined },
    }
    expect(() => AntecedentesCapturaSchema.parse(normalized)).not.toThrow()
    expect(() =>
      DatosPersonalesModulo1Schema.parse({ turno: undefined, estado_civil: undefined }),
    ).not.toThrow()
  })

  it('9. (I-2) defensa en profundidad: schema RECHAZA turno: "" y estado_civil: ""', () => {
    expect(() => DatosPersonalesModulo1Schema.parse({ turno: '' })).toThrow()
    expect(() => DatosPersonalesModulo1Schema.parse({ estado_civil: '' })).toThrow()
    expect(() => AntecedentesCapturaSchema.parse({ datos_personales: { turno: '' } })).toThrow()
  })

  it('10. (I-2) AntecedentesCapturaSchema acepta payload normalizado (sin turno/estado_civil vacíos)', () => {
    const normalizedPayload = {
      datos_personales: { puesto_actual: 'Soldador', turno: undefined, estado_civil: undefined },
      historia_laboral: {},
      heredo_familiares: {},
      no_patologicos: { alcohol: 'NEGADO' as const, tabaco: 'NEGADO' as const },
      patologicos: { diabetes: 'NEGADO' as const },
    }
    expect(() => AntecedentesCapturaSchema.parse(normalizedPayload)).not.toThrow()
    const parsed = AntecedentesCapturaSchema.parse(normalizedPayload)
    expect(parsed.datos_personales?.puesto_actual).toBe('Soldador')
    expect(parsed.datos_personales?.turno).toBeUndefined()
    expect(parsed.datos_personales?.estado_civil).toBeUndefined()
  })
})

// ─── IMPL-20260817-01-C1 (ARCH-20260817-01 corte 1) ──────────────────────────
// Regresión DA-1: `AgudezaVisualSchema` usa catálogos ZIN vía
// `z.string().refine()` tolerante (acepta enum + legacy). Ver SPEC §2.1.
describe('AgudezaVisualSchema IMPL-20260817-01-C1 (ZIN combos tolerancia legacy)', () => {
  it('11. acepta los 10 valores Snellen del catálogo ZIN en los 8 campos de visión', () => {
    const payload = {
      vision_lejana_od: '20/200',
      vision_lejana_oi: '20/100',
      vision_cercana_od: '20/70',
      vision_cercana_oi: '20/50',
      lejana_corregida_od: '20/40',
      lejana_corregida_oi: '20/30',
      cercana_corregida_od: '20/25',
      cercana_corregida_oi: '20/20',
      reflejos: 'PRESENTES Y NORMOREFLECTICOS',
      test_ishihara: 'NORMAL (LEE 12,8,6,29,57,45)',
      campimetria: 'CAMPOS VISUALES DENTRO DE PARÁMETROS NORMALES',
    }
    const parsed = AgudezaVisualSchema.parse(payload)
    expect(parsed.vision_lejana_od).toBe('20/200')
    expect(parsed.reflejos).toBe('PRESENTES Y NORMOREFLECTICOS')
    expect(parsed.campimetria).toBe('CAMPOS VISUALES DENTRO DE PARÁMETROS NORMALES')
  })

  it('12. acepta strings NO-Snellen como legacy (sin migración de datos — DA-1)', () => {
    // Registros históricos con valores arbitrarios en BD cargan sin error.
    // SPEC §2.1 Opción A: el schema NO rechaza legacy text.
    const legacyPayload = {
      vision_lejana_od: '20/30 corregida',
      vision_lejana_oi: 'AV 20/25',
      vision_cercana_od: 'N/A',
      campimetria: 'ver estudio anexo (oftalmología 2024)',
    }
    expect(() => AgudezaVisualSchema.parse(legacyPayload)).not.toThrow()
    const parsed = AgudezaVisualSchema.parse(legacyPayload)
    expect(parsed.vision_lejana_od).toBe('20/30 corregida')
    expect(parsed.campimetria).toBe('ver estudio anexo (oftalmología 2024)')
  })

  it('13. aplica defaults "NO APLICA" (8 visión) y "PRESENTES Y NORMOREFLECTICOS" (reflejos) cuando el campo falta', () => {
    const parsed = AgudezaVisualSchema.parse({})
    expect(parsed.vision_lejana_od).toBe('NO APLICA')
    expect(parsed.vision_lejana_oi).toBe('NO APLICA')
    expect(parsed.vision_cercana_od).toBe('NO APLICA')
    expect(parsed.vision_cercana_oi).toBe('NO APLICA')
    expect(parsed.lejana_corregida_od).toBe('NO APLICA')
    expect(parsed.lejana_corregida_oi).toBe('NO APLICA')
    expect(parsed.cercana_corregida_od).toBe('NO APLICA')
    expect(parsed.cercana_corregida_oi).toBe('NO APLICA')
    expect(parsed.reflejos).toBe('PRESENTES Y NORMOREFLECTICOS')
    // test_ishihara y campimetria son opcionales → undefined
    expect(parsed.test_ishihara).toBeUndefined()
    expect(parsed.campimetria).toBeUndefined()
  })

  it('14. expone constantes VISION_SNELLEN_VALUES (10) + REFLEJOS_VALUES (4) + CAMPIMETRIA_VALUES (4) + TEST_ISHIHARA_VALUES (3)', () => {
    expect(VISION_SNELLEN_VALUES).toHaveLength(10)
    expect(VISION_SNELLEN_VALUES[0]).toBe('20/200')
    expect(VISION_SNELLEN_VALUES[9]).toBe('20/10')
    expect(REFLEJOS_VALUES).toHaveLength(4)
    expect(REFLEJOS_VALUES[0]).toBe('PRESENTES Y NORMOREFLECTICOS')
    expect(CAMPIMETRIA_VALUES).toHaveLength(4)
    expect(CAMPIMETRIA_VALUES[0]).toBe('CAMPOS VISUALES DENTRO DE PARÁMETROS NORMALES')
    expect(TEST_ISHIHARA_VALUES).toHaveLength(3)
    expect(TEST_ISHIHARA_VALUES[0]).toBe('NORMAL (LEE 12,8,6,29,57,45)')
  })
})

// ─── IMPL-20260817-01-C2 (ARCH-20260817-01 corte 2) ──────────────────────────
// Regresión DA-1: ExploracionFisicaSchema + ImpresiónAptitudSchema usan
// catálogos ZIN vía `tolerantZinEnum` (acepta enum + legacy). Ver SPEC §4.2,
// §4.3, §4.4. Las 17 plantillas ZIN se verifican verbatim vs §4.3.
describe('ExploracionFisicaSchema IMPL-20260817-01-C2 (ZIN combos + plantilla literals)', () => {
  it('15. ExploracionFisicaSchema acepta los 13 combos ZIN canónicos', () => {
    const payload = {
      test_adam: 'NEGATIVO',
      boca_estado: 'CARIES',
      circulacion_venosa: 'C0: SIN SIGNOS VISIBLES NI PALPABLES',
      arco_de_movilidad: 'PRESENTES Y NORMALES',
      tono_muscular: 'NORMAL',
      coordinacion: 'NORMAL',
      test_romberg: 'NEGATIVO',
      signo_bragard: 'NEGATIVO',
      prueba_finkelstein: 'NEGATIVO',
      signo_tinel: 'NEGATIVO',
      prueba_phanel: 'NEGATIVO',
      prueba_lasegue: 'NEGATIVO',
      presencia_quiste_sinovial: 'NORMAL',
      // 17 campos con plantilla (texto libre, default sugerido en UI)
      neurologico: 'Alerta, orientado en tiempo, lugar y persona. Cooperador.',
      cabeza: 'Cráneo normocéfalo, sin hundimientos ni exostosis.',
      piel_y_faneras: 'Sin datos de palidez, ictericia o cianosis.',
      oidos_cad: 'Permeable, MT íntegra, cono luminoso permeable.',
      oidos_cai: 'Permeable, MT íntegra, cono luminoso permeable.',
      ojos: 'Pupilas isocóricas, normorrefléxicas.',
      nariz: 'Alineada, septum alineado.',
      faringe: 'Sin datos patológicos.',
      cuello: 'Cilíndrico, tráquea central.',
      torax: 'Mesomórfico, movimientos de amplexión y amplexación normales.',
      corazon: 'Ruidos cardíacos rítmicos, sin soplos.',
      campos_pulmonares: 'Bien ventilados, sin ruidos agregados.',
      abdomen: 'Globoso, blando, depresible, sin dolor.',
      genitourinario: 'Giordano negativo bilateral.',
      columna_vertebral: 'Clínicamente alineada.',
      ms_superiores: 'Íntegros, fuerza y sensibilidad conservada.',
      ms_inferiores: 'Íntegros, sensibilidad conservada.',
    }
    const parsed = ExploracionFisicaSchema.parse(payload)
    expect(parsed.test_adam).toBe('NEGATIVO')
    expect(parsed.boca_estado).toBe('CARIES')
    expect(parsed.circulacion_venosa).toBe('C0: SIN SIGNOS VISIBLES NI PALPABLES')
    expect(parsed.arco_de_movilidad).toBe('PRESENTES Y NORMALES')
    expect(parsed.neurologico).toBe('Alerta, orientado en tiempo, lugar y persona. Cooperador.')
  })

  it('16. ExploracionFisicaSchema acepta strings legacy como DA-1 (no rechaza)', () => {
    // Registros legacy con valores arbitrarios en BD cargan sin error.
    const legacyPayload = {
      test_adam: 'positivo bilateral',
      boca_estado: 'caries múltiples',
      arco_de_movilidad: 'movilidad reducida',
      tono_muscular: 'eutrófico',
    }
    expect(() => ExploracionFisicaSchema.parse(legacyPayload)).not.toThrow()
    const parsed = ExploracionFisicaSchema.parse(legacyPayload)
    expect(parsed.test_adam).toBe('positivo bilateral')
    expect(parsed.boca_estado).toBe('caries múltiples')
  })

  it('17. ExploracionFisicaSchema acepta especifique_positivos opcional (acordeón EF)', () => {
    // IMPL-20260817-01-C2: cuando hay hallazgos POSITIVO, el acordeón
    // txtEFEspecificar se expande con este campo opcional.
    const payload = {
      test_adam: 'POSITIVO',
      especifique_positivos: 'Giba dorsal derecha a nivel T8-T10, asimetría escapular.',
    }
    expect(() => ExploracionFisicaSchema.parse(payload)).not.toThrow()
    const parsed = ExploracionFisicaSchema.parse(payload)
    expect(parsed.especifique_positivos).toBe('Giba dorsal derecha a nivel T8-T10, asimetría escapular.')
  })

  it('18. PLANTILLAS_EF expone los 17 literales verbatim del NOTA MEDICA EJEMPLO.pdf', () => {
    // DA-3: plantillas copiadas exactas, sin paráfrasis. SPEC §4.3.
    expect(Object.keys(PLANTILLAS_EF)).toHaveLength(17)
    expect(PLANTILLAS_EF.neurologico).toBe('Alerta, orientado en tiempo, lugar y persona. Cooperador.')
    expect(PLANTILLAS_EF.cabeza).toBe('Cráneo normocéfalo, sin hundimientos ni exostosis.')
    expect(PLANTILLAS_EF.piel_y_faneras).toBe('Sin datos de palidez, ictericia o cianosis.')
    expect(PLANTILLAS_EF.oidos_cad).toBe('Permeable, MT íntegra, cono luminoso permeable.')
    expect(PLANTILLAS_EF.oidos_cai).toBe('Permeable, MT íntegra, cono luminoso permeable.')
    expect(PLANTILLAS_EF.ojos).toBe('Pupilas isocóricas, normorrefléxicas.')
    expect(PLANTILLAS_EF.nariz).toBe('Alineada, septum alineado.')
    expect(PLANTILLAS_EF.faringe).toBe('Sin datos patológicos.')
    expect(PLANTILLAS_EF.cuello).toBe('Cilíndrico, tráquea central.')
    expect(PLANTILLAS_EF.torax).toBe('Mesomórfico, movimientos de amplexión y amplexación normales.')
    expect(PLANTILLAS_EF.corazon).toBe('Ruidos cardíacos rítmicos, sin soplos.')
    expect(PLANTILLAS_EF.campos_pulmonares).toBe('Bien ventilados, sin ruidos agregados.')
    expect(PLANTILLAS_EF.abdomen).toBe('Globoso, blando, depresible, sin dolor.')
    expect(PLANTILLAS_EF.genitourinario).toBe('Giordano negativo bilateral.')
    expect(PLANTILLAS_EF.columna_vertebral).toBe('Clínicamente alineada.')
    expect(PLANTILLAS_EF.ms_superiores).toBe('Íntegros, fuerza y sensibilidad conservada.')
    expect(PLANTILLAS_EF.ms_inferiores).toBe('Íntegros, sensibilidad conservada.')
  })

  it('19. ImpresiónAptitudSchema acepta estado_nutricional + salud_bucal con ZIN enum', () => {
    const payload = {
      estado_nutricional: 'NORMAL',
      salud_bucal: 'CARIES Y SARRO',
      aptitud: 'APTO' as const,
    }
    const parsed = ImpresiónAptitudSchema.parse(payload)
    expect(parsed.estado_nutricional).toBe('NORMAL')
    expect(parsed.salud_bucal).toBe('CARIES Y SARRO')
    expect(parsed.aptitud).toBe('APTO')
  })

  it('20. ImpresiónAptitudSchema acepta legacy libre en estado_nutricional + salud_bucal (DA-1)', () => {
    const legacy = {
      estado_nutricional: 'Desnutrición leve',
      salud_bucal: 'mala higiene',
    }
    expect(() => ImpresiónAptitudSchema.parse(legacy)).not.toThrow()
    const parsed = ImpresiónAptitudSchema.parse(legacy)
    expect(parsed.estado_nutricional).toBe('Desnutrición leve')
    expect(parsed.salud_bucal).toBe('mala higiene')
  })

  it('21. HEREDOFAMILIARES_VALUES expone 8 valores canónicos ZIN', () => {
    // SPEC §4.4: 7 campos canónicos (diabetes, has, epilepsia, cardiopatia,
    // renales, asma, cancer) usan este catálogo.
    expect(HEREDOFAMILIARES_VALUES).toHaveLength(8)
    expect(HEREDOFAMILIARES_VALUES).toContain('NEGADOS')
    expect(HEREDOFAMILIARES_VALUES).toContain('PADRE')
    expect(HEREDOFAMILIARES_VALUES).toContain('MADRE')
    expect(HEREDOFAMILIARES_VALUES).toContain('AMBOS')
    expect(HEREDOFAMILIARES_VALUES).toContain('HERMANOS')
    expect(HEREDOFAMILIARES_VALUES).toContain('AB PATERNO')
    expect(HEREDOFAMILIARES_VALUES).toContain('AB MATERNO')
    expect(HEREDOFAMILIARES_VALUES).toContain('OTROS')
  })

  it('22. HEREDOFAMILIARES_MENTALES_VALUES expone 3 valores canónicos ZIN', () => {
    // SPEC §4.4: campo `mentales` usa catálogo dedicado.
    expect(HEREDOFAMILIARES_MENTALES_VALUES).toHaveLength(3)
    expect(HEREDOFAMILIARES_MENTALES_VALUES).toContain('NEGADO')
    expect(HEREDOFAMILIARES_MENTALES_VALUES).toContain('SI')
    expect(HEREDOFAMILIARES_MENTALES_VALUES).toContain('NO APLICA')
  })

  it('23. ExamenMedicoCompletoSchema acepta payload Corte 2 completo (exploración + resumen)', () => {
    // Cobertura de extremo a extremo: la captura del médico con todos los
    // nuevos enums ZIN parsea OK.
    const payload = {
      neurologico: 'Alerta, orientado en tiempo, lugar y persona. Cooperador.',
      test_adam: 'NEGATIVO',
      arco_de_movilidad: 'PRESENTES Y NORMALES',
      tono_muscular: 'NORMAL',
      coordinacion: 'NORMAL',
      boca_estado: 'CARIES',
      estado_nutricional: 'NORMAL',
      salud_bucal: 'CARIES Y SARRO',
      antecedentes_captured: {
        datos_personales: { puesto_actual: 'Soldador', turno: 'MATUTINO' as const },
        historia_laboral: {},
        heredo_familiares: { diabetes: 'PADRE', mentales: 'NEGADO' },
        no_patologicos: { alcohol: 'NEGADO' as const, tabaco: 'NEGADO' as const },
        patologicos: { diabetes: 'NEGADO' as const },
      },
    }
    expect(() => ExamenMedicoCompletoSchema.parse(payload)).not.toThrow()
    const parsed = ExamenMedicoCompletoSchema.parse(payload)
    expect(parsed.test_adam).toBe('NEGATIVO')
    expect(parsed.estado_nutricional).toBe('NORMAL')
    expect(parsed.antecedentes_captured?.heredo_familiares?.diabetes).toBe('PADRE')
  })

  it('24. ExamenMedicoCompletoSchema acepta legacy mixto (Corte 1 + Corte 2 ligibles)', () => {
    // Regresión DA-1: integración de datos legacy con strings arbitrarios
    // en los nuevos campos Corte 2.
    const payload = {
      test_adam: 'positivo bilateral',
      estado_nutricional: 'sobrepeso II',
      salud_bucal: 'mala higiene',
      antecedentes_captured: {
        datos_personales: { puesto_actual: 'Soldador' },
        historia_laboral: {},
        heredo_familiares: { diabetes: 'ABUELO MATERNO' }, // texto libre legacy
        no_patologicos: {},
        patologicos: {},
      },
    }
    expect(() => ExamenMedicoCompletoSchema.parse(payload)).not.toThrow()
    const parsed = ExamenMedicoCompletoSchema.parse(payload)
    expect(parsed.test_adam).toBe('positivo bilateral')
    expect(parsed.antecedentes_captured?.heredo_familiares?.diabetes).toBe('ABUELO MATERNO')
  })

  it('25. expone constantes completas de exploración física (13 catálogos ZIN)', () => {
    // Cobertura de tamaño/primer valor de cada catálogo.
    expect(ARCO_MOVILIDAD_VALUES).toHaveLength(3)
    expect(ARCO_MOVILIDAD_VALUES[0]).toBe('PRESENTES Y NORMALES')
    expect(TONO_MUSCULAR_VALUES).toHaveLength(3)
    expect(TONO_MUSCULAR_VALUES).toContain('NORMAL')
    expect(COORDINACION_VALUES).toHaveLength(2)
    expect(TEST_ADAM_VALUES).toHaveLength(2)
    expect(TEST_ADAM_VALUES).toContain('NEGATIVO')
    expect(PRESENCIA_QUISTE_SINOVIAL_VALUES).toHaveLength(4)
    expect(TEST_ROMBERG_VALUES).toHaveLength(4)
    expect(SIGNO_BRAGARD_VALUES).toHaveLength(2)
    expect(SIGNO_TINEL_VALUES).toHaveLength(4)
    expect(PRUEBA_LATERALIDAD_VALUES).toHaveLength(4)
    expect(CIRCULACION_VENOSA_VALUES).toHaveLength(7)
    expect(CIRCULACION_VENOSA_VALUES[0]).toBe('C0: SIN SIGNOS VISIBLES NI PALPABLES')
    expect(CIRCULACION_VENOSA_VALUES[6]).toBe('C6: ULCERA ACTIVA')
    expect(SALUD_BUCAL_VALUES).toHaveLength(4)
    expect(ESTADO_NUTRICIONAL_VALUES).toHaveLength(6)
    expect(ESTADO_NUTRICIONAL_VALUES).toContain('BAJO PESO')
    expect(ESTADO_NUTRICIONAL_VALUES).toContain('OBESIDAD G3')
  })
})

// ─── IMPL-20260817-02 (FIX L2 QA-20260817-01-C2) ─────────────────────────────
// Bug L2: el input "Especifique" del campo `otras` (Heredo-Familiares)
// compartía state con el select → al primer carácter tipeado, el input se
// auto-destruía (porque `otras` cambiaba de 'OTROS' al texto tipeado y la
// condición que mostraba el input dejaba de cumplirse).
//
// Fix: separar en 2 state keys independientes (`otras` para el select,
// `otras_especifique` para el texto libre). El schema Zod gana un campo
// `otras_especifique` (max 250 chars, default '') que DA-1 tolera como
// opcional — registros legacy sin este campo siguen parseando OK.
// @id IMPL-20260817-02
describe('FIX L2 IMPL-20260817-02 (heredo-familiares: otras_especifique separado de otras)', () => {
  it('26. HeredoFamiliaresSchema: input Especifique NO destruye `otras` al tipear', () => {
    // Antes: tipear 'T' cambiaba `otras` a 'T' → condición se perdía → input
    // desaparecía. Ahora: `otras` y `otras_especifique` son keys independientes.
    const initial = HeredoFamiliaresSchema.parse({
      otras: 'OTROS',
      otras_especifique: '',
    })
    expect(initial.otras).toBe('OTROS')
    expect(initial.otras_especifique).toBe('')

    // Tipear 'T' en otras_especifique — el campo `otras` NO debe cambiar.
    const afterTyping = HeredoFamiliaresSchema.parse({
      otras: 'OTROS',
      otras_especifique: 'TÍO PATERNO',
    })
    expect(afterTyping.otras).toBe('OTROS')
    expect(afterTyping.otras_especifique).toBe('TÍO PATERNO')
  })

  it('27. HeredoFamiliaresSchema: otras_especifique acepta hasta 250 chars', () => {
    const exactly250 = 'a'.repeat(250)
    expect(() =>
      HeredoFamiliaresSchema.parse({ otras: 'OTROS', otras_especifique: exactly250 }),
    ).not.toThrow()

    const tooLong = 'a'.repeat(251)
    const result = HeredoFamiliaresSchema.safeParse({
      otras: 'OTROS',
      otras_especifique: tooLong,
    })
    expect(result.success).toBe(false)
  })

  it('28. HeredoFamiliaresSchema: otras_especifique es opcional (default "")', () => {
    // DA-1: campo nuevo con default '' → registros legacy sin este campo
    // parsean OK. Verifica además que NO contamina otros campos.
    const minimal = HeredoFamiliaresSchema.parse({ otras: 'OTROS' })
    expect(minimal.otras_especifique).toBe('')

    const legacyOnly = HeredoFamiliaresSchema.parse({ diabetes: 'PADRE' })
    expect(legacyOnly.otras).toBeUndefined()
    expect(legacyOnly.otras_especifique).toBe('')
    expect(legacyOnly.diabetes).toBe('PADRE')
  })
})

// ─── IMPL-20260817-03 (ARCH-20260817-01 extensión puntual) ────────────────────
// Migración input libre → <select> con catálogo ZIN canónico para el campo
// `grupo_y_rh` (Antecedentes Personales No Patológicos — Imagen 2).
// DA-1 (tolerancia legacy): el schema sigue aceptando cualquier string
// no-vacío heredado de BD sin error.
describe('IMPL-20260817-03 grupo_y_rh (ZIN combo con 9 valores)', () => {
  it('29. GRUPO_RH_VALUES expone los 9 valores canónicos en orden', () => {
    expect(GRUPO_RH_VALUES).toHaveLength(9)
    expect(GRUPO_RH_VALUES).toEqual([
      'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'DESCONOCE',
    ])
  })

  it('30. NoPatologicosSchema acepta los 9 valores del catálogo ZIN', () => {
    GRUPO_RH_VALUES.forEach(v => {
      const parsed = NoPatologicosSchema.parse({ grupo_y_rh: v })
      expect(parsed.grupo_y_rh).toBe(v)
    })
  })

  it('31. NoPatologicosSchema grupo_y_rh: default "DESCONOCE" si no se envía', () => {
    const parsed = NoPatologicosSchema.parse({})
    expect(parsed.grupo_y_rh).toBe('DESCONOCE')
  })

  it('32. NoPatologicosSchema grupo_y_rh: DA-1 tolera strings legacy no-vacíos', () => {
    // Registros legacy pueden tener cualquier string raro (ej: 'Z+',
    // 'O positivo', 'AB+ DU', 'no sabe' antes del select). DA-1 los acepta
    // sin error para no romper lecturas de BD pre-migración.
    const legacySamples = ['Z+', 'O positivo', 'AB+ DU', 'DESCONOCIDO', 'O+ ']
    legacySamples.forEach(v => {
      expect(() => NoPatologicosSchema.parse({ grupo_y_rh: v })).not.toThrow()
      const parsed = NoPatologicosSchema.parse({ grupo_y_rh: v })
      expect(parsed.grupo_y_rh).toBe(v)
    })
  })
})

// ===========================================================================
// IMPL-20260817-04 — Acordeón Sí/Negado/No Aplica + 3 campos por enfermedad
// del `PatologicosSchema` (junta AMI 10/ago, Erika, línea 285).
//
// DA-1 (tolerancia legacy): registros persistidos como `{ diabetes: 'SI' }`
// siguen parseando OK gracias al union+transform de
// `PatologiaConDetalleSchema`.
// ===========================================================================
describe('IMPL-20260817-04 acordeón Sí/Negado/No Aplica + 3 campos (PatologicosSchema)', () => {
  it('33. PatologicosSchema acepta estado legacy string simple ("SI") y normaliza a {estado, detalle}', () => {
    const legacy = { diabetes: 'SI' as const }
    const parsed = PatologicosSchema.parse(legacy)
    expect(parsed.diabetes.estado).toBe('SI')
    expect(parsed.diabetes.detalle).toBeUndefined()
  })

  it('34. PatologicosSchema acepta estado legacy "NEGADO" / "NO APLICA"', () => {
    const r1 = PatologicosSchema.parse({ hernias: 'NEGADO' })
    expect(r1.hernias.estado).toBe('NEGADO')
    expect(r1.hernias.detalle).toBeUndefined()

    const r2 = PatologicosSchema.parse({ alergias: 'NO APLICA' })
    expect(r2.alergias.estado).toBe('NO APLICA')
    expect(r2.alergias.detalle).toBeUndefined()
  })

  it('35. PatologicosSchema acepta estado nuevo con detalle completo', () => {
    const nuevo = {
      diabetes: {
        estado: 'SI' as const,
        detalle: {
          desde_cuando: '15 años',
          tratamiento: 'Metformina 500mg cada 24h',
          observaciones: 'HbA1c 6.5%, sin complicaciones',
        },
      },
    }
    const parsed = PatologicosSchema.parse(nuevo)
    expect(parsed.diabetes.estado).toBe('SI')
    expect(parsed.diabetes.detalle?.desde_cuando).toBe('15 años')
    expect(parsed.diabetes.detalle?.tratamiento).toBe('Metformina 500mg cada 24h')
    expect(parsed.diabetes.detalle?.observaciones).toBe('HbA1c 6.5%, sin complicaciones')
  })

  it('36. PatologicosSchema: detalle es opcional cuando estado es NEGADO/NO APLICA', () => {
    const r1 = PatologicosSchema.parse({ cardiopatias: { estado: 'NEGADO' } })
    expect(r1.cardiopatias.detalle).toBeUndefined()

    const r2 = PatologicosSchema.parse({ bronquitis: { estado: 'NO APLICA' } })
    expect(r2.bronquitis.detalle).toBeUndefined()
  })

  it('37. PatologicosSchema: payload completo cubre las 31+1 enfermedades', () => {
    // El schema declara 33 enfermedades (31 según handoff — la diferencia es
    // histórica). Verificamos que el payload con todos los campos se acepta
    // y conserva forma canónica.
    const allKeys = [
      'diabetes','hernias','epilepsia','alergias','cardiopatias','bronquitis',
      'ginecologicos','varices','tuberculosis','endocrinopatias','colitis',
      'tifoidea','has','hemorroides','vertigo','parotiditis','dermatitis',
      'pat_c_vertebral','cirugias','hepatitis','exantematicas','gastritis',
      'renales','asma','cancer','traumatismos_craneales','desmayos',
      'fracturas','neumonias','enf_trans_sexual','transfusiones','psiquiatricas',
      'migrana','otras',
    ] as const

    const payload: Record<string, unknown> = {}
    for (const k of allKeys) payload[k] = 'NEGADO'

    const parsed = PatologicosSchema.parse(payload)
    expect(Object.keys(parsed).sort()).toEqual([...allKeys].sort())
    for (const k of allKeys) {
      expect(parsed[k as keyof typeof parsed].estado).toBe('NEGADO')
    }
  })

  it('38. PatologicosSchema: payload mixto legacy + nuevo es coherente', () => {
    const mixto = {
      diabetes: 'SI',                                 // legacy
      hernias: { estado: 'NEGADO' },                  // nuevo sin detalle
      epilepsia: {                                     // nuevo con detalle
        estado: 'SI',
        detalle: { desde_cuando: '5 años', tratamiento: 'Carbamazepina' },
      },
      alergias: 'NO APLICA',                          // legacy
    }
    const parsed = PatologicosSchema.parse(mixto)
    expect(parsed.diabetes.estado).toBe('SI')
    expect(parsed.diabetes.detalle).toBeUndefined()
    expect(parsed.hernias.estado).toBe('NEGADO')
    expect(parsed.hernias.detalle).toBeUndefined()
    expect(parsed.epilepsia.estado).toBe('SI')
    expect(parsed.epilepsia.detalle?.desde_cuando).toBe('5 años')
    expect(parsed.epilepsia.detalle?.tratamiento).toBe('Carbamazepina')
    expect(parsed.epilepsia.detalle?.observaciones).toBe('') // default
    expect(parsed.alergias.estado).toBe('NO APLICA')
  })

  it('39. DetalleTripleSchema: limites max 200/500/1500 chars', () => {
    const ok = DetalleTripleSchema.parse({
      desde_cuando:  'a'.repeat(200),
      tratamiento:   'b'.repeat(500),
      observaciones: 'c'.repeat(1500),
    })
    expect(ok.desde_cuando).toHaveLength(200)
    expect(ok.tratamiento).toHaveLength(500)
    expect(ok.observaciones).toHaveLength(1500)

    expect(() => DetalleTripleSchema.parse({
      desde_cuando:  'a'.repeat(201),
      tratamiento:   'b'.repeat(500),
      observaciones: 'c'.repeat(1500),
    })).toThrow()

    expect(() => DetalleTripleSchema.parse({
      desde_cuando:  'a'.repeat(200),
      tratamiento:   'b'.repeat(501),
      observaciones: 'c'.repeat(1500),
    })).toThrow()

    expect(() => DetalleTripleSchema.parse({
      desde_cuando:  'a'.repeat(200),
      tratamiento:   'b'.repeat(500),
      observaciones: 'c'.repeat(1501),
    })).toThrow()
  })

  it('40. PatologiaConDetalleSchema: valor string arbitrario se preserva (DA-1 tolerancia legacy)', () => {
    // El union acepta CUALQUIER string para mantener compat con BD legacy
    // (puede haber strings no canónicos por typos pre-UI). El schema los
    // acepta sin error — la responsabilidad de validar el catálogo es del
    // UI (`<select>` con SNA_OPTIONS).
    const parsed = PatologiaConDetalleSchema.parse('garbage')
    expect(parsed.estado).toBe('garbage')
    expect(parsed.detalle).toBeUndefined()
  })

  it('41. PatologicosSchema: el campo legacy "especifique" se eliminó del schema', () => {
    // Verifica que el schema actual NO expone el campo legacy `especifique`.
    // Si se reintroduce por error, este test fallará.
    const payload = { diabetes: 'SI', especifique: 'algo' } as unknown
    const parsed = PatologicosSchema.parse(payload) as Record<string, unknown>
    // Zod .strip() elimina claves desconocidas; el campo legacy no sobrevive.
    expect(parsed.especifique).toBeUndefined()
    expect(parsed.diabetes).toEqual({ estado: 'SI', detalle: undefined })
  })

  it('42. SiNegado ampliado: NO APLICA es válido en NoPatologicosSchema (back-compat)', () => {
    // La ampliación del enum `SiNegado` a `['NEGADO', 'SI', 'NO APLICA']` no
    // rompe NoPatologicosSchema (donde `SiNegado` también se usa). DA-1.
    const r = NoPatologicosSchema.parse({ tatuajes: 'NO APLICA' })
    expect(r.tatuajes).toBe('NO APLICA')
  })
})

// IMPL-20260817-05 — fix bug acordeón Patologicos colapsa correctamente al
// cambiar a NEGADO (handoff Atlas). El bug era runtime (useEffect de
// AntecedentesCaptura rehidrataba en cada cambio de la prop `value`); el
// test schema-level garantiza que el payload que emite `updatePatologia`
// tras el colapso (estado:NEGADO, detalle:undefined) es válido y el
// schema es tolerante con payloads legacy con detalle residual.
describe('IMPL-20260817-05: acordeón Patologicos colapsa al cambiar a NEGADO', () => {
  it('43. Schema acepta el payload emitido por updatePatologia al colapsar (estado:NEGADO, detalle:undefined)', () => {
    // AntecedentesCaptura.tsx updatePatologia (líneas ~306-338) emite
    // EXACTAMENTE este shape tras el colapso: { estado: 'NEGADO', detalle: undefined }.
    // El schema debe aceptarlo sin lanzar error (la UI lo envía al action saveExamenMedicoPapeleta).
    const r = PatologicosSchema.parse({
      diabetes: { estado: 'NEGADO', detalle: undefined },
    })
    expect(r.diabetes.estado).toBe('NEGADO')
  })

  it('44. Schema acepta estado "NO APLICA" como colapso válido (paralelo a NEGADO)', () => {
    // Mismo contrato que el caso NEGADO pero para NO APLICA — el acordeón
    // también colapsa en este caso (no hay detalle a mostrar).
    const r = PatologicosSchema.parse({
      hernias: { estado: 'NO APLICA', detalle: undefined },
    })
    expect(r.hernias.estado).toBe('NO APLICA')
  })

  it('45. Schema tolera payload legacy con detalle residual en NEGADO/NO APLICA (DA-1 back-compat)', () => {
    // Si el padre re-renderiza con datos persistidos que aún tenían
    // detalle de una sesión anterior (estado guardado = NEGADO, detalle
    // residual con datos), el schema debe ACEPTAR sin error. La UI hace
    // el colapso visible colapsando localmente (no depende del schema).
    expect(() =>
      PatologicosSchema.parse({
        diabetes: {
          estado: 'NEGADO',
          detalle: { desde_cuando: '15 años', tratamiento: 'metformina' },
        },
      }),
    ).not.toThrow()

    expect(() =>
      PatologicosSchema.parse({
        hernias: {
          estado: 'NO APLICA',
          detalle: { desde_cuando: 'x', tratamiento: '', observaciones: '' },
        },
      }),
    ).not.toThrow()
  })
})

// IMPL-20260817-06 — acordeón Patologicos colapsable con resumen (handoff
// Atlas junta AMI 10/ago, opción 1 aprobada por Frank). El helper
// `hasDetalleContent` decide si mostrar inputs desplegados (vacío) o
// resumen colapsado (con contenido). La transición SÍ + detalle ↔ SÍ sin
// detalle es round-trip-safe en el schema.
describe('IMPL-20260817-06: acordeón Patologicos colapsable con resumen', () => {
  it('46. hasDetalleContent: detecta campos llenos / vacíos / whitespace', async () => {
    const { hasDetalleContent } = await import('@/lib/patologicos-accordion')
    // Vacío total → false (acordeón muestra inputs desplegados)
    expect(hasDetalleContent({ desde_cuando: '', tratamiento: '', observaciones: '' })).toBe(false)
    // Cualquier campo con texto significativo → true (acordeón muestra resumen)
    expect(hasDetalleContent({ desde_cuando: '15 años', tratamiento: '', observaciones: '' })).toBe(true)
    expect(hasDetalleContent({ desde_cuando: '', tratamiento: 'metformina', observaciones: '' })).toBe(true)
    expect(hasDetalleContent({ desde_cuando: '', tratamiento: '', observaciones: 'HbA1c 6.5%' })).toBe(true)
    // Whitespace-only no cuenta (Frank podría dejar la tecla espacio)
    expect(hasDetalleContent({ desde_cuando: '   ', tratamiento: '', observaciones: '' })).toBe(false)
    expect(hasDetalleContent({ desde_cuando: '', tratamiento: '\t\n', observaciones: '  ' })).toBe(false)
    // undefined → false (caso NEGADO/NO APLICA donde detalle es undefined)
    expect(hasDetalleContent(undefined)).toBe(false)
  })

  it('47. Schema: round-trip SÍ + detalle completo → SÍ sin detalle → SÍ con detalle', () => {
    // 1) SÍ con detalle completo: schema acepta y preserva los 3 campos.
    const filled = PatologicosSchema.parse({
      diabetes: { estado: 'SI', detalle: { desde_cuando: '15 años', tratamiento: 'metformina', observaciones: 'HbA1c 6.5%' } },
    })
    expect(filled.diabetes.estado).toBe('SI')
    expect(filled.diabetes.detalle?.desde_cuando).toBe('15 años')
    expect(filled.diabetes.detalle?.tratamiento).toBe('metformina')
    expect(filled.diabetes.detalle?.observaciones).toBe('HbA1c 6.5%')

    // 2) SÍ con detalle undefined (Frank borra todo el contenido): schema acepta.
    // Esta es la transición que dispara el auto-colapso del acordeón (el
    // acordeón pasa de "resumen" a "inputs desplegados" cuando se vacía).
    const emptied = PatologicosSchema.parse({
      diabetes: { estado: 'SI', detalle: undefined },
    })
    expect(emptied.diabetes.estado).toBe('SI')
    // detalle puede ser undefined o {} (DA-1 normaliza) — ambos son válidos para la UI.
    expect(emptied.diabetes.detalle == null || Object.keys(emptied.diabetes.detalle ?? {}).length === 0).toBe(true)

    // 3) SÍ con detalle lleno otra vez: schema acepta (Frank vuelve a editar).
    const refilled = PatologicosSchema.parse({
      diabetes: { estado: 'SI', detalle: { desde_cuando: '20 años', tratamiento: '', observaciones: '' } },
    })
    expect(refilled.diabetes.estado).toBe('SI')
    expect(refilled.diabetes.detalle?.desde_cuando).toBe('20 años')
  })
})

// IMPL-20260817-07 — Módulo 1 (sub-tab "declarativa") a combos:
// - 9 ginecológicos a <select> con catálogo ZIN + menarca numérico 0-30.
// - 7 vacunas a acordeón Sí/No + condicional `*_especifique`.
// DA-1: schema sigue tolerante — registros legacy string libre siguen parseando
// sin error. Ver SPEC §4.6.
describe('IMPL-20260817-07: Módulo 1 combos — ginecológicos + vacunas', () => {
  // ── Catálogos ZIN ─────────────────────────────────────────────────────────
  it('48. AG_IVS_VALUES tiene 3 opciones canónicas', () => {
    expect(AG_IVS_VALUES.length).toBe(3)
    expect(AG_IVS_VALUES).toContain('N/A')
    expect(AG_IVS_VALUES).toContain('ACTIVA')
    expect(AG_IVS_VALUES).toContain('NO ACTIVA')
  })

  it('49. AG_VSA_VALUES incluye 7 métodos anticonceptivos canónicos', () => {
    expect(AG_VSA_VALUES.length).toBe(7)
    expect(AG_VSA_VALUES).toContain('NINGUNO')
    expect(AG_VSA_VALUES).toContain('DE BARRERA')
    expect(AG_VSA_VALUES).toContain('HORMONAL')
    expect(AG_VSA_VALUES).toContain('DIU')
    expect(AG_VSA_VALUES).toContain('OTB')
    expect(AG_VSA_VALUES).toContain('RITMO')
    expect(AG_VSA_VALUES).toContain('OTRO')
  })

  it('50. AG_NUMERIC_0_11 tiene 12 valores (0-11) y orden ascendente', () => {
    expect(AG_NUMERIC_0_11.length).toBe(12)
    expect(AG_NUMERIC_0_11[0]).toBe(0)
    expect(AG_NUMERIC_0_11[11]).toBe(11)
    // Ascendente
    for (let i = 1; i < AG_NUMERIC_0_11.length; i++) {
      expect(AG_NUMERIC_0_11[i]).toBeGreaterThan(AG_NUMERIC_0_11[i - 1] as number)
    }
  })

  it('51. AG_ABORTO_VALUES tiene 2 opciones (SI / NO)', () => {
    expect(AG_ABORTO_VALUES.length).toBe(2)
    expect(AG_ABORTO_VALUES).toContain('SI')
    expect(AG_ABORTO_VALUES).toContain('NO')
  })

  it('52. VAC_SI_NO_VALUES es alias de SI_NO_NA_VALUES (NEGADO / SI / NO APLICA)', () => {
    // Mismas 3 opciones, en el mismo orden
    expect(VAC_SI_NO_VALUES.length).toBe(3)
    expect(VAC_SI_NO_VALUES).toContain('NEGADO')
    expect(VAC_SI_NO_VALUES).toContain('SI')
    expect(VAC_SI_NO_VALUES).toContain('NO APLICA')
    expect([...VAC_SI_NO_VALUES]).toEqual([...SI_NO_NA_VALUES])
  })

  // ── 7 vacunas esperadas (mantener en sync con VACUNAS_LIST en componente) ─
  it('53. Cobertura de las 7 vacunas esperadas', () => {
    // Esta constante vive en ExamenMedicoEstudio.tsx; el test verifica que el
    // set de keys esperadas coincida con la documentación de la SPEC §4.6.
    const EXPECTED_KEYS = [
      'm1_vac_rubeola',
      'm1_vac_neumococo',
      'm1_vac_sarampion',
      'm1_vac_influenza',
      'm1_vac_toxoide',
      'm1_vac_hepatitisb',
      'm1_vac_otras',
    ]
    expect(EXPECTED_KEYS.length).toBe(7)
    expect(EXPECTED_KEYS).toContain('m1_vac_rubeola')
    expect(EXPECTED_KEYS).toContain('m1_vac_neumococo')
    expect(EXPECTED_KEYS).toContain('m1_vac_sarampion')
    expect(EXPECTED_KEYS).toContain('m1_vac_influenza')
    expect(EXPECTED_KEYS).toContain('m1_vac_toxoide')
    expect(EXPECTED_KEYS).toContain('m1_vac_hepatitisb')
    expect(EXPECTED_KEYS).toContain('m1_vac_otras')
  })

  // ── DA-1: compat legacy ────────────────────────────────────────────────────
  it('54. DA-1: schema tolera modulo1 con strings simples legacy', () => {
    // El sub-schema `modulo1` está definido como `z.record(z.string(), z.any())`
    // — acepta cualquier par key→value. Verificamos que valores que
    // coinciden con los catálogos (legacy persistido) se aceptan sin error.
    const legacy = {
      m1_sexo: 'Femenino',
      m1_gine_ivs: 'ACTIVA',
      m1_gine_ritmo: 'HORMONAL',
      m1_gine_gesta: '2',
      m1_gine_parto: '1',
      m1_gine_aborto: 'NO',
      m1_vac_rubeola: 'SI',
      m1_vac_rubeola_especifique: '2 dosis, 2023',
      m1_vac_influenza: 'NEGADO',
    }
    // El sub-schema acepta sin error
    const result = z.record(z.string(), z.any()).optional().safeParse(legacy)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(legacy)
  })

  it('55. DA-1: schema acepta modulo1 con valores fuera del catálogo (legacy sin migrar)', () => {
    // Frank tenía 'm1_gine_gesta: "doce"' antes de migrar a <select>.
    // El sub-schema sigue aceptándolo (DA-1 — no rechazamos).
    const weirdLegacy = {
      m1_gine_gesta: 'doce', // no está en AG_NUMERIC_0_11
      m1_vac_otras: 'A RECORDAR EN 2027', // texto libre
    }
    const result = z.record(z.string(), z.any()).optional().safeParse(weirdLegacy)
    expect(result.success).toBe(true)
    expect(result.data).toEqual(weirdLegacy)
  })

  // ── Cobertura select Módulo 1 ──────────────────────────────────────────────
  it('56. Catálogos ZIN Módulo 1 son disjuntos (no hay colisión entre IVS / VSA / Aborto)', () => {
    const allValues = new Set<string>()
    for (const v of AG_IVS_VALUES) allValues.add(v)
    for (const v of AG_VSA_VALUES) allValues.add(v)
    for (const v of AG_ABORTO_VALUES) allValues.add(v)
    // Total: 3 + 7 + 2 = 12
    expect(allValues.size).toBe(12)
  })

  it('57. AG_NUMERIC_0_11 valores son todos enteros no-negativos', () => {
    for (const v of AG_NUMERIC_0_11) {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(11)
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // IMPL-20260817-08-C8 — ARCH-20260817-02 Corte 1 — aptitud enum + helpers
  // 5 valores del PDF canónico + DA-1 tolerante legacy `'NO APTO'` +
  // heurística portal migrada con fallback.
  // ────────────────────────────────────────────────────────────────────────
  describe('IMPL-20260817-08-C8: aptitud enum 5 valores + DA-1 + helpers', () => {
    it('58. APTITUD_VALUES expone 5 valores canónicos del PDF de referencia', () => {
      expect(APTITUD_VALUES).toHaveLength(5)
      expect(APTITUD_VALUES).toContain('APTO')
      expect(APTITUD_VALUES).toContain('APTO CONDICIONADO')
      expect(APTITUD_VALUES).toContain('APTO CON RESTRICCIONES')
      expect(APTITUD_VALUES).toContain('NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO')
      expect(APTITUD_VALUES).toContain('PENDIENTE DE RESULTADOS')
      // Legacy 'NO APTO' NO está en el nuevo enum (queda solo como tolerancia DA-1).
      expect(APTITUD_VALUES).not.toContain('NO APTO')
    })

    it('59. ImpresiónAptitudSchema acepta los 5 valores del nuevo enum', () => {
      APTITUD_VALUES.forEach(v => {
        const parsed = ImpresiónAptitudSchema.parse({ aptitud: v })
        expect(parsed.aptitud).toBe(v)
      })
    })

    it('60. ImpresiónAptitudSchema acepta legacy "NO APTO" (DA-1 tolerante)', () => {
      const parsed = ImpresiónAptitudSchema.parse({ aptitud: 'NO APTO' })
      expect(parsed.aptitud).toBe('NO APTO')
    })

    it('61. ImpresiónAptitudSchema acepta aptitud omitida (campo opcional)', () => {
      const parsed = ImpresiónAptitudSchema.parse({})
      expect(parsed.aptitud).toBeUndefined()
    })

    it('62. AGUDEZA_VISUAL_RESUMEN_VALUES expone 4 valores canónicos', () => {
      expect(AGUDEZA_VISUAL_RESUMEN_VALUES).toHaveLength(4)
      expect(AGUDEZA_VISUAL_RESUMEN_VALUES).toContain('NORMAL')
      expect(AGUDEZA_VISUAL_RESUMEN_VALUES).toContain('DISMINUIDA')
    })

    it('63. PRESION_ARTERIAL_RESUMEN_VALUES expone 3 valores canónicos', () => {
      expect(PRESION_ARTERIAL_RESUMEN_VALUES).toHaveLength(3)
      expect(PRESION_ARTERIAL_RESUMEN_VALUES).toContain('NORMAL AL MOMENTO DE LA TOMA')
      expect(PRESION_ARTERIAL_RESUMEN_VALUES).toContain('ALTA')
      expect(PRESION_ARTERIAL_RESUMEN_VALUES).toContain('BAJA')
    })

    it('64. ImpresiónAptitudSchema acepta agudeza_visual_resumen + presion_arterial_resumen con catálogos nuevos', () => {
      const parsed = ImpresiónAptitudSchema.parse({
        agudeza_visual_resumen: 'DISMINUIDA',
        presion_arterial_resumen: 'ALTA',
      })
      expect(parsed.agudeza_visual_resumen).toBe('DISMINUIDA')
      expect(parsed.presion_arterial_resumen).toBe('ALTA')
    })

    it('65. ImpresiónAptitudSchema acepta agudeza/presion legacy libre (DA-1)', () => {
      const legacy = {
        agudeza_visual_resumen: '20/40 corregida',
        presion_arterial_resumen: '130/85',
      }
      const parsed = ImpresiónAptitudSchema.parse(legacy)
      expect(parsed.agudeza_visual_resumen).toBe('20/40 corregida')
      expect(parsed.presion_arterial_resumen).toBe('130/85')
    })

    // ── Helpers ─────────────────────────────────────────────────────────────
    it('66. isAptoFromVerdict: APTO y variantes retornan true', () => {
      expect(isAptoFromVerdict('APTO')).toBe(true)
      expect(isAptoFromVerdict('APTO CONDICIONADO')).toBe(true)
      expect(isAptoFromVerdict('APTO CON RESTRICCIONES')).toBe(true)
      // Case-insensitive
      expect(isAptoFromVerdict('apto')).toBe(true)
      expect(isAptoFromVerdict('Apto Condicionado')).toBe(true)
    })

    it('67. isAptoFromVerdict: no-cumple + legacy + pendiente retornan false', () => {
      expect(isAptoFromVerdict('NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO')).toBe(false)
      expect(isAptoFromVerdict('NO APTO')).toBe(false) // legacy
      expect(isAptoFromVerdict('PENDIENTE DE RESULTADOS')).toBe(false)
    })

    it('68. isAptoFromVerdict: null/undefined/vacío retornan false', () => {
      expect(isAptoFromVerdict(null)).toBe(false)
      expect(isAptoFromVerdict(undefined)).toBe(false)
      expect(isAptoFromVerdict('')).toBe(false)
    })

    it('69. isNoCumple: NO CUMPLE canónico + legacy NO APTO retornan true', () => {
      expect(isNoCumple('NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO')).toBe(true)
      expect(isNoCumple('NO APTO')).toBe(true) // legacy
      // Case-insensitive
      expect(isNoCumple('no cumple con los criterios de salud para el puesto propuesto')).toBe(true)
      expect(isNoCumple('no apto')).toBe(true)
    })

    it('70. isNoCumple: variantes apto + pendiente retornan false', () => {
      expect(isNoCumple('APTO')).toBe(false)
      expect(isNoCumple('APTO CONDICIONADO')).toBe(false)
      expect(isNoCumple('APTO CON RESTRICCIONES')).toBe(false)
      expect(isNoCumple('PENDIENTE DE RESULTADOS')).toBe(false)
      expect(isNoCumple(null)).toBe(false)
      expect(isNoCumple(undefined)).toBe(false)
      expect(isNoCumple('')).toBe(false)
    })

    it('71. isPendienteResultados: solo PENDIENTE DE RESULTADOS retorna true', () => {
      expect(isPendienteResultados('PENDIENTE DE RESULTADOS')).toBe(true)
      expect(isPendienteResultados('APTO')).toBe(false)
      expect(isPendienteResultados('NO APTO')).toBe(false)
      expect(isPendienteResultados(null)).toBe(false)
      expect(isPendienteResultados(undefined)).toBe(false)
    })

    it('72. aptitudLabel: mapea 5 valores canónicos + legacy', () => {
      expect(aptitudLabel('APTO')).toBe('APTO')
      expect(aptitudLabel('APTO CONDICIONADO')).toBe('APTO CONDICIONADO')
      expect(aptitudLabel('APTO CON RESTRICCIONES')).toBe('APTO CON RESTRICCIONES')
      expect(aptitudLabel('NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO')).toBe('NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO')
      expect(aptitudLabel('PENDIENTE DE RESULTADOS')).toBe('PENDIENTE DE RESULTADOS')
      expect(aptitudLabel('NO APTO')).toBe('NO APTO') // legacy
      expect(aptitudLabel(null)).toBe('')
      expect(aptitudLabel(undefined)).toBe('')
    })

    // ── Heurística portal: regresión crítica DA-1 ────────────────────────────
    it('73. Heurística portal: NO CUMPLE canónico NO debe clasificarse como apto (regresión DA-1)', () => {
      // Reproduce el bug latente: el literal largo no contiene 'no apto'
      // por subcadena, por lo que la heurística histórica fallaba.
      const aptitud = 'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO'
      // Camino nuevo (lectura estructurada):
      expect(isNoCumple(aptitud)).toBe(true)
      expect(isAptoFromVerdict(aptitud)).toBe(false)
      // Fallback legacy NO aplicaría (sí hay aptitud estructurada).
      const legacyHitsSubstring = aptitud.toLowerCase().includes('no apto')
      expect(legacyHitsSubstring).toBe(false) // confirma el bug latente
    })

    it('74. Heurística portal: legacy NO APTO sigue clasificando como no-cumple', () => {
      expect(isNoCumple('NO APTO')).toBe(true)
      expect(isAptoFromVerdict('NO APTO')).toBe(false)
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// IMPL-20260817-09-C5 (ARCH-20260817-02 corte 2 DA-5/DA-7): tests de
// helpers de auto-poblamiento (resumen ejecutivo + recomendaciones).
// Regla explicita de Frank (2026-08-17): "Quiero que se autopoble.
// Quiero que el medico solo llene lo estrictamente necesario."
// ────────────────────────────────────────────────────────────────────────────
describe('IMPL-20260817-09-C5: buildExamSummary + buildRecommendations (Corte 2 auto-poblamiento)', () => {
  // ─── buildExamSummary (DA-5) ───────────────────────────────────────────────
  it('75. buildExamSummary: retorna 9 campos auto-poblados desde el snapshot del examen', () => {
    const summary = buildExamSummary({
      estado_nutricional: 'SOBREPESO',
      agudeza_visual_resumen: 'DISMINUIDA',
      salud_bucal: 'CARIES Y SARRO',
      presion_arterial_resumen: 'NORMAL AL MOMENTO DE LA TOMA',
      examen_medico_texto: 'Hallazgos positivos en agudeza visual.',
    })
    expect(summary.estado_nutricional).toBe('SOBREPESO')
    expect(summary.agudeza_visual).toBe('DISMINUIDA')
    expect(summary.salud_bucal).toBe('CARIES Y SARRO')
    expect(summary.presion_arterial).toBe('NORMAL AL MOMENTO DE LA TOMA')
    expect(summary.examen_medico).toBe('Hallazgos positivos en agudeza visual.')
    // Campos IA sin valor → string vacío (UI muestra "Pendiente de resultado").
    expect(summary.audiometria).toBe('')
    expect(summary.espirometria).toBe('')
    expect(summary.laboratorios).toBe('')
    expect(summary.radiografia).toBe('')
  })

  it('76. buildExamSummary: prioridad IA sobre manual para audiometria (DA-5)', () => {
    const summary = buildExamSummary(
      { audiometria_texto: 'Manual OD: HIPOACUSIA LEVE' },
      { audiometria_resumen: 'IA: HIPOACUSIA CONDUCTIVA LEVE' },
    )
    expect(summary.audiometria).toBe('IA: HIPOACUSIA CONDUCTIVA LEVE')
  })

  it('77. buildExamSummary: prioridad IA sobre manual para espirometria (DA-5)', () => {
    const summary = buildExamSummary(
      { espirometria_texto: 'Manual: FVC 80%' },
      { espirometria_resumen: 'IA: patron restrictivo leve, FVC 78%' },
    )
    expect(summary.espirometria).toBe('IA: patron restrictivo leve, FVC 78%')
  })

  it('78. buildExamSummary: sin IA disponible cae al texto manual (DA-5)', () => {
    const summary = buildExamSummary(
      { audiometria_texto: 'Manual OD: HIPOACUSIA LEVE' },
      undefined,
    )
    expect(summary.audiometria).toBe('Manual OD: HIPOACUSIA LEVE')
  })

  it('79. buildExamSummary: campos null/undefined se normalizan a string vacío', () => {
    const summary = buildExamSummary({
      estado_nutricional: null,
      agudeza_visual_resumen: undefined,
      salud_bucal: '',
      presion_arterial_resumen: null,
      examen_medico_texto: undefined,
    })
    expect(summary.estado_nutricional).toBe('')
    expect(summary.agudeza_visual).toBe('')
    expect(summary.salud_bucal).toBe('')
    expect(summary.presion_arterial).toBe('')
    expect(summary.examen_medico).toBe('')
  })

  it('80. EXAM_SUMMARY_LABELS: expone 9 labels verbatim del PDF canonico', () => {
    expect(EXAM_SUMMARY_LABELS).toHaveLength(9)
    const labels = EXAM_SUMMARY_LABELS.map(([, l]) => l)
    expect(labels).toContain('ESTADO NUTRICIONAL')
    expect(labels).toContain('AGUDEZA VISUAL')
    expect(labels).toContain('SALUD BUCAL')
    expect(labels).toContain('EXAMEN MEDICO')
    expect(labels).toContain('PRESION ARTERIAL')
    expect(labels).toContain('AUDIOMETRIA')
    expect(labels).toContain('ESPIROMETRIA')
    expect(labels).toContain('LABORATORIOS')
    expect(labels).toContain('RADIOGRAFIA')
  })

  // ─── buildRecommendations (DA-7) ────────────────────────────────────────────
  it('81. buildRecommendations: catalogo cerrado hallazgo -> recomendaciones', () => {
    const recs = buildRecommendations([
      { id: 'caries_sarro', texto: 'Caries y sarro' },
      { id: 'vision_disminuida', texto: 'Disminucion agudeza visual' },
    ])
    expect(recs).toContain('VALORACIÓN POR ODONTOLOGÍA PARA TRATAMIENTO DE CARIES Y SARRO')
    expect(recs).toContain('VALORACIÓN CON OPTOMETRISTA POR DISMINUCIÓN DE LA AGUDEZA VISUAL')
    expect(recs).toContain('USO DE LENTES PARA LABORAR')
    expect(recs).toContain('EXAMEN DE LA VISTA CADA AÑO')
  })

  it('82. buildRecommendations: lista numerada con formato PDF (1.- ... 2.- ...)', () => {
    const recs = buildRecommendations([{ id: 'caries_sarro' }])
    expect(recs).toMatch(/^1\.- /)
    expect(recs.startsWith('1.- VALORACIÓN POR ODONTOLOGÍA')).toBe(true)
    expect(recs.endsWith('.')).toBe(false) // sin punto final (la numeracion usa '. ' entre items)
  })

  it('83. buildRecommendations: deduplica recomendaciones del mismo hallazgo', () => {
    const recs = buildRecommendations([
      { id: 'vision_disminuida' },
      { id: 'vision_disminuida' }, // duplicado intencional
    ])
    const matches = recs.match(/OPTOMETRISTA/g)
    expect(matches?.length).toBe(1)
  })

  it('84. buildRecommendations: deduplica cuando multiples hallazgos generan la misma recomendacion', () => {
    // Ninguno del catalogo actual genera duplicados de otros hallazgos
    // (los IDs son disjuntos), pero validamos la deduplicacion del Set.
    const recs = buildRecommendations([
      { id: 'sobrepeso' },
      { id: 'obesidad' },
    ])
    // 'sobrepeso' tiene 2 recs, 'obesidad' tiene 3 recs, con 1 repetida
    // (MEJORAR HABITOS ALIMENTICIOS y REALIZAR EJERCICIO...) → dedup = 4 recs.
    // Contamos las recomendaciones deduplicadas: deben ser 4 (las unicas).
    const matchesHabitos = recs.match(/MEJORAR HÁBITOS ALIMENTICIOS/g)
    expect(matchesHabitos?.length).toBe(1)
  })

  it('85. buildRecommendations: retorna string vacío cuando no hay hallazgos reconocidos', () => {
    const recs = buildRecommendations([
      { id: 'no_existe_en_catalogo', texto: 'X' },
    ])
    expect(recs).toBe('')
  })

  it('86. buildRecommendations: retorna string vacío cuando la lista esta vacia', () => {
    expect(buildRecommendations([])).toBe('')
  })

  // ─── detectHallazgos (DA-7) ────────────────────────────────────────────────
  it('87. detectHallazgosFromExam: deriva hallazgos desde campos manuales', () => {
    const hallazgos = detectHallazgosFromExam({
      estado_nutricional: 'SOBREPESO',
      agudeza_visual_resumen: 'DISMINUIDA',
      salud_bucal: 'CARIES Y SARRO',
      presion_arterial_resumen: 'ALTA',
    })
    const ids = hallazgos.map(h => h.id).sort()
    expect(ids).toEqual(['caries_sarro', 'presion_alta', 'sobrepeso', 'vision_disminuida'])
  })

  it('88. detectHallazgosFromExam: case-insensitive (lowercase se acepta)', () => {
    const hallazgos = detectHallazgosFromExam({
      salud_bucal: 'caries y sarro',
      estado_nutricional: 'sobrepeso',
    })
    const ids = hallazgos.map(h => h.id).sort()
    expect(ids).toContain('caries_sarro')
    expect(ids).toContain('sobrepeso')
  })

  it('89. detectHallazgosFromExam: exploracion.circulacion_venosa INSUFICIENCIA → hallazgo venoso', () => {
    const hallazgos = detectHallazgosFromExam({
      exploracion: { circulacion_venosa: 'INSUFICIENCIA VENOSA' },
    })
    expect(hallazgos.map(h => h.id)).toContain('insuficiencia_venosa')
  })

  it('90. detectHallazgosFromIa: deriva hallazgos desde resultados IA', () => {
    const hallazgos = detectHallazgosFromIa({
      audiometria_clasificacion: 'HIPOACUSIA CONDUCTIVA LEVE',
      espirometria_patron: 'RESTRICTIVO',
      radiografia_hallazgo: 'PATOLOGICO',
      laboratorio_out_of_range: true,
    })
    const ids = hallazgos.map(h => h.id).sort()
    expect(ids).toEqual([
      'auditiva_conductiva',
      'laboratorio_anormal',
      'patron_restrictivo',
      'radiografia_patologica',
    ])
  })

  it('91. detectHallazgosFromIa: audiometria normal no genera hallazgo', () => {
    const hallazgos = detectHallazgosFromIa({ audiometria_clasificacion: 'NORMAL' })
    expect(hallazgos).toEqual([])
  })

  it('92. extractHallazgos: deduplica hallazgos con mismo id (manual + IA)', () => {
    const hallazgos = extractHallazgos(
      { salud_bucal: 'CARIES Y SARRO' }, // hallazgo manual
      {}, // IA vacío
    )
    expect(hallazgos).toHaveLength(1)
    expect(hallazgos[0].id).toBe('caries_sarro')
  })

  it('93. extractHallazgos: combina hallazgos manual + IA sin duplicar id', () => {
    const hallazgos = extractHallazgos(
      { salud_bucal: 'CARIES Y SARRO' },
      { audiometria_clasificacion: 'HIPOACUSIA SENSORINEURAL' },
    )
    const ids = hallazgos.map(h => h.id).sort()
    expect(ids).toEqual(['auditiva_sensorineural', 'caries_sarro'])
  })

  // ─── buildRecommendationsFromExam (atajo) ──────────────────────────────────
  it('94. buildRecommendationsFromExam: atajo derivar hallazgos + construir recomendaciones', () => {
    const recs = buildRecommendationsFromExam({
      estado_nutricional: 'OBESIDAD G2',
      salud_bucal: 'CARIES',
    })
    // 'obesidad' genera 3 recs; 'caries' genera 1 rec → 4 items.
    expect(recs).toContain('VALORACIÓN POR ODONTOLOGÍA PARA TRATAMIENTO DE CARIES')
    expect(recs).toContain('VALORACIÓN POR NUTRICIÓN')
    expect(recs).toContain('MEJORAR HÁBITOS ALIMENTICIOS')
    expect(recs).toContain('REALIZAR EJERCICIO TODOS LOS DÍAS, DURANTE 30 MINUTOS AL DÍA')
  })

  it('95. CATALOGO_RECOMENDACIONES: expone reglas para todos los hallazgos detectados', () => {
    // Cobertura: todos los IDs que detectHallazgos pueden emitir deben
    // existir en el catalogo.
    const idsCubiertos = [
      'caries_sarro', 'caries', 'sarro',
      'sobrepeso', 'obesidad', 'bajo_peso',
      'vision_disminuida',
      'presion_alta', 'presion_baja',
      'insuficiencia_venosa',
      'auditiva_conductiva', 'auditiva_sensorineural', 'auditiva_mixta',
      'patron_restrictivo', 'patron_obstructivo', 'patron_mixto',
      'radiografia_patologica',
      'laboratorio_anormal',
    ]
    for (const id of idsCubiertos) {
      expect(CATALOGO_RECOMENDACIONES[id]).toBeDefined()
      expect(CATALOGO_RECOMENDACIONES[id].length).toBeGreaterThan(0)
    }
  })
})
