/**
 * @fileoverview Editor de configuración aiCalibration por prueba médica.
 *   Muestra solo dos prompts/versiones por prueba: extracción (Gemini) y diagnóstico (MedGemma).
 *   Maneja el caso inicial (sin configuración) y el caso de edición (ya configurado).
 *
 *   ARCH-20260820-01 Fase 2: editor V3 condicional por `operationMode`
 *   (DEC-20260820-02). Para `manual_service` no se muestra el editor
 *   (AC-2.6). Para `document_extraction` se oculta la sección de criterios
 *   clínicos/prediagnóstico (CB-14). Para `clinical_interpretation` se
 *   muestra el editor completo.
 *
 * @id ARCH-20260516-03
 * @backup context/SPECs/SPEC_ARCH-20260516-03-CALIBRACION-CONFIG-SOLO-DOS-PROMPTS.md
 * @intervention ARCH-20260518-06
 * @see context/SPECs/SPEC_ARCH-20260518-06-BASE-EXTRACCION-Y-PLANTILLA-CALIBRACION.md
 * @intervention ARCH-20260820-01 Fase 2 (editor condicional por operationMode)
 */
"use client"

import { useState, useTransition } from "react"
import { saveAICalibrationV3 } from "@/actions/calibration-v3.actions"
import type {
  AICalibrationDraftV3,
  AICalibrationPresentationV3,
  ClinicalCriteria,
  FieldDefinition,
  OperationMode,
  StudyPresentationSchema,
} from "@/types/calibration"

// ─────────────────────────────────────────────────────────────────────────────
// Editor condicional por operationMode (DEC-20260820-02, AC-2.1, AC-2.6, CB-14)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Secciones del editor V3 que se muestran según `operationMode`.
 *
 * - `manual_service`: el editor **no se muestra** (null). DEC-20260820-02.
 * - `document_extraction`: extracción + presentación; **sin** criterios
 *   clínicos/prediagnóstico (CB-14).
 * - `clinical_interpretation`: editor completo (extracción + clínica + presentación).
 *
 * Helper puro exportable para tests (sin montar React). El componente lo
 * consume para decidir qué secciones renderizar.
 */
export interface EditorSections {
  showExtraction: boolean
  showClinicalCriteria: boolean
  showPresentation: boolean
}

export function getEditorSectionsForOperationMode(
  operationMode: OperationMode | null | undefined,
): EditorSections | null {
  if (!operationMode) {
    // Sin operationMode confirmado: flujo legacy V1/V2 (mostrar todo para
    // no romper el comportamiento anterior). No se asume Audiometría.
    return { showExtraction: true, showClinicalCriteria: true, showPresentation: true }
  }
  if (operationMode === "manual_service") {
    // AC-2.6 / DEC-20260820-02: no se muestra editor de calibración IA.
    return null
  }
  if (operationMode === "document_extraction") {
    // CB-14: sin criterios clínicos/prediagnóstico.
    return { showExtraction: true, showClinicalCriteria: false, showPresentation: true }
  }
  // clinical_interpretation: editor completo.
  return { showExtraction: true, showClinicalCriteria: true, showPresentation: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface AICalibrationEditorProps {
  testId: string
  initial: Record<string, unknown> | null
  /**
   * Modo operativo del catálogo (DEC-20260820-02). Si es `manual_service`,
   * el editor no se muestra (AC-2.6). Si es `document_extraction`, se
   * oculta la sección de criterios clínicos/prediagnóstico (CB-14).
   * Opcional: si ausente, se asume flujo legacy V1/V2 (mostrar todo).
   */
  operationMode?: OperationMode | null
  /**
   * Status inicial del draft a guardar. Default `draft`. ARCH-20260820-01
   * Fase 2B (AC-2B.4): permite al usuario persistir `tested` directamente
   * desde la UI (gate para `publishAICalibrationV3`).
   */
  initialStatus?: "draft" | "tested"
  /**
   * Callback opcional invocado al guardar exitosamente. Permite al
   * workspace refrescar el estado V3 (panel + header) tras `saveAICalibrationV3`.
   */
  onSaved?: (status: "draft" | "tested") => void
}

const EXTRACTION_PROMPT_TEMPLATE = `REGLAS ESPECÍFICAS DEL ESTUDIO: {{nombre_del_estudio}}

OBJETIVO
Extrae únicamente datos visibles en el documento con máxima fidelidad y sin interpretación clínica.
Devuelve SOLO un objeto JSON válido (sin markdown, sin comentarios, sin bloques <think>).

CAMPOS ESPERADOS (JSON)
{
  "paciente": "nombre completo o null",
  "fecha_estudio": "fecha del estudio o null",
  "hallazgos": ["descripción objetiva visible"],
  "profesional": "médico o firmante si aparece, o null",
  "notas_calidad": "calidad técnica del documento o null"
}

REGLAS
- No inventes, no deduzcas y no completes valores ausentes (usa null).
- No incluyas diagnóstico definitivo, aptitud laboral ni tratamiento.
- Conserva números, unidades, fechas, nombres y etiquetas tal como aparecen en el documento.`

const CALIBRATION_REQUEST_TEMPLATE = `Genera un prompt completo de extracción JSON para {{nombre_del_estudio}}.

Este prompt se enviará directamente al modelo de extracción (única fuente de verdad en BD, sin reglas ocultas en código).
Incluye:
- instrucción de devolver SOLO JSON válido sin markdown ni bloques <think>
- esquema JSON exacto de campos esperados
- reglas de no invención (usar null si no es visible) y sin diagnóstico clínico
- labels/sinónimos reales y reglas de tablas o calidad si aplica.`

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de acceso seguro a datos anidados del JSON
// ─────────────────────────────────────────────────────────────────────────────

function getStr(obj: Record<string, unknown> | null, key: string): string {
  if (!obj) return ""
  const val = obj[key]
  return val != null ? String(val) : ""
}

function getBool(obj: Record<string, unknown> | null, key: string): boolean {
  if (!obj) return false
  return Boolean(obj[key])
}

function getNested(obj: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  if (!obj) return null
  const val = obj[key]
  return typeof val === "object" && val !== null && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : null
}

// ARCH-20260809-02: tipos y defaults para el selector de proveedor extractivo.
type ExtractionProvider = "gemini" | "m3"
const EXTRACTION_PROVIDERS: ExtractionProvider[] = ["gemini", "m3"]
const EXTRACTION_MODEL_PLACEHOLDERS: Record<ExtractionProvider, string> = {
  gemini: "gemini-2.5-flash",
  m3: "MiniMax-M3.1-Flash",
}
function isExtractionProvider(value: unknown): value is ExtractionProvider {
  return value === "gemini" || value === "m3"
}

function looksLikePromptContent(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) return false
  return normalized.length > 120 || normalized.includes("\n") || normalized.includes("OBJETIVO")
}

// ─────────────────────────────────────────────────────────────────────────────
// F-2.2 (QA-20260820-03): constructor del draft V3 desde el estado del editor
// AC-2.1 — el editor persiste vía saveAICalibrationV3, no saveAICalibration (V1).
// ─────────────────────────────────────────────────────────────────────────────

/** Valores normalizados que handleSubmit calcula desde el estado del form. */
export interface EditorFormState {
  enabled: boolean
  canonicalStudyType: string
  extractPrompt: string
  extractVersion: string
  extractProvider: "gemini" | "m3"
  extractModel: string
  diagPrompt: string
  diagVersion: string
}

/** Entrada del constructor del draft V3. */
export interface BuildDraftV3Input extends EditorFormState {
  /** `initial` del editor (raw V1/V2 shape; puede traer fieldDefinitions/presentation). */
  initial: Record<string, unknown> | null
  /** operationMode prop; null/undefined → asume clinical_interpretation (legacy). */
  operationMode?: OperationMode | null
  /** Secciones computadas por getEditorSectionsForOperationMode. */
  sections: EditorSections
  /**
   * Status inicial del draft a persistir (`draft` o `tested`). Default
   * `draft` (preserva comportamiento previo). ARCH-20260820-01 Fase 2B
   * (AC-2B.4): la UI permite seleccionar "guardar como tested" para
   * satisfacer el gate G0+ de publicación.
   */
  status?: "draft" | "tested"
}

/**
 * Coacciona el `presentation` legacy (V2) al tipo V3. El editor aún no expone
 * edición de `presentation.schema` (Fase 6); se preserva lo que ya había.
 */
function coercePresentationV3(
  raw: Record<string, unknown> | null,
): AICalibrationPresentationV3 {
  if (!raw) return { enabled: false, schema: null }
  const schema = raw.schema
  return {
    enabled: Boolean(raw.enabled),
    schema:
      typeof schema === "object" && schema !== null && !Array.isArray(schema)
        ? (schema as unknown as StudyPresentationSchema)
        : null,
  }
}

/**
 * Construye un `AICalibrationDraftV3` mínimo mapeando los campos V1/V2 que el
 * editor ya edita a la estructura del draft V3 (F-2.2, AC-2.1).
 *
 * Campos V3 que el editor aún NO expone en UI y se dejan como null/vacíos:
 *   - `fieldDefinitions` se preserva de `initial` V2 (no se editan aquí).
 *   - `presentation.schema` se preserva de `initial` V2 (no se edita aquí).
 *   - `clinicalCriteria.requiredParams`, `confidenceThreshold`,
 *     `supportingReferences` (nulos/vacíos).
 *   - `extraction.targetFields` (vacío).
 *
 * Estos se completarán en Fase 6 (integración UI completa del editor V3).
 */
export function buildDraftV3FromEditorState(input: BuildDraftV3Input): AICalibrationDraftV3 {
  const {
    enabled,
    canonicalStudyType,
    extractPrompt,
    extractVersion,
    extractProvider,
    extractModel,
    diagPrompt,
    diagVersion,
    initial,
    sections,
    status,
  } = input

  const extractionLegacy = getNested(initial, "extraction")
  const diagnosisLegacy = getNested(initial, "diagnosis")

  // fieldDefinitions: preservar de initial V2 si existen.
  // Fase 6: exponer editor de fieldDefinitions completo (unit/referenceRange/aliases).
  const fieldDefinitionsRaw = initial?.fieldDefinitions
  const fieldDefinitions: FieldDefinition[] = Array.isArray(fieldDefinitionsRaw)
    ? (fieldDefinitionsRaw as unknown as FieldDefinition[])
    : []

  // presentation: preservar de initial V2 si existe.
  // Fase 6: exponer editor de presentation.schema editable como contrato.
  const presentation = coercePresentationV3(getNested(initial, "presentation"))

  // clinicalCriteria: solo si sections.showClinicalCriteria (clinical_interpretation
  // o legacy sin operationMode). Para document_extraction es null (CB-14).
  // Fase 6: exponer requiredParams/confidenceThreshold/supportingReferences editables.
  let clinicalCriteria: ClinicalCriteria | null = null
  if (sections.showClinicalCriteria) {
    const prediagnosisEnabled = diagnosisLegacy ? getBool(diagnosisLegacy, "enabled") : true
    const reqParamsRaw = diagnosisLegacy?.requiredParams
    const requiredParams = Array.isArray(reqParamsRaw)
      ? reqParamsRaw.filter((item): item is string => typeof item === "string")
      : []
    const thresholdRaw = diagnosisLegacy?.confidenceThreshold
    const confidenceThreshold =
      typeof thresholdRaw === "number" && Number.isFinite(thresholdRaw)
        ? thresholdRaw
        : null
    const refsRaw = diagnosisLegacy?.supportingReferences
    const supportingReferences = Array.isArray(refsRaw)
      ? (refsRaw as ClinicalCriteria["supportingReferences"])
      : undefined
    clinicalCriteria = {
      prediagnosisEnabled,
      requiredParams,
      confidenceThreshold,
      prompt: diagPrompt || null,
      promptVersion: diagVersion || null,
      promptHash: null,
      ...(supportingReferences ? { supportingReferences } : {}),
    }
  }

  return {
    status: status ?? "draft",
    label: "cal-v3-draft",
    enabled,
    canonicalStudyType: canonicalStudyType.trim() || null,
    extraction: {
      enabled: getBool(extractionLegacy, "enabled") || Boolean(extractPrompt.trim()),
      prompt: extractPrompt || null,
      version: extractVersion || null,
      schemaVersion: extractVersion || null,
      provider: extractProvider,
      model: extractModel.trim() || null,
      targetFields: [], // Fase 6: exponer targetFields editables
    },
    fieldDefinitions,
    clinicalCriteria,
    presentation,
    // updatedAt lo fija saveAICalibrationV3 (server-side, tamper-safe).
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function AICalibrationEditor({ testId, initial, operationMode, initialStatus, onSaved }: AICalibrationEditorProps) {
  // ARCH-20260820-01 Fase 2: editor condicional por operationMode.
  // El early return para manual_service va DESPUÉS de los hooks (ver abajo)
  // para cumplir react-hooks/rules-of-hooks.
  const sections = getEditorSectionsForOperationMode(operationMode)

  const extraction = getNested(initial, "extraction")
  const diagnosis = getNested(initial, "diagnosis")
  const rawExtractVersion = getStr(extraction, "version") || getStr(extraction, "schemaVersion")
  const rawExtractPrompt = getStr(extraction, "prompt")
  const rawDiagVersion = getStr(diagnosis, "version") || getStr(diagnosis, "promptVersion")
  const rawDiagPrompt = getStr(diagnosis, "prompt")

  const initialExtractPrompt = rawExtractPrompt || (looksLikePromptContent(rawExtractVersion) ? rawExtractVersion : "")
  const initialExtractVersion = looksLikePromptContent(rawExtractVersion) ? "" : rawExtractVersion
  const initialDiagPrompt = rawDiagPrompt || (looksLikePromptContent(rawDiagVersion) ? rawDiagVersion : "")
  const initialDiagVersion = looksLikePromptContent(rawDiagVersion) ? "" : rawDiagVersion

  const rawExtractProvider = extraction?.provider
  const initialExtractProvider: ExtractionProvider = isExtractionProvider(rawExtractProvider)
    ? rawExtractProvider
    : "m3"
  const initialExtractModel = getStr(extraction, "model")

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [selectedOperationMode, setSelectedOperationMode] = useState<OperationMode>(
    operationMode ?? "clinical_interpretation",
  )
  const [enabled, setEnabled] = useState(
    initial ? getBool(initial, "enabled") : true,
  )
  const [canonicalStudyType, setCanonicalStudyType] = useState(getStr(initial, "canonicalStudyType"))

  // Extracción: se lee schemaVersion por compatibilidad con configs previas
  const [extractPromptVersion, setExtractPromptVersion] = useState(initialExtractVersion)
  const [extractPrompt, setExtractPrompt] = useState(initialExtractPrompt)
  // ARCH-20260809-02: provider + model editables para el selector multi-proveedor.
  const [extractProvider, setExtractProvider] = useState<ExtractionProvider>(initialExtractProvider)
  const [extractModel, setExtractModel] = useState(initialExtractModel)
  // Diagnóstico clínico
  const [diagPromptVersion, setDiagPromptVersion] = useState(initialDiagVersion)
  const [diagPrompt, setDiagPrompt] = useState(initialDiagPrompt)

  // ── Estado de la acción ────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  // ARCH-20260820-01 Fase 2B (AC-2B.4): selección de status del draft al guardar.
  // Default `initialStatus` (provisto por el workspace) o `"draft"`.
  const [saveStatus, setSaveStatus] = useState<"draft" | "tested">(initialStatus ?? "draft")

  // AC-2.6 / DEC-20260820-02: manual_service no muestra editor de calibración IA.
  // El early return va aquí (después de todos los hooks) para cumplir
  // react-hooks/rules-of-hooks.
  if (sections === null) {
    return (
      <div
        className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600"
        data-testid="ai-calibration-editor-disabled-manual-service"
        role="status"
      >
        Esta prueba tiene <code className="font-mono">operationMode=manual_service</code>.
        Los servicios manuales no admiten calibración IA (DEC-20260820-02).
      </div>
    )
  }

  // Tras el early return de manual_service, sections es EditorSections (no null).
  // TS no narrow dentro de closures (handleSubmit), así que fijamos el tipo aquí.
  const editorSections: EditorSections = sections

  // ── Submit ─────────────────────────────────────────────────────────────────
  const effectiveSections = getEditorSectionsForOperationMode(
    operationMode ?? selectedOperationMode,
  ) ?? editorSections

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const normalizedExtractPrompt = extractPrompt.trim() || (looksLikePromptContent(extractPromptVersion) ? extractPromptVersion.trim() : "")
    const normalizedExtractVersion = looksLikePromptContent(extractPromptVersion) ? "" : extractPromptVersion.trim()
    const normalizedDiagPrompt = diagPrompt.trim() || (looksLikePromptContent(diagPromptVersion) ? diagPromptVersion.trim() : "")
    const normalizedDiagVersion = looksLikePromptContent(diagPromptVersion) ? "" : diagPromptVersion.trim()

    const draftV3 = buildDraftV3FromEditorState({
      enabled,
      canonicalStudyType,
      extractPrompt: normalizedExtractPrompt,
      extractVersion: normalizedExtractVersion,
      extractProvider,
      extractModel,
      diagPrompt: normalizedDiagPrompt,
      diagVersion: normalizedDiagVersion,
      initial,
      operationMode: operationMode ?? selectedOperationMode,
      sections: effectiveSections,
      status: saveStatus,
    })

    startTransition(async () => {
      const result = await saveAICalibrationV3(
        testId,
        draftV3,
        operationMode ?? selectedOperationMode,
      )
      if (result.ok) {
        setMessage({
          type: "success",
          text:
            saveStatus === "tested"
              ? "Borrador probado guardado en base de datos. Publícalo para activarlo en estudios."
              : "Borrador guardado en base de datos.",
        })
        onSaved?.(saveStatus)
      } else {
        setMessage({ type: "error", text: result.error ?? "Error al guardar." })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-label="Editor de calibración IA">
      {/* Nota si es configuración nueva */}
      {!initial && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <span>⚠</span>
          <span>
            Esta prueba aún no tiene <code className="font-mono">aiCalibration</code>. Al guardar se creará
            la configuración inicial en <code className="font-mono">MedicalTest.options</code>.
          </span>
        </div>
      )}

      {/* Feedback de la acción */}
      {message && (
        <div
          role="alert"
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.type === "success" ? "✓ " : "✗ "}
          {message.text}
        </div>
      )}

      {looksLikePromptContent(rawExtractVersion) && !rawExtractPrompt && (
        <div className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
          ⚠ Se detectó un prompt legacy guardado en la versión de extracción. El editor ya lo movió al bloque específico; al guardar, la migración quedará persistida.
        </div>
      )}

      {/* ── General ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-600 tracking-wide">General</p>

        <div className="flex items-center gap-3">
          <input
            id="cal-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
          />
          <label htmlFor="cal-enabled" className="text-sm text-slate-700 select-none">
            Calibración IA activa
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-600 mb-1" htmlFor="operation-mode-select">
              Modo operativo
            </label>
            <select
              id="operation-mode-select"
              value={selectedOperationMode}
              onChange={(e) => {
                const val = e.target.value as OperationMode
                setSelectedOperationMode(val)
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="clinical_interpretation">Extracción y prediagnóstico IA</option>
              <option value="document_extraction">Solo extracción documental</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1" htmlFor="canonical-study-type">
              Tipo de estudio canónico
            </label>
            <input
              id="canonical-study-type"
              type="text"
              list="canonical-study-types-list"
              value={canonicalStudyType}
              onChange={(e) => setCanonicalStudyType(e.target.value)}
              placeholder="ej. Rayos_X, Espirometria, Audiometria"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <datalist id="canonical-study-types-list">
              <option value="Rayos_X" />
              <option value="Espirometria" />
              <option value="Audiometria" />
              <option value="Electrocardiograma" />
              <option value="Laboratorio" />
              <option value="Campimetria" />
              <option value="Somatometria" />
              <option value="AgudezaVisual" />
              <option value="ExamenMedico" />
              <option value="RiesgoCardiovascular" />
              <option value="Otro" />
            </datalist>
          </div>
        </div>
      </div>

      {/* ── Extracción documental — MiniMax M3 ────────────────────────────── */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-blue-700 tracking-wide">Extracción documental</p>
          <span
            className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200"
            data-testid="extraction-provider-badge"
          >
            {extractProvider === "m3" ? "MiniMax M3" : "Gemini"}
          </span>
        </div>
        <p className="text-xs text-blue-700">
          Este prompt se envía tal cual al modelo de extracción (única fuente de verdad en base de datos, sin textos ni guardrails ocultos en código).
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-600 mb-1" htmlFor="extract-provider">
              Proveedor de extracción
            </label>
            <select
              id="extract-provider"
              value={extractProvider}
              onChange={(e) => {
                const next = e.target.value as ExtractionProvider
                if (isExtractionProvider(next)) setExtractProvider(next)
              }}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {EXTRACTION_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p === "m3" ? "M3 (MiniMax)" : "Gemini"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1" htmlFor="extract-model">
              Modelo de extracción
            </label>
            <input
              id="extract-model"
              type="text"
              value={extractModel}
              onChange={(e) => setExtractModel(e.target.value)}
              placeholder={EXTRACTION_MODEL_PLACEHOLDERS[extractProvider]}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1" htmlFor="extract-prompt-version">
            Versión de prompt de extracción
          </label>
          <input
            id="extract-prompt-version"
            type="text"
            value={extractPromptVersion}
            onChange={(e) => setExtractPromptVersion(e.target.value)}
            placeholder="ej. extract-audio-gemini-v2"
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-slate-600" htmlFor="extract-prompt">
              Prompt completo de extracción
            </label>
            <button
              type="button"
              onClick={() => setExtractPrompt(EXTRACTION_PROMPT_TEMPLATE)}
              className="text-xs font-medium text-blue-700 hover:text-blue-800"
            >
              Cargar plantilla
            </button>
          </div>
          <textarea
            id="extract-prompt"
            value={extractPrompt}
            onChange={(e) => setExtractPrompt(e.target.value)}
            rows={12}
            placeholder="Escribe aquí el prompt completo de extracción JSON para esta prueba."
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-blue-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-blue-700 tracking-wide">Plantilla sugerida</p>
            <pre className="whitespace-pre-wrap text-[11px] leading-5 text-slate-600 font-mono">{EXTRACTION_PROMPT_TEMPLATE}</pre>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-blue-700 tracking-wide">Guía para redactar el prompt</p>
            <pre className="whitespace-pre-wrap text-[11px] leading-5 text-slate-600 font-mono">{CALIBRATION_REQUEST_TEMPLATE}</pre>
          </div>
        </div>
      </div>

      {/* ── Prediagnóstico clínico ─────────────────────────────────────────── */}
      {effectiveSections.showClinicalCriteria && (
        <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl space-y-3" data-testid="ai-calibration-clinical-section">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-violet-700 tracking-wide">Prediagnóstico clínico</p>
            <span className="text-xs font-medium px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full border border-violet-200">MiniMax M3</span>
          </div>
          <p className="text-xs text-violet-700">
            Prompt único que la IA clínica usa para interpretar los parámetros extraídos de esta prueba (sin respaldos hardcodeados en código). Incluye <code className="font-mono">{"{extracted_json}"}</code> donde desees insertar los datos.
          </p>

          <div>
            <label className="block text-xs text-slate-600 mb-1" htmlFor="diag-prompt-version">
              Versión de prompt de prediagnóstico
            </label>
            <input
              id="diag-prompt-version"
              type="text"
              value={diagPromptVersion}
              onChange={(e) => setDiagPromptVersion(e.target.value)}
              placeholder="ej. predx-rx-columna-v1"
              className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1" htmlFor="diag-prompt">
              Prompt completo de prediagnóstico
            </label>
            <textarea
              id="diag-prompt"
              value={diagPrompt}
              onChange={(e) => setDiagPrompt(e.target.value)}
              rows={8}
              placeholder="Escribe aquí el prompt clínico de prediagnóstico para esta prueba."
              className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
        </div>
      )}

      {/* ── Acción ──────────────────────────────────────────────────────────── */}
      {/* ARCH-20260820-01 Fase 2B (AC-2B.4): selección de status al guardar. */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <p className="text-xs font-semibold text-slate-600 tracking-wide">Guardar como</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="cal-save-status"
              value="draft"
              checked={saveStatus === "draft"}
              onChange={() => setSaveStatus("draft")}
              className="h-4 w-4 border-slate-300 text-violet-600 focus:ring-violet-400"
              data-testid="cal-save-status-draft"
            />
            <span>Borrador (<code className="font-mono">draft</code>)</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="cal-save-status"
              value="tested"
              checked={saveStatus === "tested"}
              onChange={() => setSaveStatus("tested")}
              className="h-4 w-4 border-slate-300 text-violet-600 focus:ring-violet-400"
              data-testid="cal-save-status-tested"
            />
            <span>Probado (<code className="font-mono">tested</code>)</span>
          </label>
        </div>
        <p className="text-xs text-slate-500">
          <code className="font-mono">tested</code> es el estado requerido para publicar (gate G0+ de <code className="font-mono">publishAICalibrationV3</code>).
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-sm font-semibold transition-colors"
        >
          {isPending ? "Guardando…" : "Guardar calibración"}
        </button>
        {isPending && (
          <span className="text-xs text-slate-400 animate-pulse">Actualizando configuración…</span>
        )}
      </div>
    </form>
  )
}
