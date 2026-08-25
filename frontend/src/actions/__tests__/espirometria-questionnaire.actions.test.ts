/**
 * @file Tests focales (V1) para el server action del cuestionario de
 *   Espirometría (FEATURE-20260824-02).
 *
 * Cubre AC-3 (payload válido se persiste atómicamente en EventTest) y AC-4
 * (payload inválido es rechazado server-side con error visible).
 *
 * Aislamiento:
 *   - Mock de `@/lib/prisma` y `next/cache` (sin tocar la BD real).
 *   - `validateEspirometriaQuestionnairePayload` (helper puro) se prueba
 *     en aislamiento sin tocar Prisma. Vive en
 *     `frontend/src/lib/clinical/espirometria-questionnaire-validate.ts`
 *     (FIX-Vercel-Build 2026-08-25 — Next.js 16 rechaza exports síncronos
 *     en módulos `'use server'`; el helper se extrajo para desbloquear el
 *     build Vercel preservando la validación Zod intacta).
 *
 * @id IMPL-FEATURE-20260824-02
 * @backup context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mock state ─────────────────────────────────────────────────────────────
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

import { saveEspirometriaQuestionnaire } from '../espirometria-questionnaire.actions'
import { validateEspirometriaQuestionnairePayload } from '@/lib/clinical/espirometria-questionnaire-validate'
import { ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION } from '@/schemas/clinical/espirometria-questionnaire.schema'

const VALID_PAYLOAD = {
  schemaVersion: ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  capturedAt: '2026-08-24T12:00:00.000Z',
  antecedentes: { embarazo: 'NO_APLICA' },
  exploracionFisica: {
    vias_respiratorias_superiores: { estado: 'NORMAL' },
    torax: { estado: 'NORMAL' },
    pulmones: { estado: 'NORMAL' },
  },
}

beforeEach(() => {
  mockFindUnique.mockReset()
  mockUpdate.mockReset()
  mockRevalidatePath.mockReset()
})

describe('validateEspirometriaQuestionnairePayload (helper puro)', () => {
  it('acepta payload válido', () => {
    const result = validateEspirometriaQuestionnairePayload(VALID_PAYLOAD)
    expect(result.valid).toBe(true)
  })

  it('rechaza payload inválido con fieldErrors estructurados', () => {
    const result = validateEspirometriaQuestionnairePayload({
      ...VALID_PAYLOAD,
      schemaVersion: 'wrong-version',
    })
    expect(result.valid).toBe(false)
    if (result.valid === false) {
      expect(result.fieldErrors['schemaVersion']).toBeDefined()
    }
  })
})

describe('saveEspirometriaQuestionnaire — payload inválido (AC-4)', () => {
  it('rechaza sin tocar Prisma cuando el payload es inválido', async () => {
    const res = await saveEspirometriaQuestionnaire(
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
    const res = await saveEspirometriaQuestionnaire('', VALID_PAYLOAD, 'ev-1')
    expect(res.success).toBe(false)
  })
})

describe('saveEspirometriaQuestionnaire — payload válido (AC-3)', () => {
  it('persiste atómicamente cuando el EventTest pertenece al evento', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'et-1',
      eventId: 'ev-1',
    })
    mockUpdate.mockResolvedValue({
      id: 'et-1',
      updatedAt: new Date('2026-08-24T13:00:00.000Z'),
    })

    const res = await saveEspirometriaQuestionnaire(
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

    const res = await saveEspirometriaQuestionnaire(
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
    const res = await saveEspirometriaQuestionnaire(
      'et-fake',
      VALID_PAYLOAD,
      'ev-1',
    )
    expect(res.success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
