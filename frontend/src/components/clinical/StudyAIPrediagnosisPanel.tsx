/**
 * @fileoverview Panel de Prediagnóstico IA por Estudio — modo sombra clínica
 * @id IMPL-20260326-16
 * @backup context/checkpoints/CHK_IMPL-20260326-16.md
 *
 * GUARDRAIL obligatorio (ARCH-20260326-16 §"Modo sombra clínica"):
 *   - Este panel NO sustituye el diagnóstico del médico.
 *   - El médico DEBE aceptar, editar o rechazar explícitamente antes de continuar.
 *   - El contenido IA NO puede propagarse a PDF oficial, dictamen ni aptitud.
 */
"use client"

import { useState, useTransition } from "react"
import { submitDoctorStudyReview } from "@/actions/ai-prediagnosis.actions"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface ClinicalBasisItem {
  principle: string
  applied_parameters: string[]
}

interface ClinicalCitation {
  source_id: string
  title: string
  section?: string
  excerpt?: string
  version_or_date?: string
}

interface AIPrediagnosisData {
  summary: string
  confidence: number
  clinical_state: string
  justification: string[]
  clinical_basis: ClinicalBasisItem[]
  citations: ClinicalCitation[]
  limitations: string[]
  red_flags: string[]
  // IMPL-20260516-06: Recomendación clínica prudente (ARCH-20260516-06)
  // Solo seguimiento/vigilancia/correlación. Optional para compatibilidad con snapshots viejos.
  // DEC-20260824-02 / IMPL-20260824-06: contrato vigente sólo aporta `recommendation`
  // singular; se acepta también `recommendations` (array) o `recommended_actions`
  // si un snapshot futuro o un proveedor clínico los emite. NO se inventan
  // datos en frontend: si ninguno está presente, la sección se omite.
  recommendation?: string | null
  recommendations?: string[] | null
  recommended_actions?: string[] | null
  non_conclusive_reason?: string | null
  calibration_source?: 'medical_calibration' | 'general_fallback' | null
  clinical_model_used?: string | null
  clinical_provider?: 'gemini' | 'featherless' | null
}

/**
 * IMPL-20260824-06 (DEC-20260824-02): unifica el campo de recomendaciones
 * preservando compat con snapshots viejos (sólo `recommendation` singular).
 *
 * Prioridad (importante — DEC-20260824-02 "no ocultes el contenido por un alias"):
 *   1. `recommendation` (singular) — campo vigente del contrato backend.
 *      Si está presente y no vacío, SIEMPRE gana. Un alias vacío
 *      (`recommendations: []` o `recommended_actions: []`) NO puede ocultar
 *      un `recommendation` válido.
 *   2. `recommendations: string[]` — alias opcional futuro.
 *   3. `recommended_actions: string[]` — alias opcional futuro.
 *
 * Devuelve `null` (sección omitida) sólo si los tres campos están vacíos.
 * NO se inventa contenido en frontend.
 *
 * IMPORTANTE para snapshots viejos sin `recommendation`: la sección se OMITE
 * silenciosamente. NO se infiere texto desde `summary` ni desde otra sección.
 * Esos snapshots requieren REPROCESO del Event para generar la recomendación
 * contextualizada (DEC-20260824-02 / IMPL-20260824-06 §pendientes ATLAS).
 */
function resolveRecommendations(
  predxData: AIPrediagnosisData
): string[] | null {
  // 1) `recommendation` (singular) — campo vigente del contrato backend.
  if (typeof predxData.recommendation === 'string' && predxData.recommendation.trim().length > 0) {
    return [predxData.recommendation.trim()]
  }
  // 2) `recommendations` (array) — alias opcional.
  if (Array.isArray(predxData.recommendations) && predxData.recommendations.length > 0) {
    const filtered = predxData.recommendations.filter(
      (r) => typeof r === 'string' && r.trim().length > 0
    )
    if (filtered.length > 0) return filtered
  }
  // 3) `recommended_actions` (array) — alias opcional.
  if (Array.isArray(predxData.recommended_actions) && predxData.recommended_actions.length > 0) {
    const filtered = predxData.recommended_actions.filter(
      (r) => typeof r === 'string' && r.trim().length > 0
    )
    if (filtered.length > 0) return filtered
  }
  return null
}

interface DoctorReviewSummary {
  id: string
  doctorStatus: string
  doctorDiagnosis: string | null
  doctorNotes: string | null
  createdAt: Date
}

interface AIPrediagnosisSnapshot {
  id: string
  version: number
  clinicalState: string
  createdAt: Date
  isSuperseded: boolean
  prediagnosisData: unknown
  doctorReviews: DoctorReviewSummary[]
}

interface StudyAIPrediagnosisPanelProps {
  /** ID del prediagnóstico vigente (para review) */
  prediagnosisSnapshotId: string
  /** Datos del prediagnóstico IA */
  snapshot: AIPrediagnosisSnapshot
  /** ID del médico que revisa */
  reviewerUserId: string
  /** ID del evento para revalidar */
  eventId: string
  /** Estado de revisión ya existente (si hay) */
  existingReview?: DoctorReviewSummary | null
  /** Si true, solo lectura */
  readonly?: boolean
}

// ---------------------------------------------------------------------------
// IMPL-20260326-04: Mapeo local explícito source_id → URL pública canónica.
// Solo se incluyen fuentes con URL verificada y estable.
// Si una cita no tiene entrada aquí, se muestra como texto sin romper UI.
// ---------------------------------------------------------------------------
const KNOWN_SOURCE_URLS: Record<string, string> = {
  // Espirometría — ATS/ERS 2022
  'ATS-ERS-2022': 'https://www.thoracic.org/professionals/clinical-resources/pulmonary-function-laboratories.php',
  // Radiología — ACR BI-RADS Atlas 2013
  'ACR-BIRADS-2013': 'https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Bi-Rads',
  // Cardiología — AHA/ACC ECG Guidelines
  'AHA-ECG-2022': 'https://professional.heart.org/en/guidelines-and-statements',
  // Somatometría — OMS clasificación IMC
  'OMS-IMC-2000': 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight',
}

function getCitationUrl(cite: ClinicalCitation): string | null {
  return KNOWN_SOURCE_URLS[cite.source_id] ?? null
}

// ---------------------------------------------------------------------------

const CLINICAL_STATE_LABELS: Record<string, { label: string; color: string }> = {
  AI_PENDING_REVIEW: {
    label: '⏳ Pendiente de revisión médica',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  AI_NON_CONCLUSIVE: {
    label: '⚠️ No concluyente — revisión obligatoria',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  REVIEWED_ACCEPTED: {
    label: '✅ Revisado y aceptado por médico',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  REVIEWED_EDITED: {
    label: '✏️ Revisado con edición médica',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  REVIEWED_REJECTED: {
    label: '❌ Sugerencia rechazada por médico',
    color: 'bg-red-50 text-red-700 border-red-200',
  },
  DRAFT_EXTRACTED: {
    label: '📋 Parámetros extraídos — sin prediagnóstico',
    color: 'bg-slate-50 text-slate-600 border-slate-200',
  },
}

function getStateDisplay(state: string) {
  return CLINICAL_STATE_LABELS[state] ?? {
    label: state,
    color: 'bg-slate-50 text-slate-600 border-slate-200',
  }
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 70 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-amber-400' :
    'bg-red-400'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulario de revisión médica
// ---------------------------------------------------------------------------

function DoctorReviewForm({
  prediagnosisSnapshotId,
  reviewerUserId,
  eventId,
  onSubmitted,
}: {
  prediagnosisSnapshotId: string
  reviewerUserId: string
  eventId: string
  onSubmitted: () => void
}) {
  const [status, setStatus] = useState<'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED' | 'REVIEWED_REJECTED'>('REVIEWED_ACCEPTED')
  const [doctorDiagnosis, setDoctorDiagnosis] = useState('')
  const [doctorNotes, setDoctorNotes] = useState('')
  const [aiAgreement, setAiAgreement] = useState<number | undefined>(undefined)
  const [aiUsefulness, setAiUsefulness] = useState<number | undefined>(undefined)
  const [differenceType, setDifferenceType] = useState('')
  const [errorSeverity, setErrorSeverity] = useState('none')
  const [errorCategory, setErrorCategory] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (status === 'REVIEWED_EDITED' && !doctorDiagnosis.trim()) {
      setError('Al editar, debes indicar el diagnóstico médico corregido.')
      return
    }

    startTransition(async () => {
      const result = await submitDoctorStudyReview({
        prediagnosisSnapshotId,
        doctorStatus: status,
        doctorDiagnosis: doctorDiagnosis || undefined,
        doctorNotes: doctorNotes || undefined,
        reviewedByUserId: reviewerUserId,
        aiAgreementScore: aiAgreement,
        aiUsefulnessScore: aiUsefulness,
        differenceType: differenceType || undefined,
        errorSeverity,
        errorCategory: errorCategory || undefined,
        eventId,
      })

      if (result.success) {
        onSubmitted()
      } else {
        setError(result.error || 'Error al guardar la revisión')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-slate-100">
      <h4 className="text-sm font-bold text-slate-700">Revisión médica obligatoria</h4>

      {/* Estado de revisión */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Decisión *</label>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ['REVIEWED_ACCEPTED', '✅ Acepto la sugerencia', 'border-emerald-300 bg-emerald-50 text-emerald-700'],
              ['REVIEWED_EDITED', '✏️ Edito el diagnóstico', 'border-blue-300 bg-blue-50 text-blue-700'],
              ['REVIEWED_REJECTED', '❌ Rechazo la sugerencia', 'border-red-300 bg-red-50 text-red-700'],
            ] as const
          ).map(([val, label, cls]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatus(val)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                status === val ? cls + ' shadow-sm' : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Diagnóstico médico (requerido si edita) */}
      {(status === 'REVIEWED_EDITED' || status === 'REVIEWED_ACCEPTED') && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Diagnóstico / hallazgo médico{status === 'REVIEWED_EDITED' ? ' *' : ' (opcional)'}
          </label>
          <textarea
            value={doctorDiagnosis}
            onChange={(e) => setDoctorDiagnosis(e.target.value)}
            rows={2}
            placeholder="Describa el diagnóstico o hallazgo desde su perspectiva clínica..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
          />
        </div>
      )}

      {/* Notas adicionales */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notas adicionales (opcional)</label>
        <textarea
          value={doctorNotes}
          onChange={(e) => setDoctorNotes(e.target.value)}
          rows={2}
          placeholder="Observaciones, contexto clínico, instrucciones de seguimiento..."
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-none resize-none"
        />
      </div>

      {/* Feedback comparativo IA vs médico */}
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-400 hover:text-slate-600 select-none">
          Feedback de calidad IA (opcional, ayuda a mejorar el sistema)
        </summary>
        <div className="pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Concordancia IA (0–100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={aiAgreement ?? ''}
                onChange={(e) => setAiAgreement(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Utilidad IA (0–100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={aiUsefulness ?? ''}
                onChange={(e) => setAiUsefulness(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-teal-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tipo de diferencia</label>
            <select
              value={differenceType}
              onChange={(e) => setDifferenceType(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none"
            >
              <option value="">— Selecciona —</option>
              <option value="same_conclusion">Misma conclusión</option>
              <option value="same_line_with_edits">Misma línea, con ediciones</option>
              <option value="different_conclusion">Conclusión diferente</option>
              <option value="ai_non_conclusive">IA no fue concluyente</option>
            </select>
          </div>
          {status === 'REVIEWED_REJECTED' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Severidad del error</label>
                <select
                  value={errorSeverity}
                  onChange={(e) => setErrorSeverity(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none"
                >
                  <option value="none">Sin error relevante</option>
                  <option value="low">Bajo</option>
                  <option value="medium">Medio</option>
                  <option value="high">Alto</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Categoría del error</label>
                <select
                  value={errorCategory}
                  onChange={(e) => setErrorCategory(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none"
                >
                  <option value="">— Selecciona —</option>
                  <option value="omission">Omisión de hallazgo</option>
                  <option value="wrong_interpretation">Interpretación incorrecta</option>
                  <option value="unsupported_claim">Afirmación sin respaldo</option>
                  <option value="low_document_quality">Calidad documental baja</option>
                  <option value="insufficient_context">Contexto insuficiente</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </details>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {isPending ? 'Guardando revisión...' : 'Guardar revisión médica'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function StudyAIPrediagnosisPanel({
  prediagnosisSnapshotId,
  snapshot,
  reviewerUserId,
  eventId,
  existingReview,
  readonly = false,
}: StudyAIPrediagnosisPanelProps) {
  const [reviewed, setReviewed] = useState(!!existingReview)
  const [showReviewForm, setShowReviewForm] = useState(false)

  const predxData = snapshot.prediagnosisData as AIPrediagnosisData | null
  if (!predxData) return null

  const stateDisplay = getStateDisplay(snapshot.clinicalState)
  const hasRedFlags = (predxData.red_flags ?? []).length > 0
  const isNonConclusive = snapshot.clinicalState === 'AI_NON_CONCLUSIVE'
  const isReviewed = reviewed || ['REVIEWED_ACCEPTED', 'REVIEWED_EDITED', 'REVIEWED_REJECTED'].includes(snapshot.clinicalState)
  const clinicalProvider = predxData.clinical_provider
  const clinicalModel = predxData.clinical_model_used
  // DEC-20260824-02 / IMPL-20260824-06: lista unificada de recomendaciones
  // (soporta singular/array legacy). Null si el snapshot no trae nada.
  //
  // Para snapshots VIEJOS sin `recommendation` (generados antes de este
  // incremento o con `prompt_source=backend_fallback` sin requisito explícito
  // de recommendation): `resolveRecommendations` devuelve null y la sección
  // se OMITE silenciosamente. NO se inventa contenido en frontend.
  // Esos snapshots requieren REPROCESO del Event (subir el archivo de
  // nuevo en la misma prueba, o re-procesarlo por el orquestador) para
  // que el nuevo prompt contextualizado (IMPL-20260824-06) genere
  // `recommendation` no nulo.
  const recommendationsList = resolveRecommendations(predxData)
  const medgemmaFailure = isNonConclusive && (
    clinicalProvider === 'featherless' ||
    /featherless|medgemma/i.test(predxData.non_conclusive_reason ?? '')
  )

  return (
    <div
      className="mt-4 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
      data-clinical-provider={clinicalProvider ?? undefined}
      data-clinical-model={clinicalModel ?? undefined}
      data-calibration-source={predxData.calibration_source ?? undefined}
      data-medgemma-failure={medgemmaFailure ? 'true' : undefined}
    >
      {/* Cabecera */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <div>
            <span className="text-sm font-bold text-slate-700">Prediagnóstico IA</span>
            <span className="ml-2 text-[10px] font-mono text-slate-400">v{snapshot.version}</span>
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${stateDisplay.color}`}>
          {stateDisplay.label}
        </span>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Guardrail visible */}
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ <strong>Modo sombra clínica:</strong> Este análisis es apoyo a la decisión.
          No autoriza diagnóstico final, dictamen ni aptitud laboral. El médico debe revisar y validar.
        </div>

        {/* Red flags prioritarios */}
        {hasRedFlags && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-[11px] font-bold text-red-700 mb-1">🚨 Alertas clínicas</p>
            <ul className="space-y-0.5">
              {predxData.red_flags.map((flag, i) => (
                <li key={i} className="text-xs text-red-700">• {flag}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Resumen — DEC-20260824-02 / IMPL-20260824-06: renombrado a "Hallazgo sugerido" */}
        <div data-testid="prediagnosis-section-hallazgo">
          <p className="text-xs font-semibold text-slate-500 mb-1">Hallazgo sugerido</p>
          <p className="text-sm text-slate-800 leading-relaxed">{predxData.summary}</p>
          {isNonConclusive && predxData.non_conclusive_reason && (
            <p className="text-xs text-orange-600 mt-1">Razón: {predxData.non_conclusive_reason}</p>
          )}
        </div>

        {/* DEC-20260824-02 / IMPL-20260824-06: Recomendaciones sugeridas
            contextualizadas (patrón/calidad/entorno ocupacional) antes de la
            confianza. Sección contextualizada por prediagnóstico, usando el
            campo `recommendation` singular del contrato vigente. Si el
            snapshot aporta `recommendations` (array) o `recommended_actions`,
            se renderizan como lista. NO se inventan datos en frontend: si el
            snapshot no trae ninguno, la sección se omite por completo. */}
        {recommendationsList && recommendationsList.length > 0 && (
          <div
            className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2.5"
            data-testid="prediagnosis-section-recomendaciones"
          >
            <p className="text-[11px] font-bold text-teal-700 mb-1">
              Recomendaciones sugeridas ({recommendationsList.length})
            </p>
            {recommendationsList.length === 1 ? (
              <p className="text-xs text-teal-800 leading-relaxed">{recommendationsList[0]}</p>
            ) : (
              <ul className="space-y-1">
                {recommendationsList.map((r, i) => (
                  <li
                    key={i}
                    className="text-xs text-teal-800 leading-relaxed pl-3 border-l-2 border-teal-300"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-teal-600/80 italic mt-1.5">
              Sugerencias de apoyo a la decisión; no sustituyen indicación médica, diagnóstico definitivo ni dictamen de aptitud.
            </p>
          </div>
        )}

        {/* Confianza — DEC-20260824-02 / IMPL-20260824-06: movido después de
            Hallazgo sugerido y Recomendaciones sugeridas. */}
        <div data-testid="prediagnosis-section-confianza">
          <p className="text-[11px] font-semibold text-slate-400 mb-1">Confianza del modelo</p>
          <ConfidenceBar confidence={predxData.confidence} />
        </div>

        {/* DEC-20260824-02 / IMPL-20260824-06: orden clínico final
              Hallazgo → Recomendaciones → Confianza → Limitaciones →
              Justificación → Fuentes clínicas. */}

        {/* Limitaciones */}
        {(predxData.limitations ?? []).length > 0 && (
          // IMPL-20260824-01 (FEATURE-20260824-01): inicia desplegada.
          // DEC-20260824-02 / IMPL-20260824-06: reubicada antes de Justificación
          // para que el médico lea primero las restricciones técnicas antes
          // de la narrativa causal.
          <details open data-testid="prediagnosis-section-limitaciones">
            <summary className="text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700 select-none">
              Limitaciones ({predxData.limitations.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {predxData.limitations.map((l, i) => (
                <li key={i} className="text-xs text-slate-500 pl-3 border-l-2 border-slate-200">{l}</li>
              ))}
            </ul>
          </details>
        )}

        {/* Justificación */}
        {(predxData.justification ?? []).length > 0 && (
          // IMPL-20260824-01 (FEATURE-20260824-01): inicia desplegada para que
          // el médico vea la trazabilidad IA sin clicks extra. El usuario puede
          // colapsarla manualmente; el contrato IA no cambia.
          // DEC-20260824-02 / IMPL-20260824-06: reubicada después de Limitaciones.
          <details open data-testid="prediagnosis-section-justificacion">
            <summary className="text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700 select-none">
              Justificación ({predxData.justification.length} razones)
            </summary>
            <ul className="mt-2 space-y-1">
              {predxData.justification.map((j, i) => (
                <li key={i} className="text-xs text-slate-600 pl-3 border-l-2 border-teal-200">{j}</li>
              ))}
            </ul>
          </details>
        )}

        {/* Citas clínicas — IMPL-20260326-04: fuentes con URL conocida son enlaces clicables */}
        {(predxData.citations ?? []).length > 0 && (
          // IMPL-20260824-01 (FEATURE-20260824-01): inicia desplegada.
          <details open data-testid="prediagnosis-section-fuentes">
            <summary className="text-[11px] font-semibold text-slate-400 cursor-pointer hover:text-slate-600 select-none">
              Fuentes clínicas ({predxData.citations.length})
            </summary>
            <div className="mt-2 space-y-2">
              {predxData.citations.map((cite, i) => {
                const url = getCitationUrl(cite)
                return (
                  <div key={i} className="text-[11px] bg-white border border-slate-100 rounded px-2 py-1.5">
                    <span className="font-mono font-bold text-teal-700">[{cite.source_id}]</span>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-teal-600 hover:text-teal-800 underline underline-offset-2"
                      >
                        {cite.title}
                      </a>
                    ) : (
                      <span className="ml-1 text-slate-600">{cite.title}</span>
                    )}
                    {cite.section && <span className="text-slate-400"> — {cite.section}</span>}
                    {cite.excerpt && (
                      <p className="text-slate-400 italic mt-0.5">&ldquo;{cite.excerpt}&rdquo;</p>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        )}

        {/* Revisión existente */}
        {isReviewed && existingReview && (
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-3">
            <p className="text-[11px] font-bold text-slate-500 mb-2">Revisión médica registrada</p>
            <p className="text-xs font-semibold text-slate-700">
              Decisión: <span className={
                existingReview.doctorStatus === 'REVIEWED_ACCEPTED' ? 'text-emerald-600' :
                existingReview.doctorStatus === 'REVIEWED_EDITED' ? 'text-blue-600' :
                'text-red-600'
              }>{existingReview.doctorStatus.replace('REVIEWED_', '')}</span>
            </p>
            {existingReview.doctorDiagnosis && (
              <p className="text-xs text-slate-600 mt-1">
                <strong>Diagnóstico médico:</strong> {existingReview.doctorDiagnosis}
              </p>
            )}
            {existingReview.doctorNotes && (
              <p className="text-xs text-slate-500 mt-1 italic">{existingReview.doctorNotes}</p>
            )}
          </div>
        )}

        {/* Formulario de revisión */}
        {!readonly && !isReviewed && (
          <>
            {!showReviewForm ? (
              <button
                onClick={() => setShowReviewForm(true)}
                className="w-full py-2 px-4 border-2 border-teal-500 text-teal-700 text-sm font-semibold rounded-lg hover:bg-teal-50 transition-colors"
              >
                Revisar y validar como médico →
              </button>
            ) : (
              <DoctorReviewForm
                prediagnosisSnapshotId={prediagnosisSnapshotId}
                reviewerUserId={reviewerUserId}
                eventId={eventId}
                onSubmitted={() => {
                  setReviewed(true)
                  setShowReviewForm(false)
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
