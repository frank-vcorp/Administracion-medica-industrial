/**
 * @file Tests unitarios puros para los helpers de UI V3 — ARCH-20260820-01 Fase 2B.
 * @spec context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md §5, §8
 * @handoff context/interconsultas/HANDOFF_ARCH-20260820-01_FASE2B_SOFIA_EDITOR-V3.md
 *
 * Cubre AC-2B.2, AC-2B.3, AC-2B.7 (gates) y AC-2B.8 (mapPublishErrorCode).
 * Helper puro (sin Prisma, sin React) — entorno node, sin DOM.
 *
 * @id ARCH-20260820-01 / IMPL-20260820-01-FASE2B
 */
import { describe, it, expect } from "vitest"
import type {
  AICalibrationDraftV3,
  AICalibrationV3,
  AICalibrationVersionV3,
  OperationMode,
} from "@/types/calibration"
import {
  describeCalibrationV3State,
  coerceV3DraftToEditorInitial,
  mapPublishErrorCode,
  getPublishGateVisibility,
  isOperationModeValue,
} from "@/lib/calibration-v3-ui"

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeDraft(overrides: Partial<AICalibrationDraftV3> = {}): AICalibrationDraftV3 {
  return {
    status: "draft",
    label: "cal-v3-draft",
    enabled: true,
    canonicalStudyType: "Audiometria",
    extraction: { enabled: true, prompt: "prompt extracción", provider: "gemini" },
    fieldDefinitions: [
      { key: "oido_derecho", label: "OD", type: "unknown", aliases: [], required: true },
    ],
    clinicalCriteria: {
      prediagnosisEnabled: true,
      requiredParams: ["oido_derecho"],
      confidenceThreshold: 0.5,
      prompt: "prompt clínico",
    },
    presentation: { enabled: false, schema: null },
    ...overrides,
  }
}

function makeVersionV3(
  overrides: Partial<AICalibrationVersionV3> = {},
): AICalibrationVersionV3 {
  return {
    versionId: "cal-v3-v1",
    versionNumber: 1,
    label: "v1",
    status: "published",
    publishedAt: "2026-08-20T00:00:00Z",
    publishedBy: "frank-1",
    enabled: true,
    canonicalStudyType: "Audiometria",
    extraction: { enabled: true, prompt: "p" },
    fieldDefinitions: [],
    clinicalCriteria: null,
    presentation: { enabled: false, schema: null },
    ...overrides,
  }
}

function makeRootV3(overrides: Partial<AICalibrationV3> = {}): AICalibrationV3 {
  return {
    schemaVersion: "V3",
    currentPublishedVersionId: null,
    familyTemplateId: null,
    draft: null,
    publishedVersions: [],
    legacyV1V2Snapshot: null,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// isOperationModeValue (cubierto indirectamente vía describeCalibrationV3State)
// ─────────────────────────────────────────────────────────────────────────────

describe("isOperationModeValue", () => {
  it("acepta los 3 literales del union", () => {
    expect(isOperationModeValue("manual_service")).toBe(true)
    expect(isOperationModeValue("document_extraction")).toBe(true)
    expect(isOperationModeValue("clinical_interpretation")).toBe(true)
  })

  it("rechaza cualquier otro valor (no inventa)", () => {
    expect(isOperationModeValue("mani_service")).toBe(false)
    expect(isOperationModeValue(null)).toBe(false)
    expect(isOperationModeValue(undefined)).toBe(false)
    expect(isOperationModeValue(42)).toBe(false)
    expect(isOperationModeValue({})).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// describeCalibrationV3State — AC-2B.2
// ─────────────────────────────────────────────────────────────────────────────

describe("describeCalibrationV3State (AC-2B.2)", () => {
  it("manual_service + V3 → isManualService=true, hasV3=true, currentPublishedVersion=null", () => {
    const state = describeCalibrationV3State(
      makeRootV3({ draft: makeDraft() }),
      "manual_service",
    )
    expect(state.isManualService).toBe(true)
    expect(state.hasV3).toBe(true)
    expect(state.currentPublishedVersion).toBeNull()
    expect(state.draftStatus).toBe("draft")
  })

  it("operationMode inválido → operationMode=null (no inventa)", () => {
    const state = describeCalibrationV3State(
      makeRootV3({ draft: makeDraft() }),
      "modo_inventado" as unknown as OperationMode,
    )
    expect(state.operationMode).toBeNull()
    expect(state.isManualService).toBe(false)
  })

  it("con published y superseded → currentPublishedVersion correcto y supersededCount", () => {
    const root = makeRootV3({
      currentPublishedVersionId: "cal-v3-v2",
      publishedVersions: [
        makeVersionV3({ versionId: "cal-v3-v1", versionNumber: 1, status: "superseded", supersededAt: "2026-08-21", supersededByVersionId: "cal-v3-v2" }),
        makeVersionV3({ versionId: "cal-v3-v2", versionNumber: 2, status: "published", publishedAt: "2026-08-22" }),
      ],
    })
    const state = describeCalibrationV3State(root, "clinical_interpretation")
    expect(state.currentPublishedVersion).not.toBeNull()
    expect(state.currentPublishedVersion!.versionId).toBe("cal-v3-v2")
    expect(state.currentPublishedVersion!.versionNumber).toBe(2)
    expect(state.currentPublishedVersion!.publishedAt).toBe("2026-08-22")
    expect(state.supersededCount).toBe(1)
  })

  it("V3 con draft tested → draftStatus='tested'", () => {
    const state = describeCalibrationV3State(
      makeRootV3({ draft: makeDraft({ status: "tested" }) }),
      "clinical_interpretation",
    )
    expect(state.draftStatus).toBe("tested")
  })

  it("V3 sin draft → draftStatus=null", () => {
    const state = describeCalibrationV3State(
      makeRootV3({ draft: null }),
      "clinical_interpretation",
    )
    expect(state.draftStatus).toBeNull()
  })

  it("legacyV1V2Snapshot presente → hasLegacySnapshot=true", () => {
    const state = describeCalibrationV3State(
      makeRootV3({
        legacyV1V2Snapshot: {
          snapshot: { currentVersion: 3 },
          migratedAt: "2026-08-20",
          migratedBy: "frank-1",
          sourceSchemaVersion: "V2",
        },
      }),
      "clinical_interpretation",
    )
    expect(state.hasLegacySnapshot).toBe(true)
  })

  it("aiCalibrationV3=null → isLegacyOnly=true, hasV3=false", () => {
    const state = describeCalibrationV3State(null, "clinical_interpretation")
    expect(state.isLegacyOnly).toBe(true)
    expect(state.hasV3).toBe(false)
    expect(state.currentPublishedVersion).toBeNull()
    expect(state.supersededCount).toBe(0)
  })

  it("disabled cuenta como vigente (mismo criterio que getPublishedCalibrationForEventTest)", () => {
    const root = makeRootV3({
      currentPublishedVersionId: "cal-v3-disabled",
      publishedVersions: [
        makeVersionV3({ versionId: "cal-v3-disabled", versionNumber: 1, status: "disabled" }),
      ],
    })
    const state = describeCalibrationV3State(root, "clinical_interpretation")
    expect(state.currentPublishedVersion).not.toBeNull()
    expect(state.currentPublishedVersion!.versionId).toBe("cal-v3-disabled")
    expect(state.supersededCount).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// describeCalibrationV3State — CB-2B-1: currentPublishedVersionId roto
// ─────────────────────────────────────────────────────────────────────────────

describe("describeCalibrationV3State — CB-2B-1 (currentPublishedVersionId roto)", () => {
  it("cae a la primera published|disabled si el id no existe", () => {
    const root = makeRootV3({
      currentPublishedVersionId: "cal-v3-inexistente",
      publishedVersions: [
        makeVersionV3({ versionId: "cal-v3-v1", versionNumber: 1, status: "superseded" }),
        makeVersionV3({ versionId: "cal-v3-v2", versionNumber: 2, status: "published" }),
      ],
    })
    const state = describeCalibrationV3State(root, "clinical_interpretation")
    expect(state.currentPublishedVersion!.versionId).toBe("cal-v3-v2")
  })

  it("publishedVersions no vacías pero todas superseded → currentPublishedVersion=null", () => {
    const root = makeRootV3({
      publishedVersions: [
        makeVersionV3({ versionId: "cal-v3-v1", versionNumber: 1, status: "superseded" }),
        makeVersionV3({ versionId: "cal-v3-v2", versionNumber: 2, status: "superseded" }),
      ],
    })
    const state = describeCalibrationV3State(root, "clinical_interpretation")
    expect(state.currentPublishedVersion).toBeNull()
    expect(state.supersededCount).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// coerceV3DraftToEditorInitial — AC-2B.3 + CB-2B-2
// ─────────────────────────────────────────────────────────────────────────────

describe("coerceV3DraftToEditorInitial (AC-2B.3, CB-2B-2)", () => {
  it("clinical_interpretation: clinicalCriteria → diagnosis; extraction/clínicos intactos", () => {
    const draft = makeDraft({
      clinicalCriteria: {
        prediagnosisEnabled: true,
        requiredParams: ["oido_derecho"],
        confidenceThreshold: 0.55,
        prompt: "prompt clínico real",
        promptVersion: "predx-v3",
      },
      extraction: {
        enabled: true,
        prompt: "prompt extracción",
        version: "extract-v3",
        schemaVersion: "v3",
        provider: "m3",
        model: "M3",
      },
      fieldDefinitions: [
        { key: "oido_derecho", label: "OD", type: "unknown", aliases: [], required: true },
      ],
      presentation: {
        enabled: true,
        schema: { studyType: "Audiometria", sections: [{ kind: "keyValue", title: "F", fields: ["oido_derecho"] }] },
      },
    })
    const initial = coerceV3DraftToEditorInitial(draft)
    expect(initial.enabled).toBe(true)
    expect(initial.canonicalStudyType).toBe("Audiometria")
    const ext = initial.extraction as Record<string, unknown>
    expect(ext.enabled).toBe(true)
    expect(ext.prompt).toBe("prompt extracción")
    expect(ext.version).toBe("extract-v3")
    expect(ext.schemaVersion).toBe("v3")
    expect(ext.provider).toBe("m3")
    expect(ext.model).toBe("M3")
    const diag = initial.diagnosis as Record<string, unknown>
    expect(diag.enabled).toBe(true)
    expect(diag.prompt).toBe("prompt clínico real")
    expect(diag.promptVersion).toBe("predx-v3")
    expect(initial.fieldDefinitions).toHaveLength(1)
    expect(initial.presentation).toEqual({
      enabled: true,
      schema: { studyType: "Audiometria", sections: [{ kind: "keyValue", title: "F", fields: ["oido_derecho"] }] },
    })
  })

  it("document_extraction (clinicalCriteria=null) → diagnosis.enabled=false, prompt vacío", () => {
    const draft = makeDraft({ clinicalCriteria: null })
    const initial = coerceV3DraftToEditorInitial(draft)
    const diag = initial.diagnosis as Record<string, unknown>
    expect(diag.enabled).toBe(false)
    expect(diag.prompt).toBe("")
    expect(diag.promptVersion).toBe("")
  })

  it("defaults seguros cuando campos opcionales son null", () => {
    const draft = makeDraft({
      canonicalStudyType: null,
      extraction: { enabled: false, prompt: null, provider: "gemini" },
      clinicalCriteria: null,
      fieldDefinitions: [],
      presentation: { enabled: false, schema: null },
    })
    const initial = coerceV3DraftToEditorInitial(draft)
    expect(initial.enabled).toBe(true)
    expect(initial.canonicalStudyType).toBe("")
    const ext = initial.extraction as Record<string, unknown>
    expect(ext.provider).toBe("gemini")
    expect(ext.model).toBe("")
    expect(ext.prompt).toBe("")
    expect(ext.version).toBe("")
    expect(ext.schemaVersion).toBe("")
    expect(initial.fieldDefinitions).toEqual([])
    expect(initial.presentation).toEqual({ enabled: false, schema: null })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// mapPublishErrorCode — AC-2B.8
// ─────────────────────────────────────────────────────────────────────────────

describe("mapPublishErrorCode (AC-2B.8)", () => {
  it("códigos de gate → mapean a gate G0…G9", () => {
    const cases: Array<[string, string]> = [
      ["PUBLISH_INVALID_OPERATION_MODE", "G0"],
      ["PUBLISH_MANUAL_SERVICE_NO_CALIBRATION", "G0b"],
      ["PUBLISH_INVALID_CANONICAL_TYPE", "G1"],
      ["PUBLISH_EXTRACTION_PROMPT_EMPTY", "G2"],
      ["PUBLISH_CLINICAL_PROMPT_EMPTY", "G3"],
      ["PUBLISH_PRESENTATION_SCHEMA_EMPTY", "G4"],
      ["PUBLISH_MISSING_E2E_TEST", "G5"],
      ["PUBLISH_VERSION_ID_COLLISION", "G6"],
      ["PUBLISH_REQUIRED_PARAMS_NOT_DEFINED", "G7"],
      ["PUBLISH_FAMILY_MODE_MISMATCH", "G8"],
      ["PUBLISH_FAMILY_OVERRIDE_REMOVES_REQUIRED", "G9"],
    ]
    for (const [code, expectedGate] of cases) {
      const res = mapPublishErrorCode(code)
      expect(res.gate, code).toBe(expectedGate)
      expect(res.title, code).toBeTruthy()
      expect(res.hint, code).toBeTruthy()
    }
  })

  it("códigos sin gate (rol/estado/sistema) → gate=null, title útil", () => {
    const noGate = ["FORBIDDEN", "NO_DRAFT", "DRAFT_NOT_TESTED", "UNAUTHENTICATED", "TEST_NOT_FOUND", "INTERNAL_ERROR"]
    for (const code of noGate) {
      const res = mapPublishErrorCode(code)
      expect(res.gate, code).toBeNull()
      expect(res.title, code).toBeTruthy()
      expect(res.hint, code).toBeTruthy()
    }
  })

  it("código desconocido → fallback seguro con title=code y hint genérico", () => {
    const res = mapPublishErrorCode("CODE_INVENTADO")
    expect(res.gate).toBeNull()
    expect(res.title).toBe("CODE_INVENTADO")
    expect(res.hint).toBe("Error inesperado de publicación")
  })

  it("string vacío → fallback seguro", () => {
    const res = mapPublishErrorCode("")
    expect(res.gate).toBeNull()
    expect(res.title).toBe("")
    expect(res.hint).toBe("Error inesperado de publicación")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getPublishGateVisibility — AC-2B.7, AC-2B.9
// ─────────────────────────────────────────────────────────────────────────────

describe("getPublishGateVisibility (AC-2B.7, AC-2B.9)", () => {
  it("manual_service: G0b applicable=false; G8/G9 N/A (P-04); G5 N/A", () => {
    const list = getPublishGateVisibility("manual_service", null)
    expect(list).toHaveLength(11)
    const g0b = list.find((g) => g.gate === "G0b")!
    expect(g0b.applicable).toBe(false)
    expect(g0b.reason).toMatch(/manual_service/i)
    const g8 = list.find((g) => g.gate === "G8")!
    expect(g8.applicable).toBe(false)
    expect(g8.reason).toMatch(/P-04/)
    const g5 = list.find((g) => g.gate === "G5")!
    expect(g5.applicable).toBe(false)
    expect(g5.reason).toMatch(/Fase 2/)
  })

  it("document_extraction: G1/G3/G7 N/A (clinicalCriteria=null); G2 applicable si extraction.enabled", () => {
    const draft = makeDraft({
      canonicalStudyType: null,
      clinicalCriteria: null,
      extraction: { enabled: true, prompt: "p", provider: "gemini" },
    })
    const list = getPublishGateVisibility("document_extraction", draft)
    const g1 = list.find((g) => g.gate === "G1")!
    expect(g1.applicable).toBe(false)
    expect(g1.reason).toMatch(/document_extraction/)
    const g3 = list.find((g) => g.gate === "G3")!
    expect(g3.applicable).toBe(false)
    expect(g3.reason).toMatch(/clinicalCriteria=null/)
    const g2 = list.find((g) => g.gate === "G2")!
    expect(g2.applicable).toBe(true)
    const g7 = list.find((g) => g.gate === "G7")!
    expect(g7.applicable).toBe(false)
    expect(g7.reason).toMatch(/clinicalCriteria=null/)
  })

  it("clinical_interpretation con draft completo: G1..G7 aplicables", () => {
    const draft = makeDraft({
      extraction: { enabled: true, prompt: "p", provider: "gemini" },
      clinicalCriteria: {
        prediagnosisEnabled: true,
        requiredParams: ["oido_derecho"],
        confidenceThreshold: 0.5,
        prompt: "p",
      },
      presentation: { enabled: true, schema: { studyType: "Audiometria", sections: [{ kind: "keyValue", title: "F", fields: ["oido_derecho"] }] } },
    })
    const list = getPublishGateVisibility("clinical_interpretation", draft)
    for (const gate of ["G1", "G2", "G3", "G4", "G6", "G7"]) {
      const g = list.find((x) => x.gate === gate)!
      expect(g.applicable, gate).toBe(true)
    }
    // G5 siempre N/A en Fase 2
    expect(list.find((g) => g.gate === "G5")!.applicable).toBe(false)
  })

  it("operationMode=null → G0 applicable=false (mode ausente)", () => {
    const list = getPublishGateVisibility(null, makeDraft())
    expect(list.find((g) => g.gate === "G0")!.applicable).toBe(false)
  })

  it("lista contiene exactamente G0..G9 en orden", () => {
    const list = getPublishGateVisibility("clinical_interpretation", makeDraft())
    expect(list.map((g) => g.gate)).toEqual([
      "G0", "G0b", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9",
    ])
  })
})
