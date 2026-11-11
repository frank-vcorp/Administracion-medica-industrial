/**
 * @fileoverview Estudio especializado: Agudeza Visual.
 * Opera como EventTest independiente dentro de la Papeleta de Estudios.
 * Extrae la lógica de captura del TriageForm global (eliminado del Paso 2).
 * @id IMPL-20260325-05
 * @spec ARCH-20260325-05
 * @backup context/checkpoints/CHK_IMPL-20260325-05_SEPARACION-SOMATOMETRIA.md
 */
"use client"

import { useCallback, useMemo, useState } from "react"
import { updateAgudezaVisual } from "@/actions/medical-exam.actions"
import { updateEventTestStatus } from "@/actions/event-test.actions"
import { ClinicalAutosaveIndicator } from "@/components/clinical/ClinicalAutosaveIndicator"
import { UserFacingErrorCallout } from "@/components/clinical/UserFacingErrorCallout"
import {
  StudyCaptureFieldLabel,
  StudyCaptureMissingBanner,
  studyCaptureInputClass,
} from "@/components/clinical/studies/StudyCaptureUi"
import { useStudyLeaveGuard } from "@/components/clinical/studies/useStudyLeaveGuard"
import type { StudyLeaveGuardFn } from "@/components/clinical/studies/useStudyLeaveGuard"
import { useClinicalIntervalAutosave } from "@/lib/hooks/useClinicalIntervalAutosave"
import { mapMedicalExamActionFailure, parseMedicalExamZodIssues } from "@/lib/medical-exam-action-errors"
import {
  formatStudyMissingFieldsSpanish,
  isStudyRequiredField,
  studyValidationToFieldErrors,
  validateStudyCaptureForComplete,
} from "@/lib/clinical/study-required-fields"
import { splitUserFacingMessageLines, type UserFacingError } from "@/lib/user-facing-error"
// IMPL-20260817-01-C1 (ARCH-20260817-01 corte 1): se adopta el catálogo ZIN
// para los 8 campos de visión (Snellen) + 3 pruebas complementarias.
// Ver SPEC §4.1.
import {
  REFLEJOS_VALUES,
  CAMPIMETRIA_VALUES,
  TEST_ISHIHARA_VALUES,
} from "@/schemas/clinical/exam.schema"
import {
  deriveAgudezaVisualResumen,
  VISION_SNELLEN_NO_APLICA,
  visionFieldSelectOptions,
} from "@/lib/clinical/agudeza-visual"

const VISUAL_FIELDS = [
  { name: 'vision_lejana_od', label: 'Visión Lejana OD' },
  { name: 'vision_lejana_oi', label: 'Visión Lejana OI' },
  { name: 'vision_cercana_od', label: 'Visión Cercana OD' },
  { name: 'vision_cercana_oi', label: 'Visión Cercana OI' },
  { name: 'lejana_corregida_od', label: 'Lejana Corregida OD' },
  { name: 'lejana_corregida_oi', label: 'Lejana Corregida OI' },
  { name: 'cercana_corregida_od', label: 'Cercana Corregida OD' },
  { name: 'cercana_corregida_oi', label: 'Cercana Corregida OI' },
]

const NO_APLICA = VISION_SNELLEN_NO_APLICA

interface AgudezaVisualStudyProps {
  eventId: string
  eventTestId: string
  initialData?: Record<string, unknown> | null
  readonly?: boolean
  onStatusChange?: (status: string) => void
  registerLeaveGuard?: (fn: StudyLeaveGuardFn | null) => void
}

export default function AgudezaVisualStudy({
  eventId,
  eventTestId,
  initialData = null,
  readonly = false,
  onStatusChange,
  registerLeaveGuard,
}: AgudezaVisualStudyProps) {
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {
      ...Object.fromEntries(VISUAL_FIELDS.map(f => [f.name, NO_APLICA])),
      reflejos: REFLEJOS_VALUES[0],
      campimetria: CAMPIMETRIA_VALUES[0],
      test_ishihara: TEST_ISHIHARA_VALUES[0],
      ...Object.fromEntries(
        Object.entries(initialData ?? {}).map(([k, v]) => [k, String(v ?? '')]),
      ),
    }
    if (!base.campimetria.trim()) base.campimetria = CAMPIMETRIA_VALUES[0]
    if (!base.test_ishihara.trim()) base.test_ishihara = TEST_ISHIHARA_VALUES[0]
    if (!base.reflejos.trim()) base.reflejos = REFLEJOS_VALUES[0]
    return base
  })
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [aiWarning, setAiWarning] = useState("")
  const [saveError, setSaveError] = useState<UserFacingError | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [completeBanner, setCompleteBanner] = useState("")

  const derivedResumen = useMemo(
    () =>
      deriveAgudezaVisualResumen(
        formData.vision_lejana_od,
        formData.vision_lejana_oi,
      ),
    [formData.vision_lejana_od, formData.vision_lejana_oi],
  )

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    setFieldErrors(prev => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
    setCompleteBanner("")
  }

  const evaluateComplete = useCallback(
    () => validateStudyCaptureForComplete('AgudezaVisual', formData),
    [formData],
  )

  useStudyLeaveGuard(registerLeaveGuard, evaluateComplete, !readonly)

  const snapshotKey = useMemo(() => JSON.stringify(formData), [formData])

  const persistDraft = useCallback(async () => {
    const res = await updateAgudezaVisual(eventId, formData, { autosave: true })
    if (!res.success) {
      return {
        ok: false,
        message: res.error,
        error: parseMedicalExamZodIssues(res.technicalDetail) ?? res.technicalDetail,
        context: 'Agudeza visual (autoguardado)',
      } as const
    }
    return true
  }, [eventId, formData])

  const { statusLabel: autosaveLabel, markSaved, userFacingError: autosaveError } = useClinicalIntervalAutosave({
    enabled: !readonly,
    snapshotKey,
    save: persistDraft,
  })

  const err = (field: string) => fieldErrors[field]?.[0]

  const handleSave = async (markComplete: boolean) => {
    setIsSaving(true)
    setMessage("")
    setAiWarning("")
    setSaveError(null)
    setCompleteBanner("")

    if (markComplete) {
      const gate = evaluateComplete()
      if (!gate.ok) {
        setFieldErrors(studyValidationToFieldErrors(gate))
        setCompleteBanner(formatStudyMissingFieldsSpanish(gate.missing))
        setMessage("❌ No se puede completar el estudio.")
        setIsSaving(false)
        return
      }
    }

    const res = await updateAgudezaVisual(eventId, formData)
    if (res.success) {
      markSaved()
      if (markComplete) {
        const statusRes = await updateEventTestStatus(eventTestId, 'COMPLETED', eventId)
        if (!statusRes.success) {
          setCompleteBanner(statusRes.error ?? 'No se pudo cerrar el estudio.')
          setMessage("❌ No se pudo completar.")
          setIsSaving(false)
          return
        }
        onStatusChange?.('COMPLETED')
        setMessage("🏁 Agudeza Visual completada.")
      } else {
        await updateEventTestStatus(eventTestId, 'RESULT_REGISTERED', eventId)
        onStatusChange?.('RESULT_REGISTERED')
        setMessage("✅ Datos guardados.")
      }
      if (res.aiWarning) {
        setAiWarning(`La captura clínica se guardó, pero la IA no pudo generar prediagnóstico: ${res.aiWarning}`)
      }
    } else {
      const mapped = mapMedicalExamActionFailure(
        {
          success: false,
          error: res.error ?? 'No se pudo guardar',
          technicalDetail: res.technicalDetail,
        },
        markComplete ? 'Agudeza visual (completar)' : 'Agudeza visual (guardado)',
      )
      setSaveError(mapped)
      const line = splitUserFacingMessageLines(mapped.userMessage)[0] ?? mapped.userMessage
      setMessage(`❌ ${mapped.title}: ${line}`)
    }
    setIsSaving(false)
  }

  return (
    <div className="space-y-5">
      {!readonly && (
        <ClinicalAutosaveIndicator label={autosaveLabel} error={autosaveError} />
      )}
      {saveError && <UserFacingErrorCallout mapped={saveError} className="border-red-200 bg-red-50/90" />}
      <StudyCaptureMissingBanner message={completeBanner} />
      <p className="text-[11px] text-slate-500">
        Los campos con <span className="text-red-500">*</span> son obligatorios para completar la prueba.
      </p>
      {/* Campo Visual */}
      <div>
        <h4 className="text-sm font-semibold text-slate-600 mb-3 border-b pb-2">Campo Visual</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {VISUAL_FIELDS.map(f => (
            <div key={f.name}>
              <StudyCaptureFieldLabel required={isStudyRequiredField('AgudezaVisual', f.name)}>
                {f.label}
              </StudyCaptureFieldLabel>
              <select
                value={formData[f.name] || NO_APLICA}
                onChange={e => handleChange(f.name, e.target.value)}
                disabled={readonly}
                className={studyCaptureInputClass(
                  Boolean(err(f.name)),
                  'w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono text-sm disabled:opacity-60',
                )}
              >
                {visionFieldSelectOptions(f.name, formData[f.name]).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {err(f.name) && <p className="text-[10px] text-red-600 mt-1">{err(f.name)}</p>}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
          <p className="text-[10px] font-bold text-blue-500">
            Clasificación agudeza visual (automática)
          </p>
          <p className="mt-1 text-sm font-semibold text-blue-900">
            {derivedResumen || 'Complete visión lejana OD/OI para clasificar'}
          </p>
        </div>
      </div>

      {/* Pruebas Complementarias */}
      <div>
        <h4 className="text-sm font-semibold text-slate-600 mb-3 border-b pb-2">Pruebas Complementarias</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Campimetría</label>
            <select
              value={formData.campimetria || CAMPIMETRIA_VALUES[0]}
              onChange={e => handleChange('campimetria', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60"
            >
              {CAMPIMETRIA_VALUES.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Test Ishihara</label>
            <select
              value={formData.test_ishihara || TEST_ISHIHARA_VALUES[0]}
              onChange={e => handleChange('test_ishihara', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60"
            >
              {TEST_ISHIHARA_VALUES.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Reflejos</label>
            <select
              value={formData.reflejos || REFLEJOS_VALUES[0]}
              onChange={e => handleChange('reflejos', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60"
            >
              {REFLEJOS_VALUES.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3 flex-wrap">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500">{message}</p>
          {aiWarning && (
            <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-xl">
              ⚠️ {aiWarning}
            </p>
          )}
        </div>
        {!readonly && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm"
            >
              {isSaving ? "Guardando..." : "Guardar borrador"}
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 text-sm"
            >
              {isSaving ? "Guardando..." : "✓ Completar Agudeza Visual"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
