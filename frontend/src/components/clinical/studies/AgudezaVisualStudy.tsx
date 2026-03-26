/**
 * @fileoverview Estudio especializado: Agudeza Visual.
 * Opera como EventTest independiente dentro de la Papeleta de Estudios.
 * Extrae la lógica de captura del TriageForm global (eliminado del Paso 2).
 * @id IMPL-20260325-05
 * @spec ARCH-20260325-05
 * @backup context/checkpoints/CHK_IMPL-20260325-05_SEPARACION-SOMATOMETRIA.md
 */
"use client"

import { useState } from "react"
import { updateAgudezaVisual } from "@/actions/medical-exam.actions"
import { updateEventTestStatus } from "@/actions/event-test.actions"

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

const NO_APLICA = 'NO APLICA'

interface AgudezaVisualStudyProps {
  eventId: string
  eventTestId: string
  initialData?: Record<string, unknown> | null
  readonly?: boolean
  onStatusChange?: (status: string) => void
}

export default function AgudezaVisualStudy({
  eventId,
  eventTestId,
  initialData = null,
  readonly = false,
  onStatusChange,
}: AgudezaVisualStudyProps) {
  const [formData, setFormData] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(VISUAL_FIELDS.map(f => [f.name, NO_APLICA])),
    reflejos: 'PRESENTES Y NORMOREFLECTICOS',
    campimetria: '',
    test_ishihara: '',
    ...Object.fromEntries(
      Object.entries(initialData ?? {}).map(([k, v]) => [k, String(v ?? '')])
    ),
  }))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [aiWarning, setAiWarning] = useState("")

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async (markComplete: boolean) => {
    setIsSaving(true)
    setMessage("")
    setAiWarning("")
    const res = await updateAgudezaVisual(eventId, formData)
    if (res.success) {
      const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
      await updateEventTestStatus(
        eventTestId,
        newStatus as Parameters<typeof updateEventTestStatus>[1],
        eventId
      )
      onStatusChange?.(newStatus)
      setMessage(markComplete ? "🏁 Agudeza Visual completada." : "✅ Datos guardados.")
      if (res.aiWarning) {
        setAiWarning(`La captura clínica se guardó, pero la IA no pudo generar prediagnóstico: ${res.aiWarning}`)
      }
    } else {
      setMessage("❌ Error: " + res.error)
    }
    setIsSaving(false)
  }

  return (
    <div className="space-y-5">
      {/* Campo Visual */}
      <div>
        <h4 className="text-sm font-bold text-slate-600 mb-3 uppercase border-b pb-2">Campo Visual</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {VISUAL_FIELDS.map(f => (
            <div key={f.name}>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">{f.label}</label>
              <input
                type="text"
                value={formData[f.name] || ''}
                onChange={e => handleChange(f.name, e.target.value)}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono text-sm disabled:opacity-60"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pruebas Complementarias */}
      <div>
        <h4 className="text-sm font-bold text-slate-600 mb-3 uppercase border-b pb-2">Pruebas Complementarias</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Campimetría</label>
            <input
              type="text"
              value={formData.campimetria || ''}
              onChange={e => handleChange('campimetria', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Test Ishihara</label>
            <input
              type="text"
              value={formData.test_ishihara || ''}
              onChange={e => handleChange('test_ishihara', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Reflejos</label>
            <input
              type="text"
              value={formData.reflejos || ''}
              onChange={e => handleChange('reflejos', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60"
            />
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
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm"
            >
              {isSaving ? "Guardando..." : "Guardar borrador"}
            </button>
            <button
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
