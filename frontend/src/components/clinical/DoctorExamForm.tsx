"use client"

import { useState } from "react"
import { updateAgudezaVisual, updateExploracionFisica } from "@/actions/medical-exam.actions"

export default function DoctorExamForm({ eventId, initialData, readonly = false }: { eventId: string, initialData: any, readonly?: boolean }) {
  const [activeTab, setActiveTab] = useState<'visual'|'fisica'>('visual')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const [formVisual, setFormVisual] = useState(initialData?.eyeAcuityData || {
    vision_lejana_od: 'NO APLICA',
    vision_lejana_oi: 'NO APLICA',
    vision_cercana_od: 'NO APLICA',
    vision_cercana_oi: 'NO APLICA',
    lejana_corregida_od: 'NO APLICA',
    lejana_corregida_oi: 'NO APLICA',
    cercana_corregida_od: 'NO APLICA',
    cercana_corregida_oi: 'NO APLICA',
    reflejos: 'PRESENTES Y NORMOREFLECTICOS',
    test_ishihara: '',
    campimetria: ''
  })

  const [formFisica, setFormFisica] = useState(initialData?.physicalExamData || {})

  const handleVisualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormVisual({ ...formVisual, [e.target.name]: e.target.value })
  }

  const handleFisicaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormFisica({ ...formFisica, [e.target.name]: e.target.value })
  }

  const onSubmitVisual = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSaved(false)
    const result = await updateAgudezaVisual(eventId, formVisual)
    setLoading(false)
    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError(result.error || "Error al guardar Agudeza Visual")
    }
  }

  const onSubmitFisica = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSaved(false)
    const result = await updateExploracionFisica(eventId, formFisica)
    setLoading(false)
    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError(result.error || "Error al guardar Exploración Física")
    }
  }

  // Agrupaciones para Exploración Física
  const examFields = [
    { name: "neurologico", label: "Neurológico" },
    { name: "cabeza", label: "Cabeza" },
    { name: "piel_y_faneras", label: "Piel y Faneras" },
    { name: "oidos_cad", label: "Oídos CAD" },
    { name: "oidos_cai", label: "Oídos CAI" },
    { name: "ojos", label: "Ojos" },
    { name: "boca_estado", label: "Boca (Estado)" },
    { name: "boca_alineacion", label: "Boca (Alineación)" },
    { name: "nariz", label: "Nariz" },
    { name: "faringe", label: "Faringe" },
    { name: "cuello", label: "Cuello" },
    { name: "torax", label: "Tórax" },
    { name: "corazon", label: "Corazón" },
    { name: "campos_pulmonares", label: "Campos Pulmonares" },
    { name: "abdomen", label: "Abdomen" },
    { name: "genitourinario", label: "Genitourinario" },
    { name: "columna_vertebral", label: "Columna Vertebral" },
    { name: "test_adam", label: "Test Adam" },
    { name: "ms_superiores", label: "Miembros Superiores" },
    { name: "fuerza_muscular_daniels_sup", label: "Fuerza Muscular (Sup)" },
    { name: "ms_inferiores", label: "Miembros Inferiores" },
    { name: "fuerza_muscular_daniels_inf", label: "Fuerza Muscular (Inf)" },
    { name: "circulacion_venosa", label: "Circulación Venosa" },
    { name: "arco_de_movilidad", label: "Arco de Movilidad" },
    { name: "tono_muscular", label: "Tono Muscular" },
    { name: "coordinacion", label: "Coordinación" },
    { name: "test_romberg", label: "Test Romberg" },
    { name: "signo_bragard", label: "Signo Bragard" },
    { name: "prueba_finkelstein", label: "Prueba Finkelstein" },
    { name: "signo_tinel", label: "Signo Tinel" },
    { name: "prueba_phanel", label: "Prueba Phanel" },
    { name: "prueba_lasegue", label: "Prueba Lasegue" },
    { name: "presencia_quiste_sinovial", label: "Quiste Sinovial (Presencia)" },
    { name: "especificar_quiste", label: "Especificar Quiste" }
  ]

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-medical-200">
      <h2 className="text-xl font-bold text-medical-800 mb-6 flex items-center gap-2">
        <span>👨‍⚕️</span> Módulo Médico (Examen y Visual)
      </h2>

      {/* Tabs */}
      <div className="flex border-b mb-6 border-gray-200">
        <button
          onClick={() => setActiveTab('visual')}
          className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'visual' ? 'text-medical-700 border-b-2 border-medical-600' : 'text-gray-500 hover:text-medical-600'}`}
        >
          👁️ Agudeza Visual
        </button>
        <button
          onClick={() => setActiveTab('fisica')}
          className={`py-2 px-6 font-semibold transition-colors ${activeTab === 'fisica' ? 'text-medical-700 border-b-2 border-medical-600' : 'text-gray-500 hover:text-medical-600'}`}
        >
          🩺 Exploración Física
        </button>
      </div>

      {saved && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md border border-green-200 text-sm font-medium">
          Dato guardado exitosamente.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md border border-red-200 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Tab: Agudeza Visual */}
      {activeTab === 'visual' && (
        <form onSubmit={onSubmitVisual} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-md">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Visión Lejana OD</label>
              <input name="vision_lejana_od" value={formVisual.vision_lejana_od || ''} onChange={handleVisualChange} type="text" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Visión Lejana OI</label>
              <input name="vision_lejana_oi" value={formVisual.vision_lejana_oi || ''} onChange={handleVisualChange} type="text" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Visión Cercana OD</label>
              <input name="vision_cercana_od" value={formVisual.vision_cercana_od || ''} onChange={handleVisualChange} type="text" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Visión Cercana OI</label>
              <input name="vision_cercana_oi" value={formVisual.vision_cercana_oi || ''} onChange={handleVisualChange} type="text" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-md">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Lejana Corregida OD</label>
              <input name="lejana_corregida_od" value={formVisual.lejana_corregida_od || ''} onChange={handleVisualChange} type="text" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Lejana Corregida OI</label>
              <input name="lejana_corregida_oi" value={formVisual.lejana_corregida_oi || ''} onChange={handleVisualChange} type="text" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cercana Corregida OD</label>
              <input name="cercana_corregida_od" value={formVisual.cercana_corregida_od || ''} onChange={handleVisualChange} type="text" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cercana Corregida OI</label>
              <input name="cercana_corregida_oi" value={formVisual.cercana_corregida_oi || ''} onChange={handleVisualChange} type="text" className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campimetría</label>
              <input name="campimetria" value={formVisual.campimetria || ''} onChange={handleVisualChange} type="text" className="w-full border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Ishihara</label>
              <input name="test_ishihara" value={formVisual.test_ishihara || ''} onChange={handleVisualChange} type="text" className="w-full border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reflejos</label>
              <input name="reflejos" value={formVisual.reflejos || ''} onChange={handleVisualChange} type="text" className="w-full border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" />
            </div>
          </div>

          {!readonly && (
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-medical-600 text-white py-2 px-4 rounded hover:bg-medical-700 disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Agudeza Visual"}
            </button>
          )}
        </form>
      )}

      {/* Tab: Exploración Física */}
      {activeTab === 'fisica' && (
        <form onSubmit={onSubmitFisica} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {examFields.map((field) => (
              <div key={field.name}>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{field.label}</label>
                <input 
                  type="text" 
                  name={field.name}
                  value={formFisica[field.name] || ''}
                  onChange={handleFisicaChange} 
                  className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-medical-500 focus:border-medical-500" 
                  placeholder=""
                />
              </div>
            ))}
          </div>

          {!readonly && (
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-medical-600 text-white py-2 px-4 rounded hover:bg-medical-700 disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Exploración Física"}
            </button>
          )}
        </form>
      )}

    </div>
  )
}
