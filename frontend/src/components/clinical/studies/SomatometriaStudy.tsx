/**
 * @fileoverview Estudio especializado: Somatometría y Signos Vitales.
 * Opera como EventTest independiente dentro de la Papeleta de Estudios.
 * Extrae la lógica de captura del TriageForm global (eliminado del Paso 2).
 * @id IMPL-20260325-05
 * @spec ARCH-20260325-05
 * @backup context/checkpoints/CHK_IMPL-20260325-05_SEPARACION-SOMATOMETRIA.md
 */
"use client"

import { useState } from "react"
import { updateSomatometria } from "@/actions/medical-exam.actions"
import { updateEventTestStatus } from "@/actions/event-test.actions"

interface SomatometriaStudyProps {
  eventId: string
  eventTestId: string
  initialData?: Record<string, unknown> | null
  readonly?: boolean
  onStatusChange?: (status: string) => void
}

export default function SomatometriaStudy({
  eventId,
  eventTestId,
  initialData = null,
  readonly = false,
  onStatusChange,
}: SomatometriaStudyProps) {
  const [formData, setFormData] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initialData ?? {}).map(([k, v]) => [k, String(v ?? '')])
    )
  )
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [aiWarning, setAiWarning] = useState("")

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const peso = parseFloat(formData.peso_kg) || 0
  const talla = parseFloat(formData.talla_m) || 0
  const imc = peso > 0 && talla > 0 ? (peso / (talla * talla)).toFixed(2) : "0.00"

  let complexion = "NORMAL"
  if (parseFloat(imc) > 29.9) complexion = "OBESIDAD"
  else if (parseFloat(imc) > 24.9) complexion = "SOBREPESO"
  else if (parseFloat(imc) < 18.5 && parseFloat(imc) > 0) complexion = "BAJO PESO"

  const handleSave = async (markComplete: boolean) => {
    setIsSaving(true)
    setMessage("")
    setAiWarning("")
    const payload = { ...formData, imc: parseFloat(imc), complexion }
    const res = await updateSomatometria(eventId, payload)
    if (res.success) {
      const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
      await updateEventTestStatus(
        eventTestId,
        newStatus as Parameters<typeof updateEventTestStatus>[1],
        eventId
      )
      onStatusChange?.(newStatus)
      setMessage(markComplete ? "🏁 Somatometría completada." : "✅ Datos guardados.")
      if (res.aiWarning) {
        setAiWarning(`La captura clínica se guardó, pero la IA no pudo generar prediagnóstico: ${res.aiWarning}`)
      }
    } else {
      setMessage("❌ Error: " + res.error)
    }
    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Peso, Talla e IMC */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Peso (KG)</label>
          <input
            type="number"
            step="0.1"
            value={formData.peso_kg || ''}
            onChange={e => handleChange('peso_kg', e.target.value)}
            disabled={readonly}
            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-lg font-mono placeholder-slate-300 disabled:opacity-60"
            placeholder="Ej: 75.5"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Talla (Metros)</label>
          <input
            type="number"
            step="0.01"
            value={formData.talla_m || ''}
            onChange={e => handleChange('talla_m', e.target.value)}
            disabled={readonly}
            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-lg font-mono placeholder-slate-300 disabled:opacity-60"
            placeholder="Ej: 1.75"
          />
        </div>
        <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">IMC Calculado</p>
            <div className="text-3xl font-black text-slate-700">{imc}</div>
          </div>
          <div className={`px-4 py-2 rounded-lg font-bold text-sm ${
            complexion === "NORMAL" ? "bg-green-100 text-green-700" :
            complexion === "SOBREPESO" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
          }`}>
            {complexion}
          </div>
        </div>
      </div>

      {/* Signos Vitales */}
      <div>
        <h4 className="text-sm font-bold text-slate-600 mb-4 uppercase border-b pb-2">Signos Vitales</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-2">TENSIÓN ARTERIAL (Sist / Diast)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.ta_sistolica || ''}
                onChange={e => handleChange('ta_sistolica', e.target.value)}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono text-center disabled:opacity-60"
                placeholder="120"
              />
              <span className="text-slate-400 font-bold text-xl">/</span>
              <input
                type="number"
                value={formData.ta_diastolica || ''}
                onChange={e => handleChange('ta_diastolica', e.target.value)}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono text-center disabled:opacity-60"
                placeholder="80"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Frec. Cardiaca</label>
            <input
              type="number"
              value={formData.fc_min || ''}
              onChange={e => handleChange('fc_min', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-center font-mono disabled:opacity-60"
              placeholder="BPM"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Temperatura</label>
            <input
              type="number"
              step="0.1"
              value={formData.temperatura || ''}
              onChange={e => handleChange('temperatura', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-center font-mono disabled:opacity-60"
              placeholder="°C"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Frec. Respiratoria</label>
            <input
              type="number"
              value={formData.fr_min || ''}
              onChange={e => handleChange('fr_min', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-center font-mono disabled:opacity-60"
              placeholder="RPM"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Cintura (cm)</label>
            <input
              type="number"
              step="0.1"
              value={formData.perimetro_cintura || ''}
              onChange={e => handleChange('perimetro_cintura', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-center font-mono disabled:opacity-60"
              placeholder="cm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Cadera (cm)</label>
            <input
              type="number"
              step="0.1"
              value={formData.perimetro_cadera || ''}
              onChange={e => handleChange('perimetro_cadera', e.target.value)}
              disabled={readonly}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-center font-mono disabled:opacity-60"
              placeholder="cm"
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
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-teal-200 transition-all disabled:opacity-50 text-sm"
            >
              {isSaving ? "Guardando..." : "✓ Completar Somatometría"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
