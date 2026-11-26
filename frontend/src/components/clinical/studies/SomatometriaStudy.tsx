/**
 * @fileoverview Estudio especializado: Somatometría y Signos Vitales.
 * Opera como EventTest independiente dentro de la Papeleta de Estudios.
 * Extrae la lógica de captura del TriageForm global (eliminado del Paso 2).
 * @id IMPL-20260325-05
 * @spec ARCH-20260325-05
 * @backup context/checkpoints/CHK_IMPL-20260325-05_SEPARACION-SOMATOMETRIA.md
 */
"use client"

import { useCallback, useMemo, useState } from "react"
import { updateSomatometria } from "@/actions/medical-exam.actions"
import { updateEventTestStatus } from "@/actions/event-test.actions"
import { ClinicalAutosaveIndicator } from "@/components/clinical/ClinicalAutosaveIndicator"
import { UserFacingErrorCallout } from "@/components/clinical/UserFacingErrorCallout"
import {
  EXAM_CARD_CLASS,
  EXAM_CARD_TITLE_CLASS,
  EXAM_NUMERIC_INPUT_CLASS,
} from '@/components/clinical/examen-medico/ExamSectionLayout'
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
import {
  computeBmi,
  complexionFromImc,
  formatTallaMetersForDisplay,
  formatTallaMetersWhileTyping,
} from '@/lib/clinical/talla-meters'

interface SomatometriaStudyProps {
  eventId: string
  eventTestId: string
  initialData?: Record<string, unknown> | null
  readonly?: boolean
  onStatusChange?: (status: string) => void
  registerLeaveGuard?: (fn: StudyLeaveGuardFn | null) => void
}

export default function SomatometriaStudy({
  eventId,
  eventTestId,
  initialData = null,
  readonly = false,
  onStatusChange,
  registerLeaveGuard,
}: SomatometriaStudyProps) {
  const [formData, setFormData] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initialData ?? {}).map(([k, v]) => [k, String(v ?? '')])
    )
  )
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [aiWarning, setAiWarning] = useState("")
  const [saveError, setSaveError] = useState<UserFacingError | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [completeBanner, setCompleteBanner] = useState("")

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      if (field === 'ta_sistolica' || field === 'fc_min') delete next._vitals
      return next
    })
    setCompleteBanner("")
  }

  const { imc, imcValue } = useMemo(
    () => computeBmi(formData.peso_kg, formData.talla_m),
    [formData.peso_kg, formData.talla_m],
  )
  const complexion = useMemo(() => complexionFromImc(imcValue), [imcValue])

  const buildPayload = useCallback(
    () => ({ ...formData, imc: parseFloat(imc), complexion }),
    [formData, imc, complexion],
  )

  const evaluateComplete = useCallback(
    () => validateStudyCaptureForComplete('Somatometria', buildPayload()),
    [buildPayload],
  )

  useStudyLeaveGuard(registerLeaveGuard, evaluateComplete, !readonly)

  const snapshotKey = useMemo(() => JSON.stringify(buildPayload()), [buildPayload])

  const persistDraft = useCallback(async () => {
    const res = await updateSomatometria(eventId, buildPayload(), { autosave: true })
    if (!res.success) {
      return {
        ok: false,
        message: res.error,
        error: parseMedicalExamZodIssues(res.technicalDetail) ?? res.technicalDetail,
        context: 'Somatometría (autoguardado)',
      } as const
    }
    return true
  }, [eventId, buildPayload])

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

    const payload = buildPayload()
    const res = await updateSomatometria(eventId, payload, { revalidate: false })
    if (res.success) {
      markSaved()
      if (markComplete) {
        const statusRes = await updateEventTestStatus(
          eventTestId,
          'COMPLETED',
          eventId,
          { revalidate: false },
        )
        if (!statusRes.success) {
          setCompleteBanner(statusRes.error ?? 'No se pudo cerrar el estudio.')
          setMessage("❌ No se pudo completar.")
          setIsSaving(false)
          return
        }
        onStatusChange?.('COMPLETED')
        setMessage("🏁 Somatometría completada.")
      } else {
        await updateEventTestStatus(
          eventTestId,
          'RESULT_REGISTERED',
          eventId,
          { revalidate: false },
        )
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
        markComplete ? 'Somatometría (completar)' : 'Somatometría (guardado)',
      )
      setSaveError(mapped)
      const line = splitUserFacingMessageLines(mapped.userMessage)[0] ?? mapped.userMessage
      setMessage(`❌ ${mapped.title}: ${line}`)
    }
    setIsSaving(false)
  }

  return (
    <div className="space-y-4">
      {!readonly && <ClinicalAutosaveIndicator label={autosaveLabel} error={autosaveError} />}
      <StudyCaptureMissingBanner message={completeBanner} />
      {saveError && <UserFacingErrorCallout mapped={saveError} className="border-red-200 bg-red-50/90" />}
      <p className="text-[11px] text-slate-500">
        Los campos con <span className="text-red-500">*</span> son obligatorios para completar la prueba.
      </p>

      <div className={EXAM_CARD_CLASS}>
        <p className={EXAM_CARD_TITLE_CLASS}>Antropometría</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <StudyCaptureFieldLabel required={isStudyRequiredField('Somatometria', 'peso_kg')}>
              Peso (KG)
            </StudyCaptureFieldLabel>
            <input
              type="number"
              step="0.1"
              value={formData.peso_kg || ''}
              onChange={e => handleChange('peso_kg', e.target.value)}
              disabled={readonly}
              className={studyCaptureInputClass(Boolean(err('peso_kg')), EXAM_NUMERIC_INPUT_CLASS)}
              placeholder="Ej: 75.5"
            />
            {err('peso_kg') && <p className="text-[11px] text-red-600 mt-1">{err('peso_kg')}</p>}
          </div>
          <div>
            <StudyCaptureFieldLabel required={isStudyRequiredField('Somatometria', 'talla_m')}>
              Talla (metros)
            </StudyCaptureFieldLabel>
            <input
              type="text"
              inputMode="decimal"
              value={formData.talla_m || ''}
              onChange={e => {
                const v = e.target.value
                const next =
                  v.includes('.') || v.includes(',')
                    ? v.replace(',', '.')
                    : formatTallaMetersWhileTyping(v)
                handleChange('talla_m', next)
              }}
              onBlur={e => {
                const formatted = formatTallaMetersForDisplay(e.target.value)
                if (formatted !== e.target.value.trim()) {
                  handleChange('talla_m', formatted)
                }
              }}
              disabled={readonly}
              className={studyCaptureInputClass(Boolean(err('talla_m')), EXAM_NUMERIC_INPUT_CLASS)}
              placeholder="Ej: 1,75 o 175"
            />
            {err('talla_m') && <p className="text-[11px] text-red-600 mt-1">{err('talla_m')}</p>}
          </div>
          <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">IMC calculado</p>
              <div className="text-2xl font-black text-slate-800 font-mono tabular-nums">{imc}</div>
            </div>
            <div className={`px-3 py-1.5 rounded-lg font-bold text-xs ${
              complexion === "NORMAL" ? "bg-emerald-100 text-emerald-700" :
              complexion === "SOBREPESO" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
            }`}>
              {complexion}
            </div>
          </div>
        </div>
      </div>

      <div className={EXAM_CARD_CLASS}>
        <p className={EXAM_CARD_TITLE_CLASS}>Signos vitales</p>
        <p className="text-xs text-slate-500">
          Ingresa <span className="text-red-500">*</span> tensión arterial sistólica o frecuencia cardiaca.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <StudyCaptureFieldLabel>Tensión arterial (Sist / Diast)</StudyCaptureFieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.ta_sistolica || ''}
                onChange={e => handleChange('ta_sistolica', e.target.value)}
                disabled={readonly}
                className={studyCaptureInputClass(
                  Boolean(err('ta_sistolica') || err('_vitals')),
                  `${EXAM_NUMERIC_INPUT_CLASS} text-center`,
                )}
                placeholder="120"
              />
              <span className="text-slate-400 font-bold text-lg">/</span>
              <input
                type="number"
                value={formData.ta_diastolica || ''}
                onChange={e => handleChange('ta_diastolica', e.target.value)}
                disabled={readonly}
                className={`${EXAM_NUMERIC_INPUT_CLASS} text-center`}
                placeholder="80"
              />
            </div>
          </div>
          <div>
            <StudyCaptureFieldLabel required>Frec. cardiaca (lpm)</StudyCaptureFieldLabel>
            <input
              type="number"
              value={formData.fc_min || ''}
              onChange={e => handleChange('fc_min', e.target.value)}
              disabled={readonly}
              className={studyCaptureInputClass(
                Boolean(err('fc_min') || err('_vitals')),
                `${EXAM_NUMERIC_INPUT_CLASS} text-center`,
              )}
              placeholder="BPM"
            />
          </div>
          <div>
            <StudyCaptureFieldLabel>Temperatura (°C)</StudyCaptureFieldLabel>
            <input
              type="number"
              step="0.1"
              value={formData.temperatura || ''}
              onChange={e => handleChange('temperatura', e.target.value)}
              disabled={readonly}
              className={`${EXAM_NUMERIC_INPUT_CLASS} text-center`}
              placeholder="°C"
            />
          </div>
          <div>
            <StudyCaptureFieldLabel>Frec. respiratoria (rpm)</StudyCaptureFieldLabel>
            <input
              type="number"
              value={formData.fr_min || ''}
              onChange={e => handleChange('fr_min', e.target.value)}
              disabled={readonly}
              className={`${EXAM_NUMERIC_INPUT_CLASS} text-center`}
              placeholder="RPM"
            />
          </div>
          <div>
            <StudyCaptureFieldLabel>Sat. oxígeno (%)</StudyCaptureFieldLabel>
            <input
              type="number"
              min={0}
              max={100}
              value={formData.saturacion_oxigeno || ''}
              onChange={e => handleChange('saturacion_oxigeno', e.target.value)}
              disabled={readonly}
              className={`${EXAM_NUMERIC_INPUT_CLASS} text-center`}
              placeholder="%"
            />
          </div>
        </div>
        {err('_vitals') && <p className="text-[11px] text-red-600">{err('_vitals')}</p>}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-600">{message}</p>
          {aiWarning && (
            <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-xl">
              ⚠️ {aiWarning}
            </p>
          )}
        </div>
        {!readonly && (
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 text-xs sm:text-sm"
            >
              {isSaving ? "Guardando..." : "Guardar borrador"}
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-5 rounded-lg shadow-sm transition-colors disabled:opacity-50 text-xs sm:text-sm"
            >
              {isSaving ? "Guardando..." : "Guardar y continuar →"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
