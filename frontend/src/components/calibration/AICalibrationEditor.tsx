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
}

const EXTRACTION_PROMPT_TEMPLATE = `REGLAS ESPECIFICAS DEL ESTUDIO: {{nombre_del_estudio}}

OBJETIVO ESPECIFICO
Extraer todos los datos visibles de este estudio con precision literal y exhaustividad, sin interpretacion clinica.

CAMPOS CRITICOS
- identificacion del paciente
- fecha y hora del estudio
- equipo, software y condiciones tecnicas
- tabla principal de parametros
- referencias, LLN y porcentajes del predicho
- notas de calidad tecnica

SINONIMOS Y LABELS EQUIVALENTES
- lista aqui labels reales y sus equivalencias canonicas

REGLAS ESPECIFICAS DE TABLAS
- indica filas, columnas y variantes que nunca deben omitirse

REGLAS ESPECIFICAS DE CALIDAD
- indica como capturar repetibilidad, interpretabilidad o completitud documental

CAMPOS QUE NUNCA DEBEN OMITIRSE SI ESTAN VISIBLES
- agrega aqui los campos que suelen perderse

CAMPOS FRECUENTEMENTE OLVIDADOS
- agrega aqui secundarios importantes del estudio`

const CALIBRATION_REQUEST_TEMPLATE = `Genera un bloque especifico de extraccion para {{nombre_del_estudio}}.

Necesito que complemente una base universal ya existente en backend.
No repitas reglas generales de no invencion o salida JSON.
Enfocate solo en:
- campos criticos
- labels y sinonimos reales
- reglas de tablas
- reglas de calidad
- campos que nunca deben omitirse
- datos medicos tecnicos visibles que suelen perderse

No hagas interpretacion clinica. Solo extraccion precisa y exhaustiva.`

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
  m3: "MiniMax-M3",
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
    clinicalCriteria = {
      prediagnosisEnabled,
      requiredParams: [],
      confidenceThreshold: null,
      prompt: diagPrompt || null,
      promptVersion: diagVersion || null,
      promptHash: null,
    }
  }

  return {
    status: "draft",
    label: "cal-v3-draft",
    enabled,
    canonicalStudyType: canonicalStudyType.trim() || null,
    extraction: {
      enabled: getBool(extractionLegacy, "enabled"),
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

export default function AICalibrationEditor({ testId, initial, operationMode }: AICalibrationEditorProps) {
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

  // ARCH-20260809-02: estado del selector de proveedor extractivo.
  // Default "gemini" si ausente (migración legacy implícita).
  const rawExtractProvider = extraction?.provider
  const initialExtractProvider: ExtractionProvider = isExtractionProvider(rawExtractProvider)
    ? rawExtractProvider
    : "gemini"
  const initialExtractModel = getStr(extraction, "model")

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(getBool(initial, "enabled"))
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
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const normalizedExtractPrompt = extractPrompt.trim() || (looksLikePromptContent(extractPromptVersion) ? extractPromptVersion.trim() : "")
    const normalizedExtractVersion = looksLikePromptContent(extractPromptVersion) ? "" : extractPromptVersion.trim()
    const normalizedDiagPrompt = diagPrompt.trim() || (looksLikePromptContent(diagPromptVersion) ? diagPromptVersion.trim() : "")
    const normalizedDiagVersion = looksLikePromptContent(diagPromptVersion) ? "" : diagPromptVersion.trim()

    // F-2.2 (QA-20260820-03, AC-2.1): el editor construye un draft V3 y persiste
    // vía saveAICalibrationV3 (no saveAICalibration V1). El mapeo V1/V2 → V3
    // vive en buildDraftV3FromEditorState. Campos V3 no expuestos en UI se
    // documentan como Fase 6 dentro del helper.
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
      operationMode,
      sections: editorSections,
    })

    startTransition(async () => {
      const result = await saveAICalibrationV3(testId, draftV3)
      if (result.ok) {
        setMessage({ type: "success", text: "Configuración guardada correctamente." })
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
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">General</p>

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

        <div>
          <label className="block text-xs text-slate-600 mb-1" htmlFor="canonical-study-type">
            Tipo de estudio canónico
          </label>
          <input
            id="canonical-study-type"
            type="text"
            value={canonicalStudyType}
            onChange={(e) => setCanonicalStudyType(e.target.value)}
            placeholder="ej. LABORATORIO_GENERAL"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>
      </div>

      {/* ── Extracción documental — Gemini / MiniMax M3 ────────────────────── */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Extracción documental</p>
          {/*
            ARCH-20260809-02: badge dinámico según el proveedor seleccionado.
            Si es M3, mostramos "M3" con la misma paleta para mantener coherencia visual.
          */}
          <span
            className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200"
            data-testid="extraction-provider-badge"
          >
            {extractProvider === "m3" ? "M3 (MiniMax)" : "Gemini"}
          </span>
        </div>
        <p className="text-xs text-blue-600">
          El backend ya aporta una base universal fija de extracción médica. Aquí captura solo el bloque específico del estudio.
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
              Bloque específico de extracción
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
            placeholder="Pega aqui solo las reglas particulares del estudio. La base universal ya vive en backend."
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-blue-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-blue-700 uppercase tracking-wide">Plantilla sugerida</p>
            <pre className="whitespace-pre-wrap text-[11px] leading-5 text-slate-600 font-mono">{EXTRACTION_PROMPT_TEMPLATE}</pre>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-blue-700 uppercase tracking-wide">Qué pedirle a Copilot</p>
            <pre className="whitespace-pre-wrap text-[11px] leading-5 text-slate-600 font-mono">{CALIBRATION_REQUEST_TEMPLATE}</pre>
          </div>
        </div>
      </div>

      {/* ── Diagnóstico clínico — MedGemma ──────────────────────────────────── */}
      {/* ARCH-20260820-01 Fase 2: sección condicional por operationMode.
          Para document_extraction no se muestra (CB-14: clinicalCriteria=null). */}
      {sections.showClinicalCriteria && (
        <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl space-y-3" data-testid="ai-calibration-clinical-section">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Diagnóstico clínico</p>
            <span className="text-xs font-medium px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full border border-violet-200">MedGemma</span>
          </div>
          <p className="text-xs text-violet-600">Prompt y versión que MedGemma usa para interpretar los datos y generar el prediagnóstico.</p>

          <div>
            <label className="block text-xs text-slate-600 mb-1" htmlFor="diag-prompt-version">
              Versión de prompt de diagnóstico
            </label>
            <input
              id="diag-prompt-version"
              type="text"
              value={diagPromptVersion}
              onChange={(e) => setDiagPromptVersion(e.target.value)}
              placeholder="ej. predx-audio-medgemma-v2"
              className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1" htmlFor="diag-prompt">
              Prompt clínico específico
            </label>
            <textarea
              id="diag-prompt"
              value={diagPrompt}
              onChange={(e) => setDiagPrompt(e.target.value)}
              rows={8}
              placeholder="Pega aqui el prompt clínico específico del estudio para MedGemma."
              className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
        </div>
      )}

      {/* ── Acción ──────────────────────────────────────────────────────────── */}
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
