"use client"

import { useState } from "react"
import { updateExploracionFisica } from "@/actions/medical-exam.actions"

export default function DoctorExamForm({ eventId, initialData, readonly = false }: { eventId: string, initialData: any, readonly?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const [formFisica, setFormFisica] = useState(initialData?.physicalExamData || {})

  const handleFisicaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormFisica({ ...formFisica, [e.target.name]: e.target.value })
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
    <div className="bg-white p-6 rounded-2xl border border-slate-200">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <span className="bg-green-100 text-green-700 p-2 rounded-lg">🩺</span>
        Módulo Médico — Exploración Física
      </h2>

      {saved && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-xl border border-green-200 text-sm font-medium">
          ✅ Exploración Física guardada exitosamente.
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl border border-red-200 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={onSubmitFisica} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {examFields.map((field) => (
            <div key={field.name}>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">{field.label}</label>
              <input
                type="text"
                name={field.name}
                value={formFisica[field.name] || ''}
                onChange={handleFisicaChange}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-green-500 text-sm"
                placeholder=""
              />
            </div>
          ))}
        </div>

        {!readonly && (
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-green-200 transition-all disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar Exploración Física"}
          </button>
        )}
      </form>
    </div>
  )
}
