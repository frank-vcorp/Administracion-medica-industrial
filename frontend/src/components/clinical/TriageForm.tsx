"use client"

import { useState } from "react"
import { updateSomatometria } from "@/actions/medical-exam.actions"
import type { SomatometriaVitalesSchema } from "@/schemas/clinical/exam.schema"

export default function TriageForm({ eventId, initialData = {}, readonly = false }: { eventId: string, initialData?: any, readonly?: boolean }) {
  const [formData, setFormData] = useState(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  // Cálculos Automáticos
  const peso = parseFloat(formData.peso_kg) || 0
  const talla = parseFloat(formData.talla_m) || 0
  const imc = (peso > 0 && talla > 0) ? (peso / (talla * talla)).toFixed(2) : "0.00"
  
  let complexion = "NORMAL"
  if (parseFloat(imc) > 29.9) complexion = "OBESIDAD"
  else if (parseFloat(imc) > 24.9) complexion = "SOBREPESO"
  else if (parseFloat(imc) < 18.5 && parseFloat(imc) > 0) complexion = "BAJO PESO"

  const handleSave = async () => {
    setIsSaving(true)
    setMessage("")
    // Incluir IMC y complexion aunque sea calculado visualmente (opcional)
    const payload = { ...formData, imc: parseFloat(imc), complexion }
    
    const res = await updateSomatometria(eventId, payload)
    if (res.success) {
      setMessage("✅ Guardado con éxito. El paciente pasa a Consultorio.")
    } else {
      setMessage("❌ Error: " + res.error)
    }
    setIsSaving(false)
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200">
      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <span className="bg-teal-100 text-teal-600 p-2 rounded-lg">⚖️</span>
        Triaje y Somatometría
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Peso (KG)</label>
          <input type="number" step="0.1" value={formData.peso_kg || ''} onChange={e => handleChange('peso_kg', e.target.value)} 
                 className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-lg font-mono placeholder-slate-300" placeholder="Ej: 75.5" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Talla (Metros)</label>
          <input type="number" step="0.01" value={formData.talla_m || ''} onChange={e => handleChange('talla_m', e.target.value)} 
                 className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-lg font-mono placeholder-slate-300" placeholder="Ej: 1.75" />
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

      <h4 className="text-sm font-bold text-slate-600 mb-4 uppercase border-b pb-2">Signos Vitales</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
         <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-500 mb-2">TENSIÓN ARTERIAL (Sist / Diast)</label>
          <div className="flex items-center gap-2">
            <input type="number" value={formData.ta_sistolica || ''} onChange={e => handleChange('ta_sistolica', e.target.value)} 
                   className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono text-center" placeholder="120" />
            <span className="text-slate-400 font-bold text-xl">/</span>
            <input type="number" value={formData.ta_diastolica || ''} onChange={e => handleChange('ta_diastolica', e.target.value)} 
                   className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono text-center" placeholder="80" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Frec. Cardiaca</label>
          <input type="number" value={formData.fc_min || ''} onChange={e => handleChange('fc_min', e.target.value)} 
                 className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-center font-mono" placeholder="BPM" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Temperatura</label>
          <input type="number" step="0.1" value={formData.temperatura || ''} onChange={e => handleChange('temperatura', e.target.value)} 
                 className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-center font-mono" placeholder="°C" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
        <p className="text-sm font-medium text-slate-500">{message}</p>
        {!readonly && (
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-teal-200 transition-all disabled:opacity-50"
          >
            {isSaving ? "Guardando..." : "Guardar y Pasar a Consultorio"}
          </button>
        )}
      </div>
    </div>
  )
}
