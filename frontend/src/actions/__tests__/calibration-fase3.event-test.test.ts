/**
 * @file Tests ARCH-20260820-01 Fase 3 — AC-3.1 trazabilidad del snapshot
 *   `calibration_disabled` en el flujo de Events (`uploadEventTestFile`).
 *
 * @spec context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md
 *   §9.1, §15 regla 8 (gate `enabled` no-negociable), §14 Fase 3 AC-3.1, CB-02.
 *
 * Verifica que cuando la versión `published` del `MedicalTest` tiene
 * `enabled=false`, Events NO dispara la IA (`triggerStudyAIAnalysis` no se
 * invoca) y persiste un snapshot no concluyente marcado con
 * `calibration_source="calibration_disabled"` en el audit del
 * `StudyExtractionSnapshot` y del `AIPrediagnosisSnapshot`.
 *
 * @id ARCH-20260820-01
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ─── Mock state ─────────────────────────────────────────────────────────────
const mockEventTestFindUnique = vi.fn()
const mockStudyExtractionSnapshotFindMany = vi.fn().mockResolvedValue([])
const mockStudyExtractionSnapshotCreate = vi.fn()
const mockStudyExtractionSnapshotUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
const mockAIPrediagnosisSnapshotCreate = vi.fn()
const mockAIPrediagnosisSnapshotUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
const mockEventTestUpdate = vi.fn().mockResolvedValue({})
const mockRevalidatePath = vi.fn()
const mockTriggerStudyAI = vi.fn()
const mockGetPublished = vi.fn()
const mockGetCanonical = vi.fn()
const mockIsAIEligible = vi.fn()
const mockWriteTimeline = vi.fn()

// Espía de console.info (vi.mock('console') no intercepta el global en node env).
let consoleInfoSpy: ReturnType<typeof vi.spyOn>

// El `tx` que prisma.$transaction entrega al callback.
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
    },
    studyExtractionSnapshot: {
      findMany: (...a: unknown[]) => mockStudyExtractionSnapshotFindMany(...a),
      create: (...a: unknown[]) => mockStudyExtractionSnapshotCreate(...a),
    },
    aIPrediagnosisSnapshot: {
      create: (...a: unknown[]) => mockAIPrediagnosisSnapshotCreate(...a),
    },
    $transaction: async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock),
  },
}))
vi.mock('@/actions/ai-prediagnosis.actions', () => ({
  triggerStudyAIAnalysis: (...args: unknown[]) => mockTriggerStudyAI(...args),
}))
vi.mock('@/actions/calibration-v3.actions', () => ({
  getPublishedCalibrationForEventTest: (...args: unknown[]) => mockGetPublished(...args),
}))
vi.mock('@/lib/study-ai', () => ({
  getCanonicalAIStudyType: (...args: unknown[]) => mockGetCanonical(...args),
  isAIEligibleEventTest: (...args: unknown[]) => mockIsAIEligible(...args),
}))
vi.mock('@/lib/timeline.service', () => ({
  writeTimelineEntry: (...args: unknown[]) => mockWriteTimeline(...args),
}))

import { uploadEventTestFile } from '@/actions/event-test.actions'

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildFormData(overrides: Partial<{
  eventTestId: string
  eventId: string
  triggeredByUserId: string
}> = {}): FormData {
  const fd = new FormData()
  fd.set('eventTestId', overrides.eventTestId ?? 'et-disabled-1')
  fd.set('eventId', overrides.eventId ?? 'ev-1')
  fd.set('triggeredByUserId', overrides.triggeredByUserId ?? 'user-1')
  // File mock mínimo (no se lee en la rama disabled, que retorna antes).
  const file = new File(['dummy'], 'sample.xml', { type: 'application/xml' })
  fd.set('file', file)
  return fd
}

// ─── AC-3.1: gate enabled=false → snapshot calibration_disabled ─────────────

describe('ARCH-20260820-01 Fase 3 — AC-3.1 uploadEventTestFile con enabled=false', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStudyExtractionSnapshotFindMany.mockResolvedValue([])
    mockStudyExtractionSnapshotUpdateMany.mockResolvedValue({ count: 0 })
    mockAIPrediagnosisSnapshotUpdateMany.mockResolvedValue({ count: 0 })
    mockEventTestUpdate.mockResolvedValue({})
    // Los create deben devolver un objeto con `id` (persistCalibrationDisabledSnapshot
    // lee extractionSnapshot.id y prediagnosisSnapshot.id para el retorno).
    mockStudyExtractionSnapshotCreate.mockResolvedValue({ id: 'snap-1' })
    mockAIPrediagnosisSnapshotCreate.mockResolvedValue({ id: 'predx-1' })
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    // El EventTest existe y tiene test/categoría.
    mockEventTestFindUnique.mockResolvedValue({
      testNameSnapshot: 'Audiometria Ocupacional',
      test: { code: 'AUD', category: { name: 'Audiología' } },
    })
  })

  afterEach(() => {
    consoleInfoSpy?.mockRestore()
  })

  it('enabled=false published → NO dispara IA y persiste snapshot calibration_disabled', async () => {
    // El resolver published reporta enabled=false.
    mockGetPublished.mockResolvedValue({
      enabled: false,
      canonicalStudyType: 'Audiometria',
      versionId: 'cal-v3-001',
      versionNumber: 1,
      source: 'published_v3',
    })

    const result = await uploadEventTestFile(buildFormData())

    // 1. NO se invoca la IA (gate enabled no-negociable, SPEC §15 regla 8).
    expect(mockTriggerStudyAI).not.toHaveBeenCalled()

    // 2. Se persistió un StudyExtractionSnapshot con calibration_disabled.
    expect(mockStudyExtractionSnapshotCreate).toHaveBeenCalledTimes(1)
    const createArgs = mockStudyExtractionSnapshotCreate.mock.calls[0][0]
    const structuredData = createArgs.data.structuredData
    expect(structuredData.audit.calibration_source).toBe('calibration_disabled')
    expect(structuredData.audit.calibration_version_id).toBe('cal-v3-001')
    expect(structuredData.audit.reason).toBe('calibration_disabled')
    expect(createArgs.data.clinicalState).toBe('AI_NON_CONCLUSIVE')
    expect(createArgs.data.triggerReason).toBe('calibration_disabled')

    // 3. Se persistió un AIPrediagnosisSnapshot con calibration_disabled.
    expect(mockAIPrediagnosisSnapshotCreate).toHaveBeenCalledTimes(1)
    const predxArgs = mockAIPrediagnosisSnapshotCreate.mock.calls[0][0]
    expect(predxArgs.data.prediagnosisData.audit.calibration_source).toBe('calibration_disabled')
    expect(predxArgs.data.clinicalState).toBe('AI_NON_CONCLUSIVE')

    // 4. El EventTest quedó en RESULT_REGISTERED con resultNotes claras.
    expect(mockEventTestUpdate).toHaveBeenCalled()
    const eventTestUpdateArgs = mockEventTestUpdate.mock.calls[0][0]
    expect(eventTestUpdateArgs.data.status).toBe('RESULT_REGISTERED')
    expect(eventTestUpdateArgs.data.resultNotes).toContain('enabled=false')

    // 5. El resultado devuelve aiAnalysis con clinicalState no concluyente.
    expect(result.success).toBe(true)
    expect(result.aiAnalysis).not.toBeNull()
    expect(result.aiAnalysis?.clinicalState).toBe('AI_NON_CONCLUSIVE')

    // 6. Log trazable del gate (SPEC §17.4).
    expect(consoleInfoSpy).toHaveBeenCalled()
    const logCall = consoleInfoSpy.mock.calls[0][0] as string
    expect(logCall).toContain('calibration_disabled')
  })

  it('enabled=false → no se invoca la heurística de nombre (no hace falta)', async () => {
    mockGetPublished.mockResolvedValue({
      enabled: false,
      canonicalStudyType: 'Audiometria',
      versionId: 'cal-v3-002',
      versionNumber: 2,
      source: 'published_v3',
    })

    await uploadEventTestFile(buildFormData())

    // Como published.enabled=false corta antes del fallback, la heurística
    // no se evalúa (no es necesaria: el gate tiene prioridad).
    expect(mockGetCanonical).not.toHaveBeenCalled()
    expect(mockIsAIEligible).not.toHaveBeenCalled()
  })

  it('snapshot disabled marca snapshots previos como superseded (inmutabilidad)', async () => {
    // Hay un snapshot vigente previo que debe quedar superseded.
    mockStudyExtractionSnapshotFindMany.mockResolvedValue([{ id: 'old-snap-1' }])
    mockGetPublished.mockResolvedValue({
      enabled: false,
      canonicalStudyType: 'Espirometria',
      versionId: 'cal-v3-003',
      versionNumber: 1,
      source: 'published_v3',
    })

    await uploadEventTestFile(buildFormData())

    // El snapshot previo se marca isSuperseded=true (inmutabilidad histórica).
    expect(mockAIPrediagnosisSnapshotUpdateMany).toHaveBeenCalled()
    expect(mockStudyExtractionSnapshotUpdateMany).toHaveBeenCalled()
    const updateArgs = mockStudyExtractionSnapshotUpdateMany.mock.calls[0][0]
    expect(updateArgs.where.id).toEqual({ in: ['old-snap-1'] })
    expect(updateArgs.data.isSuperseded).toBe(true)

    // La nueva versión de extracción es 2 (1 previo + 1).
    const createArgs = mockStudyExtractionSnapshotCreate.mock.calls[0][0]
    expect(createArgs.data.version).toBe(2)
  })
})
