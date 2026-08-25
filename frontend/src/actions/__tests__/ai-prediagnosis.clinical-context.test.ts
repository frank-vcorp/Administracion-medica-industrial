/**
 * @file Tests focales (V1) para el reenvío de `clinical_context` al backend
 *   IA desde `triggerStudyAIAnalysis` (IMPL-FEATURE-20260824-02 gap fix).
 *
 * Cobertura:
 *   - Payload ausente → NO se adjunta `clinical_context` al FormData del
 *     backend (compat con FEATURE-20260824-02 AC-6).
 *   - Payload presente y válido → se reenvía como JSON string serializado.
 *   - Payload presente pero no parsea / no es objeto → se omite (no rompe
 *     el upload; log warn sin PII).
 *   - Payload con schemaVersion distinta a la esperada → se omite
 *     (defensa contra prompt injection / versiones desconocidas).
 *   - Payload que no cumple el Zod schema (datos inválidos) → se omite.
 *   - Audit del snapshot: `clinical_context_schema_version` se incluye
 *     en extraction.audit y prediagnosis.audit cuando el contexto fue
 *     reenviado.
 *
 * Aislamiento:
 *   - Mock de `fetch` para capturar el FormData que llega al backend.
 *   - Mock de Prisma y `next/cache` (no se toca BD).
 *
 * @id IMPL-FEATURE-20260824-02
 * @backup context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ─── Mock state ─────────────────────────────────────────────────────────────
const mockEventTestFindUnique = vi.fn()
const mockStudyExtractionSnapshotFindMany = vi.fn().mockResolvedValue([])
const mockStudyExtractionSnapshotCreate = vi.fn()
const mockStudyExtractionSnapshotCount = vi.fn().mockResolvedValue(0)
const mockStudyExtractionSnapshotUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
const mockAIPrediagnosisSnapshotCreate = vi.fn()
const mockAIPrediagnosisSnapshotUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
const mockEventTestUpdate = vi.fn().mockResolvedValue({})
const mockRevalidatePath = vi.fn()
const mockFetch = vi.fn()

const txMock = {
  studyExtractionSnapshot: {
    findMany: (...a: unknown[]) => mockStudyExtractionSnapshotFindMany(...a),
    create: (...a: unknown[]) => mockStudyExtractionSnapshotCreate(...a),
    updateMany: (...a: unknown[]) => mockStudyExtractionSnapshotUpdateMany(...a),
  },
  aIPrediagnosisSnapshot: {
    create: (...a: unknown[]) => mockAIPrediagnosisSnapshotCreate(...a),
    updateMany: (...a: unknown[]) => mockAIPrediagnosisSnapshotUpdateMany(...a),
  },
  eventTest: {
    update: (...a: unknown[]) => mockEventTestUpdate(...a),
  },
}

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    eventTest: {
      findUnique: (...args: unknown[]) => mockEventTestFindUnique(...args),
      update: (...args: unknown[]) => mockEventTestUpdate(...args),
    },
    studyExtractionSnapshot: {
      count: (...a: unknown[]) => mockStudyExtractionSnapshotCount(...a),
      findMany: (...a: unknown[]) => mockStudyExtractionSnapshotFindMany(...a),
      create: (...a: unknown[]) => mockStudyExtractionSnapshotCreate(...a),
      updateMany: (...a: unknown[]) => mockStudyExtractionSnapshotUpdateMany(...a),
    },
    aIPrediagnosisSnapshot: {
      create: (...a: unknown[]) => mockAIPrediagnosisSnapshotCreate(...a),
      updateMany: (...a: unknown[]) => mockAIPrediagnosisSnapshotUpdateMany(...a),
    },
    $transaction: async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock),
  },
}))
vi.mock('@/actions/calibration-v3.actions', () => ({
  getPublishedCalibrationForEventTest: vi.fn().mockResolvedValue(null),
  getPublishedVersionForSnapshot: vi.fn().mockResolvedValue(null),
}))

// fetch global mock (Next.js / Node 18+)
;(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch

import { triggerStudyAIAnalysis } from '../ai-prediagnosis.actions'
import { ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION } from '@/schemas/clinical/espirometria-questionnaire.schema'

const VALID_EXTRACTION_PAYLOAD = {
  study_type: 'Espirometria',
  extracted_data: { fev1: 3.5, fvc: 4.2 },
  missing_fields: [],
}
const VALID_PREDIAGNOSIS_PAYLOAD = {
  clinical_state: 'AI_PENDING_REVIEW',
  summary: 'Prediagnóstico IA de prueba.',
  confidence: 0.7,
  audit: { model_name: 'test-model' },
}
const BACKEND_OK_RESPONSE = {
  status: 'success',
  file: 'test.pdf',
  file_url: '/uploads/test.pdf',
  classification: { detected_type: 'Espirometria' },
  extraction_snapshot: VALID_EXTRACTION_PAYLOAD,
  prediagnosis_snapshot: VALID_PREDIAGNOSIS_PAYLOAD,
}

const VALID_ESPIRO_CONTEXT = {
  schemaVersion: ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  capturedAt: '2026-08-24T12:00:00.000Z',
  antecedentes: {
    fuma_o_fumo: 'NO' as const,
    embarazo: 'NO_APLICA' as const,
  },
  exploracionFisica: {
    vias_respiratorias_superiores: { estado: 'NORMAL' as const },
    torax: { estado: 'NORMAL' as const },
    pulmones: { estado: 'NORMAL' as const },
  },
}

function buildFormData(overrides: {
  clinical_context?: string | null
} = {}): FormData {
  const fd = new FormData()
  fd.set('eventTestId', 'et-1')
  fd.set('eventId', 'ev-1')
  fd.set('triggeredByUserId', 'user-1')
  fd.set('file', new File(['dummy'], 'sample.pdf', { type: 'application/pdf' }))
  fd.set('study_type', 'Espirometria')
  if (overrides.clinical_context !== null && overrides.clinical_context !== undefined) {
    fd.set('clinical_context', overrides.clinical_context)
  }
  return fd
}

function getUploadFormFromFetchCall(): FormData {
  expect(mockFetch).toHaveBeenCalledTimes(1)
  const callArgs = mockFetch.mock.calls[0]
  const init = callArgs[1] as RequestInit
  const body = init.body as FormData
  expect(body).toBeInstanceOf(FormData)
  return body
}

beforeEach(() => {
  mockEventTestFindUnique.mockReset()
  mockStudyExtractionSnapshotFindMany.mockReset()
  mockStudyExtractionSnapshotFindMany.mockResolvedValue([])
  mockStudyExtractionSnapshotCreate.mockReset()
  mockStudyExtractionSnapshotCreate.mockResolvedValue({ id: 'ext-snap-1', version: 1 })
  mockStudyExtractionSnapshotCount.mockReset()
  mockStudyExtractionSnapshotCount.mockResolvedValue(0)
  mockStudyExtractionSnapshotUpdateMany.mockReset()
  mockAIPrediagnosisSnapshotCreate.mockReset()
  mockAIPrediagnosisSnapshotCreate.mockResolvedValue({ id: 'predx-snap-1' })
  mockAIPrediagnosisSnapshotUpdateMany.mockReset()
  mockEventTestUpdate.mockReset()
  mockRevalidatePath.mockReset()
  mockFetch.mockReset()

  // Default Prisma fixture: EventTest con `test.options = null`.
  mockEventTestFindUnique.mockResolvedValue({ test: { options: null } })
  // fetch OK por defecto.
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(BACKEND_OK_RESPONSE),
    json: async () => BACKEND_OK_RESPONSE,
  } as unknown as Response)
})

// ─── Reenvío del clinical_context ───────────────────────────────────────────

describe('triggerStudyAIAnalysis — reenvío de clinical_context (gap fix)', () => {
  it('payload ausente → NO se adjunta `clinical_context` al FormData del backend (AC-6)', async () => {
    const fd = buildFormData()
    const res = await triggerStudyAIAnalysis(fd)
    expect(res.success).toBe(true)
    const body = getUploadFormFromFetchCall()
    expect(body.has('clinical_context')).toBe(false)
  })

  it('payload presente y válido → se reenvía como JSON string serializado', async () => {
    const fd = buildFormData({
      clinical_context: JSON.stringify(VALID_ESPIRO_CONTEXT),
    })
    const res = await triggerStudyAIAnalysis(fd)
    expect(res.success).toBe(true)
    const body = getUploadFormFromFetchCall()
    expect(body.has('clinical_context')).toBe(true)
    const forwarded = body.get('clinical_context') as string
    // El backend recibe el JSON re-serializado (mismo shape que el original
    // tras pasar por Zod).
    const parsed = JSON.parse(forwarded)
    expect(parsed.schemaVersion).toBe(ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION)
    expect(parsed.antecedentes.fuma_o_fumo).toBe('NO')
  })

  it('payload presente pero no parsea como JSON → se omite sin romper el upload', async () => {
    const fd = buildFormData({ clinical_context: 'not-json-{' })
    const res = await triggerStudyAIAnalysis(fd)
    expect(res.success).toBe(true)
    const body = getUploadFormFromFetchCall()
    expect(body.has('clinical_context')).toBe(false)
  })

  it('payload presente pero no es objeto (es array) → se omite', async () => {
    const fd = buildFormData({ clinical_context: JSON.stringify([1, 2, 3]) })
    const res = await triggerStudyAIAnalysis(fd)
    expect(res.success).toBe(true)
    const body = getUploadFormFromFetchCall()
    expect(body.has('clinical_context')).toBe(false)
  })

  it('payload presente con schemaVersion futura → se omite (defensa)', async () => {
    const fd = buildFormData({
      clinical_context: JSON.stringify({
        ...VALID_ESPIRO_CONTEXT,
        schemaVersion: 'espirometria-questionnaire-v99',
      }),
    })
    const res = await triggerStudyAIAnalysis(fd)
    expect(res.success).toBe(true)
    const body = getUploadFormFromFetchCall()
    expect(body.has('clinical_context')).toBe(false)
  })

  it('payload presente pero que NO cumple el Zod schema → se omite', async () => {
    // espirometria_previa=SI sin rango => falla el superRefine.
    const invalid = {
      ...VALID_ESPIRO_CONTEXT,
      antecedentes: {
        ...VALID_ESPIRO_CONTEXT.antecedentes,
        espirometria_previa: 'SI' as const,
      },
    }
    const fd = buildFormData({ clinical_context: JSON.stringify(invalid) })
    const res = await triggerStudyAIAnalysis(fd)
    expect(res.success).toBe(true)
    const body = getUploadFormFromFetchCall()
    expect(body.has('clinical_context')).toBe(false)
  })

  it('payload presente y válido → audit del snapshot lleva clinical_context_schema_version', async () => {
    const fd = buildFormData({
      clinical_context: JSON.stringify(VALID_ESPIRO_CONTEXT),
    })
    await triggerStudyAIAnalysis(fd)

    // El extraction_snapshot persiste con audit.clinical_context_schema_version.
    expect(mockStudyExtractionSnapshotCreate).toHaveBeenCalledTimes(1)
    const extractionArg = mockStudyExtractionSnapshotCreate.mock.calls[0][0]
    expect(extractionArg.data.structuredData.audit.clinical_context_schema_version)
      .toBe(ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION)

    // El prediagnosis_snapshot persiste con la misma trazabilidad.
    expect(mockAIPrediagnosisSnapshotCreate).toHaveBeenCalledTimes(1)
    const predxArg = mockAIPrediagnosisSnapshotCreate.mock.calls[0][0]
    expect(predxArg.data.prediagnosisData.audit.clinical_context_schema_version)
      .toBe(ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION)
  })

  it('payload ausente → audit NO lleva clinical_context_schema_version', async () => {
    const fd = buildFormData()
    await triggerStudyAIAnalysis(fd)

    expect(mockStudyExtractionSnapshotCreate).toHaveBeenCalledTimes(1)
    const extractionArg = mockStudyExtractionSnapshotCreate.mock.calls[0][0]
    expect(extractionArg.data.structuredData.audit.clinical_context_schema_version)
      .toBeUndefined()
  })
})

// ─── Compatibilidad con uploads que NO envían clinical_context ───────────────

describe('triggerStudyAIAnalysis — compat con uploads pre-FEATURE-20260824-02', () => {
  it('el helper no rompe el flujo si el campo clínico no existe en FormData', async () => {
    // FormData SIN clinical_context (típico en audiometría, ECG, etc.).
    const fd = new FormData()
    fd.set('eventTestId', 'et-audio')
    fd.set('eventId', 'ev-1')
    fd.set('triggeredByUserId', 'user-1')
    fd.set('file', new File(['dummy'], 'audio.pdf', { type: 'application/pdf' }))
    fd.set('study_type', 'Audiometria')
    // explícitamente NO hay `clinical_context`.

    const res = await triggerStudyAIAnalysis(fd)
    expect(res.success).toBe(true)
    const body = getUploadFormFromFetchCall()
    expect(body.has('clinical_context')).toBe(false)
    // Otros campos del FormData sí se reenvían.
    expect(body.get('study_type')).toBe('Audiometria')
  })
})
