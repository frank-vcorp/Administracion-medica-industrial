/**
 * @file Tests para saveAntecedentesCaptura — IMPL-20260809-01.
 * Cubre: validación Zod, auth, ownership check, merge no destructivo sobre
 * physicalExamData y manejo de `physicalExamData` nulo.
 * @id IMPL-20260809-01
 * @spec context/SPECs/SPEC_ARCH-20260809-01-ANTECEDENTES-OUTER-TAB-EXAMEN-MEDICO.md
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ExamenMedicoCompletoSchema, AntecedentesCapturaSchema } from '@/schemas/clinical/exam.schema'
import { DatosPersonalesModulo1Schema } from '@/schemas/clinical/history.schema'

const mockEventFindUnique = vi.fn()
const mockMedicalExamFindUnique = vi.fn()
const mockMedicalExamUpsert = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))
vi.mock('@/auth', () => ({
  authOptions: {},
}))
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    medicalEvent: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    },
    medicalExam: {
      findUnique: (...args: unknown[]) => mockMedicalExamFindUnique(...args),
      upsert: (...args: unknown[]) => mockMedicalExamUpsert(...args),
    },
  },
}))

import { getServerSession } from 'next-auth/next'
import { saveAntecedentesCaptura } from '@/actions/medical-exam.actions'

const VALID_SESSION = {
  user: { id: 'doc-1', role: 'DOCTOR_GENERAL', email: 'd@x', name: 'Doc' },
  expires: '2099-12-31',
}

const baseAntecedentes = {
  datos_personales: { puesto_actual: 'Soldador' },
  historia_laboral: { empresa_anterior_1: 'Acme' },
  heredo_familiares: { diabetes: 'PADRE' },
  no_patologicos: { alcohol: 'NEGADO' as const, tabaco: 'NEGADO' as const },
  patologicos: { diabetes: 'NEGADO' as const },
}

describe('medical-exam.actions saveAntecedentesCaptura', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(
      VALID_SESSION as unknown as Awaited<ReturnType<typeof getServerSession>>,
    )
    mockEventFindUnique.mockResolvedValue({ id: 'evt-1', workerId: 'w-1' })
    mockMedicalExamFindUnique.mockResolvedValue(null) // physicalExamData null
    mockMedicalExamUpsert.mockResolvedValue({ id: 'me-1', eventId: 'evt-1' })
  })

  it('1. eventId vacío → error sin llamar a Prisma', async () => {
    const res = await saveAntecedentesCaptura('', baseAntecedentes)
    expect(res.success).toBe(false)
    expect(res.error).toBe('eventId es obligatorio')
    expect(mockEventFindUnique).not.toHaveBeenCalled()
    expect(mockMedicalExamUpsert).not.toHaveBeenCalled()
  })

  it('2. sin sesión → error "No autorizado"', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await saveAntecedentesCaptura('evt-1', baseAntecedentes)
    expect(res.success).toBe(false)
    expect(res.error).toBe('No autorizado')
    expect(mockEventFindUnique).not.toHaveBeenCalled()
  })

  it('3. evento no existe → error "Evento no encontrado" (ownership check)', async () => {
    mockEventFindUnique.mockResolvedValue(null)
    const res = await saveAntecedentesCaptura('evt-bad', baseAntecedentes)
    expect(res.success).toBe(false)
    expect(res.error).toBe('Evento no encontrado')
    expect(mockMedicalExamUpsert).not.toHaveBeenCalled()
  })

  it('4. payload vacío (sin secciones) → Zod acepta y crea snapshot', async () => {
    const res = await saveAntecedentesCaptura('evt-1', {})
    expect(res.success).toBe(true)
    expect(mockMedicalExamUpsert).toHaveBeenCalledTimes(1)
    const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
    expect(upsertArg.where).toEqual({ eventId: 'evt-1' })
    expect(upsertArg.create.physicalExamData.antecedentes_captured).toBeDefined()
    expect(upsertArg.create.physicalExamData.antecedentes_captured._provenance.source).toBe('captured')
  })

  it('5. payload inválido (enum NEGADO fuera de spec) → Zod rechaza', async () => {
    const bad = {
      patologicos: { diabetes: 'TALVEZ' }, // valor no permitido
    }
    const res = await saveAntecedentesCaptura('evt-1', bad)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/inválidos|error de servidor/)
    expect(mockMedicalExamUpsert).not.toHaveBeenCalled()
  })

  it('6. physicalExamData existente → MERGE no destructivo (preserva otros campos)', async () => {
    const existingPhysical = {
      antecedentes_medico: 'nota del médico previa',
      aptitud: 'APTO',
      modulo1: { m1_sexo: 'Femenino' },
    }
    mockMedicalExamFindUnique.mockResolvedValue({
      physicalExamData: existingPhysical,
    })

    const res = await saveAntecedentesCaptura('evt-1', baseAntecedentes)
    expect(res.success).toBe(true)

    const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
    const merged = upsertArg.update.physicalExamData

    // Merge no destructivo: los campos previos deben persistir
    expect(merged.antecedentes_medico).toBe('nota del médico previa')
    expect(merged.aptitud).toBe('APTO')
    expect(merged.modulo1).toEqual({ m1_sexo: 'Femenino' })

    // El nuevo snapshot debe estar presente
    expect(merged.antecedentes_captured).toBeDefined()
    expect(merged.antecedentes_captured.datos_personales.puesto_actual).toBe('Soldador')
    expect(merged.antecedentes_captured._provenance.source).toBe('captured')
    expect(typeof merged.antecedentes_captured._provenance.updatedAt).toBe('string')
  })

  it('7. physicalExamData null → crea snapshot nuevo sin perder otros datos', async () => {
    mockMedicalExamFindUnique.mockResolvedValue(null)

    const res = await saveAntecedentesCaptura('evt-1', baseAntecedentes)
    expect(res.success).toBe(true)

    const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
    const merged = upsertArg.update.physicalExamData

    // Sin physicalExamData previo, solo debe estar antecedentes_captured
    expect(merged.antecedentes_captured.datos_personales.puesto_actual).toBe('Soldador')
    expect(merged.antecedentes_captured._provenance.capturedBy).toBe('doc-1')
  })

  it('8. physicalExamData es array (caso degenerado) → fallback a {}', async () => {
    mockMedicalExamFindUnique.mockResolvedValue({
      physicalExamData: ['no-es-objeto'] as unknown as object,
    })
    const res = await saveAntecedentesCaptura('evt-1', baseAntecedentes)
    expect(res.success).toBe(true)

    const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
    // El array NO se mezcla; se reemplaza por { antecedentes_captured: ... }
    expect(Array.isArray(upsertArg.update.physicalExamData)).toBe(false)
    expect(upsertArg.update.physicalExamData.antecedentes_captured).toBeDefined()
  })

  it('9. llama a revalidatePath("/events/evt-1") tras guardado exitoso', async () => {
    await saveAntecedentesCaptura('evt-1', baseAntecedentes)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events/evt-1')
  })

  it('10. Prisma throw → captura y devuelve error genérico', async () => {
    mockMedicalExamUpsert.mockRejectedValue(new Error('DB connection lost'))
    const res = await saveAntecedentesCaptura('evt-1', baseAntecedentes)
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/inválidos|error de servidor/)
  })

  it('11. compat retroactiva: payload sin _provenance → action inyecta proveniencia', async () => {
    const withoutProvenance = { datos_personales: { puesto_actual: 'X' } }
    const res = await saveAntecedentesCaptura('evt-1', withoutProvenance)
    expect(res.success).toBe(true)
    const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
    // El action siempre inyecta _provenance en el merge
    expect(upsertArg.update.physicalExamData.antecedentes_captured._provenance.source).toBe('captured')
  })

  it('12. payload permite campos de exposición booleanos', async () => {
    const withBooleans = {
      historia_laboral: {
        exposicion_quimica: true,
        exposicion_quimica_especifique: 'plomo',
        empresa_anterior_1: 'X',
      },
    }
    const res = await saveAntecedentesCaptura('evt-1', withBooleans)
    expect(res.success).toBe(true)
    const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
    expect(upsertArg.update.physicalExamData.antecedentes_captured.historia_laboral.exposicion_quimica).toBe(true)
  })

  // ─── IMPL-20260809-01 rework (QA-20260809-01 I-1): regresión ──────────────
  // El bug original: `buildPayload()` serializaba `antecedentes_captured`
  // (objeto) como `String({...})` = "[object Object]" y rompía Zod.
  // Defensa en profundidad: el schema debe aceptar el objeto válido Y
  // rechazar cualquier serialización incorrecta.
  it('13. (I-1) ExamenMedicoCompletoSchema acepta antecedentes_captured como objeto válido', () => {
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

  it('14. (I-1) ExamenMedicoCompletoSchema RECHAZA antecedentes_captured serializado como string', () => {
    // Defensa en profundidad: si por algún motivo buildPayload() filtrara
    // antecedentes_captured como string, el schema debe rechazarlo.
    const buggyPayload = {
      antecedentes_captured: '[object Object]' as unknown as Record<string, unknown>,
    }
    expect(() => ExamenMedicoCompletoSchema.parse(buggyPayload)).toThrow()
  })

  it('15. (I-1) ExamenMedicoCompletoSchema acepta payload sin antecedentes_captured (compat retroactiva)', () => {
    // Exámenes médicos pre-ARCH-20260809-01 NO tienen `antecedentes_captured`.
    const legacyPayload = { neurologico: 'normal', aptitud: 'APTO' }
    expect(() => ExamenMedicoCompletoSchema.parse(legacyPayload)).not.toThrow()
  })

  // ─── IMPL-20260809-01 rework (QA-20260809-01 I-2): edge case ──────────────
  // El bug original: el cliente mandaba `turno: ''` y `estado_civil: ''` al
  // action cuando el paciente no había llenado nada. `DatosPersonalesModulo1Schema`
  // define esos campos como `z.enum(...).optional()` (solo `undefined` o
  // literal del enum). Fix: el cliente filtra `''` antes de enviar.
  it('16. (I-2) AntecedentesCapturaSchema acepta turno/estado_civil = undefined (post-normalización cliente)', () => {
    const normalized = {
      datos_personales: { puesto_actual: 'Soldador', turno: undefined, estado_civil: undefined },
    }
    expect(() => AntecedentesCapturaSchema.parse(normalized)).not.toThrow()
    // También a nivel del sub-schema DatosPersonalesModulo1Schema:
    expect(() =>
      DatosPersonalesModulo1Schema.parse({ turno: undefined, estado_civil: undefined }),
    ).not.toThrow()
  })

  it('17. (I-2) defensa en profundidad: schema RECHAZA turno: "" si llegara al action', () => {
    // Si el cliente no normalizara, el server-side debe rechazar.
    expect(() => DatosPersonalesModulo1Schema.parse({ turno: '' })).toThrow()
    expect(() => DatosPersonalesModulo1Schema.parse({ estado_civil: '' })).toThrow()
    // Y a nivel de AntecedentesCapturaSchema:
    expect(() => AntecedentesCapturaSchema.parse({ datos_personales: { turno: '' } })).toThrow()
  })

  it('18. (I-2) action saveAntecedentesCaptura acepta payload con turno/estado_civil = undefined', async () => {
    // Simula el caso "post-normalización cliente" del fix I-2.
    const normalizedPayload = {
      datos_personales: { puesto_actual: 'Soldador', turno: undefined, estado_civil: undefined },
      historia_laboral: {},
      heredo_familiares: {},
      no_patologicos: { alcohol: 'NEGADO' as const, tabaco: 'NEGADO' as const },
      patologicos: { diabetes: 'NEGADO' as const },
    }
    const res = await saveAntecedentesCaptura('evt-1', normalizedPayload)
    expect(res.success).toBe(true)
    const upsertArg = mockMedicalExamUpsert.mock.calls[0][0]
    expect(upsertArg.update.physicalExamData.antecedentes_captured.datos_personales.puesto_actual).toBe('Soldador')
    // turno y estado_civil deben haber sido omitidos (no "").
    expect(upsertArg.update.physicalExamData.antecedentes_captured.datos_personales.turno).toBeUndefined()
    expect(upsertArg.update.physicalExamData.antecedentes_captured.datos_personales.estado_civil).toBeUndefined()
  })
})
