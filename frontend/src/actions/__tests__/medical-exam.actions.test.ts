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
import { ExamenMedicoCompletoSchema, AntecedentesCapturaSchema } from '@/schemas/clinical/exam.schema'
import { DatosPersonalesModulo1Schema } from '@/schemas/clinical/history.schema'

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
