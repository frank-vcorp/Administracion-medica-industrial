/**
 * @file Tests focales (V1) para el server action del cuestionario de
 *   Audiometría (FEATURE-20260825-02).
 *
 * Mismo patrón que el test del cuestionario de Espirometría:
 *   - Mock de `@/lib/prisma` y `next/cache` (sin tocar la BD real).
 *   - `validateAudiometriaQuestionnairePayload` (helper puro) se prueba
 *     en aislamiento.
 *   - Cubre AC-1/AC-4: payload válido persiste atómicamente; payload
 *     inválido es rechazado server-side con fieldErrors estructurados.
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    eventTest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

import { saveAudiometriaQuestionnaire } from '../audiometria-questionnaire.actions'
import { validateAudiometriaQuestionnairePayload } from '@/lib/clinical/audiometria-questionnaire-validate'
import { AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION } from '@/schemas/clinical/audiometria-questionnaire.schema'

const VALID_PAYLOAD = {
  schemaVersion: AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  capturedAt: '2026-08-25T14:00:00.000Z',
  // DEC-20260825-08 / BR-20260825-09: el payload guarda SÓLO
  // antecedentes, exploración física y observaciones clínicas — los
  // campos administrativos (patientId, consentimiento,
  // responsableCaptura, responsableMedico) fueron RETIRADOS.
  antecedentes: {
    audiometria_previa: 'NO' as const,
    exposicion_ruido_laboral: 'NO' as const,
  },
  exploracionFisica: {
    faringe: { estado: 'NORMAL' as const },
    cad: { estado: 'NORMAL' as const },
    cai: { estado: 'NORMAL' as const },
    mtd: { estado: 'NORMAL' as const },
    mti: { estado: 'NORMAL' as const },
  },
}

beforeEach(() => {
  mockFindUnique.mockReset()
  mockUpdate.mockReset()
  mockRevalidatePath.mockReset()
})

describe('validateAudiometriaQuestionnairePayload (helper puro)', () => {
  it('acepta payload válido', () => {
    const result = validateAudiometriaQuestionnairePayload(VALID_PAYLOAD)
    expect(result.valid).toBe(true)
  })

  it('rechaza payload inválido con fieldErrors estructurados', () => {
    const result = validateAudiometriaQuestionnairePayload({
      ...VALID_PAYLOAD,
      schemaVersion: 'wrong-version',
    })
    expect(result.valid).toBe(false)
    if (result.valid === false) {
      expect(result.fieldErrors['schemaVersion']).toBeDefined()
    }
  })
})

describe('saveAudiometriaQuestionnaire — payload inválido (AC-4)', () => {
  it('rechaza sin tocar Prisma cuando el payload es inválido', async () => {
    const res = await saveAudiometriaQuestionnaire(
      'et-1',
      { ...VALID_PAYLOAD, schemaVersion: 'wrong' },
      'ev-1',
    )
    expect(res.success).toBe(false)
    if (res.success === false) {
      expect(res.fieldErrors).toBeDefined()
      expect(res.error.length).toBeGreaterThan(0)
    }
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('rechaza cuando faltan eventTestId o eventId', async () => {
    const res = await saveAudiometriaQuestionnaire('', VALID_PAYLOAD, 'ev-1')
    expect(res.success).toBe(false)
    const res2 = await saveAudiometriaQuestionnaire('et-1', VALID_PAYLOAD, '')
    expect(res2.success).toBe(false)
  })
})

describe('saveAudiometriaQuestionnaire — payload válido (AC-1)', () => {
  it('persiste atómicamente cuando el EventTest pertenece al evento', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'et-1',
      eventId: 'ev-1',
    })
    mockUpdate.mockResolvedValue({
      id: 'et-1',
      updatedAt: new Date('2026-08-25T14:30:00.000Z'),
    })

    const res = await saveAudiometriaQuestionnaire(
      'et-1',
      VALID_PAYLOAD,
      'ev-1',
    )

    expect(res.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: 'et-1' })
    expect(updateArg.data.clinicalContext).toEqual(VALID_PAYLOAD)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events/ev-1')
  })

  it('rechaza si el EventTest pertenece a otro evento (defensa contra IDs cruzados)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'et-1',
      eventId: 'ev-OTRO',
    })

    const res = await saveAudiometriaQuestionnaire(
      'et-1',
      VALID_PAYLOAD,
      'ev-1',
    )
    expect(res.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('rechaza cuando el EventTest no existe', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await saveAudiometriaQuestionnaire(
      'et-fake',
      VALID_PAYLOAD,
      'ev-1',
    )
    expect(res.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})