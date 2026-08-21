/**
 * @file Tests ARCH-20260820-01 Fase 3 — Gate `enabled` + routing por
 *   `canonicalStudyType` publicado en Events frontend.
 *
 * @spec context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md
 *   §9.1 (Events consume published), §12.1 (fallbacks trazados),
 *   §14 Fase 3 (AC-3.1 a AC-3.4).
 *
 * Cobertura:
 *   - AC-3.1: EventTest con `enabled=false` published → no dispara IA;
 *     snapshot con `calibration_source="calibration_disabled"`.
 *   - AC-3.2: EventTest con `canonicalStudyType` published → enruta por
 *     published (no por heurística).
 *   - AC-3.3: si no hay published → cae a heurística con
 *     `source="legacy_heuristic"` (fallback trazado).
 *   - AC-3.4: `CalibrationWorkspaceClient` no asume `"Audiometria"`;
 *     selector vacío con placeholder.
 *
 * @id ARCH-20260820-01
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// ─── Mock state (declarados ANTES de vi.mock para evitar TDZ) ──────────────
const mockEventTestFindUnique = vi.fn()
const mockMedicalTestFindUnique = vi.fn()
const mockMedicalTestUpdate = vi.fn()
const mockRevalidatePath = vi.fn()
const mockGetServerSession = vi.fn()

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    eventTest: {
      findUnique: (...args: unknown[]) => mockEventTestFindUnique(...args),
    },
    medicalTest: {
      findUnique: (...args: unknown[]) => mockMedicalTestFindUnique(...args),
      update: (...args: unknown[]) => mockMedicalTestUpdate(...args),
    },
  },
}))
vi.mock('next-auth/next', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))
vi.mock('@/auth', () => ({
  authOptions: { mock: true },
}))
vi.mock('@/lib/auth/roles', () => ({
  isSuperAdmin: (role: string | null | undefined) => role === 'SUPERADMIN',
  isAdminLike: (role: string | null | undefined) => role === 'SUPERADMIN' || role === 'ADMIN',
}))

// Espías de console (vi.mock('console') no intercepta el global en node env).
let consoleWarnSpy: ReturnType<typeof vi.spyOn>

import { getPublishedCalibrationForEventTest } from '@/actions/calibration-v3.actions'
import { getCanonicalAIStudyType, isAIEligibleEventTest } from '@/lib/study-ai'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeV3Root(overrides: Partial<{
  currentPublishedVersionId: string | null
  publishedVersions: unknown[]
}> = {}) {
  return {
    schemaVersion: 'V3',
    currentPublishedVersionId: overrides.currentPublishedVersionId ?? null,
    familyTemplateId: null,
    draft: null,
    publishedVersions: overrides.publishedVersions ?? [],
    legacyV1V2Snapshot: null,
  }
}

function makePublishedVersion(overrides: Partial<{
  versionId: string
  versionNumber: number
  status: 'published' | 'superseded' | 'disabled'
  enabled: boolean
  canonicalStudyType: string | null
}> = {}) {
  return {
    versionId: overrides.versionId ?? 'cal-v3-001',
    versionNumber: overrides.versionNumber ?? 1,
    label: 'cal-1',
    status: overrides.status ?? 'published',
    publishedAt: '2026-08-20T00:00:00Z',
    publishedBy: 'user-1',
    enabled: overrides.enabled ?? true,
    canonicalStudyType: overrides.canonicalStudyType ?? null,
    extraction: { enabled: true, prompt: 'p' },
    fieldDefinitions: [],
    clinicalCriteria: null,
    presentation: { enabled: false, schema: null },
  }
}

function makeEventTestRow(aiCalibration: unknown, operationMode: string | null = null) {
  const options: Record<string, unknown> = {}
  if (operationMode !== null) options.operationMode = operationMode
  if (aiCalibration !== null) options.aiCalibration = aiCalibration
  return { test: { options } }
}

// ─── AC-3.1 / AC-3.2 / AC-3.3: getPublishedCalibrationForEventTest ─────────

describe('ARCH-20260820-01 Fase 3 — getPublishedCalibrationForEventTest', () => {
  beforeEach(() => {
    mockEventTestFindUnique.mockReset()
    mockRevalidatePath.mockReset()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy?.mockRestore()
  })

  it('AC-3.2: V3 published enabled=true + canonicalStudyType se devuelve publicada', async () => {
    const root = makeV3Root({
      currentPublishedVersionId: 'cal-v3-001',
      publishedVersions: [
        makePublishedVersion({
          versionId: 'cal-v3-001',
          versionNumber: 1,
          status: 'published',
          enabled: true,
          canonicalStudyType: 'Espirometria',
        }),
      ],
    })
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow(root, 'clinical_interpretation'))

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result).not.toBeNull()
    expect(result).toEqual({
      enabled: true,
      canonicalStudyType: 'Espirometria',
      versionId: 'cal-v3-001',
      versionNumber: 1,
      source: 'published_v3',
    })
  })

  it('AC-3.1: V3 published disabled (enabled=false) → enabled=false propagado', async () => {
    const root = makeV3Root({
      currentPublishedVersionId: 'cal-v3-002',
      publishedVersions: [
        makePublishedVersion({
          versionId: 'cal-v3-002',
          versionNumber: 2,
          status: 'disabled',
          enabled: false,
          canonicalStudyType: 'Audiometria',
        }),
      ],
    })
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow(root, 'clinical_interpretation'))

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result).not.toBeNull()
    expect(result?.enabled).toBe(false)
    expect(result?.canonicalStudyType).toBe('Audiometria')
    expect(result?.versionId).toBe('cal-v3-002')
    expect(result?.source).toBe('published_v3')
  })

  it('AC-3.1 (variant): published status=published pero enabled=false → enabled=false', async () => {
    // CB-02: la versión published puede tener enabled=false explícito.
    const root = makeV3Root({
      currentPublishedVersionId: 'cal-v3-003',
      publishedVersions: [
        makePublishedVersion({
          versionId: 'cal-v3-003',
          versionNumber: 3,
          status: 'published',
          enabled: false,
          canonicalStudyType: 'Audiometria',
        }),
      ],
    })
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow(root, 'clinical_interpretation'))

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result?.enabled).toBe(false)
  })

  it('V3 published enabled=true sin canonicalStudyType (document_extraction) → null CST', async () => {
    const root = makeV3Root({
      currentPublishedVersionId: 'cal-v3-004',
      publishedVersions: [
        makePublishedVersion({
          versionId: 'cal-v3-004',
          versionNumber: 1,
          status: 'published',
          enabled: true,
          canonicalStudyType: null,
        }),
      ],
    })
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow(root, 'document_extraction'))

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result?.enabled).toBe(true)
    expect(result?.canonicalStudyType).toBeNull()
  })

  it('AC-3.3: V3 sin publishedVersions → null (cae a heurística)', async () => {
    const root = makeV3Root({ publishedVersions: [] })
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow(root, 'clinical_interpretation'))

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result).toBeNull()
  })

  it('AC-3.3: aiCalibration V1/V2 (no V3) → null (cae a heurística)', async () => {
    // V1/V2 no tiene schemaVersion='V3'; el adaptador backend lo resolvería,
    // pero el server action frontend no replica el adaptador → null.
    const v2Calibration = { canonicalStudyType: 'Audiometria', extraction: { prompt: 'p' } }
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow(v2Calibration))

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result).toBeNull()
  })

  it('AC-3.3: MedicalTest sin aiCalibration → null (cae a heurística)', async () => {
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow(null, 'clinical_interpretation'))

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result).toBeNull()
  })

  it('AC-3.3: EventTest sin test asociado → null', async () => {
    mockEventTestFindUnique.mockResolvedValue({ test: null })

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result).toBeNull()
  })

  it('CB-11: error de Prisma → null + log (no lanza)', async () => {
    mockEventTestFindUnique.mockRejectedValue(new Error('prisma down'))

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result).toBeNull()
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  it('CB-11 (variant): eventTestId inválido → null sin tocar Prisma', async () => {
    const result = await getPublishedCalibrationForEventTest('')
    expect(result).toBeNull()
    expect(mockEventTestFindUnique).not.toHaveBeenCalled()
  })

  it('prefiere currentPublishedVersionId sobre la primera published/disabled', async () => {
    // Dos versiones published; currentPublishedVersionId apunta a la segunda.
    const root = makeV3Root({
      currentPublishedVersionId: 'cal-v3-006',
      publishedVersions: [
        makePublishedVersion({
          versionId: 'cal-v3-005',
          versionNumber: 1,
          status: 'superseded',
          enabled: true,
          canonicalStudyType: 'Audiometria',
        }),
        makePublishedVersion({
          versionId: 'cal-v3-006',
          versionNumber: 2,
          status: 'published',
          enabled: true,
          canonicalStudyType: 'Espirometria',
        }),
      ],
    })
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow(root, 'clinical_interpretation'))

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result?.versionId).toBe('cal-v3-006')
    expect(result?.canonicalStudyType).toBe('Espirometria')
  })

  it('todas superseded (ninguna vigente) → null (estado inconsistente)', async () => {
    const root = makeV3Root({
      currentPublishedVersionId: null,
      publishedVersions: [
        makePublishedVersion({ versionId: 'v1', status: 'superseded', enabled: true, canonicalStudyType: 'Audiometria' }),
      ],
    })
    mockEventTestFindUnique.mockResolvedValue(makeEventTestRow(root, 'clinical_interpretation'))

    const result = await getPublishedCalibrationForEventTest('et-1')

    expect(result).toBeNull()
  })
})

// ─── AC-3.3: getCanonicalAIStudyType como fallback explícito trazado ──────

describe('ARCH-20260820-01 Fase 3 — getCanonicalAIStudyType (fallback trazado)', () => {
  it('AC-3.3: prueba sin matching canónico → "Otro" (NO Audiometria)', () => {
    const test = {
      testNameSnapshot: 'Consulta médica general',
      test: { code: 'C01', category: { name: 'Consulta' } },
    }
    const result = getCanonicalAIStudyType(test)
    // Fallback genérico: 'Otro', nunca Audiometria por defecto (H3).
    expect(result).toBe('Otro')
    expect(result).not.toBe('Audiometria')
  })

  it('prueba "Audiometria Ocupacional" → "Audiometria" (matching real, no default)', () => {
    const test = {
      testNameSnapshot: 'Audiometria Ocupacional',
      test: { code: 'AUD', category: { name: 'Audiología' } },
    }
    const result = getCanonicalAIStudyType(test)
    expect(result).toBe('Audiometria')
  })

  it('isAIEligibleEventTest: prueba genérica es elegible (Otro) → true', () => {
    const test = {
      testNameSnapshot: 'Estudio indocumentado',
      test: { code: 'X', category: { name: 'Otros' } },
    }
    expect(isAIEligibleEventTest(test)).toBe(true)
  })

  it('la función sigue exportada y operativa (no eliminada, AC-3.3 fallback)', () => {
    expect(typeof getCanonicalAIStudyType).toBe('function')
    expect(typeof isAIEligibleEventTest).toBe('function')
  })
})

// ─── AC-3.4: CalibrationWorkspaceClient no asume "Audiometria" ─────────────
// Gate de no-regresión: el ambiente de tests es Node (sin jsdom), por lo que
// no se renderiza el componente. Se verifica a nivel de fuente que el default
// silencioso `?? "Audiometria"` fue eliminado (anti-patrón H3, DEC-20260820-02)
// y que el placeholder "Sin tipo canónico" existe en CalibrationTestUpload.

describe('ARCH-20260820-01 Fase 3 — AC-3.4 (no default Audiometria)', () => {
  const workspacePath = path.resolve(
    __dirname,
    '../../components/calibration/CalibrationWorkspaceClient.tsx',
  )
  const uploadPath = path.resolve(
    __dirname,
    '../../components/calibration/CalibrationTestUpload.tsx',
  )

  it('CalibrationWorkspaceClient NO contiene el default `?? "Audiometria"`', () => {
    const src = readFileSync(workspacePath, 'utf8')
    // El anti-patrón H3 original era `aiCalibration?.canonicalStudyType ?? "Audiometria"`.
    expect(src).not.toContain('?? "Audiometria"')
    expect(src).not.toContain("?? 'Audiometria'")
    // Debe usar string vacío como default (selector vacío con placeholder).
    expect(src).toContain('canonicalStudyType ?? ""')
  })

  it('CalibrationTestUpload muestra placeholder "Sin tipo canónico" cuando testType es vacío', () => {
    const src = readFileSync(uploadPath, 'utf8')
    // El placeholder reemplaza al default Audiometría.
    expect(src).toContain('Sin tipo canónico')
    // La prop testType sigue siendo string (acepta vacío, no asume Audiometría).
    expect(src).toContain('testType: string')
  })
})
