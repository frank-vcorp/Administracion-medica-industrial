'use client'

import React, { useState } from 'react'
import { upsertMedicalExam } from '@/actions/medical-exam.actions'

interface SomatometryData {
  ta_sistolica?: number | string
  ta_diastolica?: number | string
  fc_min?: number | string
  peso_kg?: number | string
  talla_m?: number | string
  temperatura?: number | string
  perimetro_cintura?: number | string
  perimetro_cadera?: number | string
}

interface TriageFormProps {
  eventId: string
  workerName?: string
  initialData?: { somatometry?: SomatometryData }
  onSuccess?: () => void
}

/**
 * IMPL-20260305-01: Formulario Rápido de Triaje/Enfermería
 * Somatometría (Peso, Talla, Perímetro) + Signos Vitales
 * 
 * Diseño ultra minimalista:
 * - Inputs numéricos para Tensión (Sistólica/Diastólica)
 * - Frecuencia Cardíaca
 * - Peso (kg), Talla (m), Temperatura (°C)
 * - Autocalcula IMC visualmente (Peso / Talla²)
 * - Envía datos CRUDOS (sin procesar) al servidor
 */
export function TriageForm({
  eventId,
  workerName,
  initialData,
  onSuccess
}: TriageFormProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Estado para Somatometría
  const [somatometry, setSomatometry] = useState({
    ta_sistolica: initialData?.somatometry?.ta_sistolica || '',
    ta_diastolica: initialData?.somatometry?.ta_diastolica || '',
    fc_min: initialData?.somatometry?.fc_min || '',
    peso_kg: initialData?.somatometry?.peso_kg || '',
    talla_m: initialData?.somatometry?.talla_m || '',
    temperatura: initialData?.somatometry?.temperatura || '',
    perimetro_cintura: initialData?.somatometry?.perimetro_cintura || '',
    perimetro_cadera: initialData?.somatometry?.perimetro_cadera || ''
  })

  // Calcular IMC de forma visual (solo para mostrar)
  const calculatedIMC = (() => {
    const peso = parseFloat(String(somatometry.peso_kg))
    const talla = parseFloat(String(somatometry.talla_m))
    
    if (peso > 0 && talla > 0) {
      return (peso / (talla * talla)).toFixed(1)
    }
    return null
  })()

  // Determinar complejión basada en IMC (visual)
  const getComplexionLabel = () => {
    if (!calculatedIMC) return ''
    const imc = parseFloat(calculatedIMC)
    if (imc < 18.5) return 'BAJO PESO'
    if (imc < 25) return 'NORMAL'
    if (imc < 30) return 'SOBREPESO'
    if (imc < 40) return 'OBESIDAD'
    return 'OBESIDAD SEVERA'
  }

  const handleInputChange = (field: string, value: string | number) => {
    setSomatometry(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      // Validar campos obligatorios mínimos
      if (!somatometry.peso_kg || !somatometry.talla_m) {
        setMessage({ type: 'error', text: 'Peso y Talla son obligatorios' })
        setLoading(false)
        return
      }

      // Enviar datos CRUDOS (sin procesar)
      const result = await upsertMedicalExam(eventId, {
        somatometryData: {
          ta_sistolica: somatometry.ta_sistolica ? parseFloat(String(somatometry.ta_sistolica)) : null,
          ta_diastolica: somatometry.ta_diastolica ? parseFloat(String(somatometry.ta_diastolica)) : null,
          fc_min: somatometry.fc_min ? parseInt(String(somatometry.fc_min), 10) : null,
          peso_kg: parseFloat(String(somatometry.peso_kg)),
          talla_m: parseFloat(String(somatometry.talla_m)),
          temperatura: somatometry.temperatura ? parseFloat(String(somatometry.temperatura)) : null,
          perimetro_cintura: somatometry.perimetro_cintura ? parseFloat(String(somatometry.perimetro_cintura)) : null,
          perimetro_cadera: somatometry.perimetro_cadera ? parseFloat(String(somatometry.perimetro_cadera)) : null,
          // Nota: IMC se calcula en servidor si es necesario
          // imc se deja para que el servidor o un paso posterior lo calcule
        }
      })

      if (result.success) {
        setMessage({ type: 'success', text: 'Triaje guardado correctamente' })
        if (onSuccess) onSuccess()
      } else {
        setMessage({ type: 'error', text: result.error || 'Error al guardar' })
      }
    } catch (error) {
      console.error('Error en handleSubmit:', error)
      setMessage({ type: 'error', text: 'Error al procesar triaje' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Triaje / Enfermería
        </h2>
        {workerName && (
          <p className="text-sm text-gray-500 mt-1">
            Paciente: <span className="font-medium">{workerName}</span>
          </p>
        )}
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-md text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SIGNOS VITALES */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Signos Vitales</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Tensión Arterial */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                TA Sistólica (mmHg)
              </label>
              <input
                type="number"
                min="0"
                max="300"
                step="1"
                value={somatometry.ta_sistolica}
                onChange={(e) => handleInputChange('ta_sistolica', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="p.ej. 120"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                TA Diastólica (mmHg)
              </label>
              <input
                type="number"
                min="0"
                max="200"
                step="1"
                value={somatometry.ta_diastolica}
                onChange={(e) => handleInputChange('ta_diastolica', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="p.ej. 80"
              />
            </div>

            {/* Frecuencia Cardíaca */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                FC (bpm)
              </label>
              <input
                type="number"
                min="0"
                max="300"
                step="1"
                value={somatometry.fc_min}
                onChange={(e) => handleInputChange('fc_min', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="p.ej. 72"
              />
            </div>

            {/* Temperatura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperatura (°C)
              </label>
              <input
                type="number"
                min="30"
                max="45"
                step="0.1"
                value={somatometry.temperatura}
                onChange={(e) => handleInputChange('temperatura', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="p.ej. 36.5"
              />
            </div>
          </div>
        </section>

        {/* SOMATOMETRÍA */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Somatometría</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Peso */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Peso (kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="300"
                step="0.1"
                value={somatometry.peso_kg}
                onChange={(e) => handleInputChange('peso_kg', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="p.ej. 70"
              />
            </div>

            {/* Talla */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Talla (m) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                max="3"
                step="0.01"
                value={somatometry.talla_m}
                onChange={(e) => handleInputChange('talla_m', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="p.ej. 1.75"
              />
            </div>

            {/* Perímetro Cintura */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Perímetro Cintura (cm)
              </label>
              <input
                type="number"
                min="0"
                max="500"
                step="1"
                value={somatometry.perimetro_cintura}
                onChange={(e) => handleInputChange('perimetro_cintura', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="p.ej. 85"
              />
            </div>

            {/* Perímetro Cadera */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Perímetro Cadera (cm)
              </label>
              <input
                type="number"
                min="0"
                max="500"
                step="1"
                value={somatometry.perimetro_cadera}
                onChange={(e) => handleInputChange('perimetro_cadera', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="p.ej. 95"
              />
            </div>
          </div>
        </section>

        {/* IMC VISUAL (CALCULADO EN CLIENTE) */}
        {calculatedIMC && (
          <section className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Cálculo del IMC (Visual)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-blue-700">IMC Calculado:</span>
                <p className="text-2xl font-bold text-blue-900">{calculatedIMC}</p>
              </div>
              <div>
                <span className="text-sm text-blue-700">Complejión:</span>
                <p className={`text-lg font-semibold ${
                  getComplexionLabel() === 'NORMAL' ? 'text-green-600' :
                  ['BAJO PESO', 'SOBREPESO'].includes(getComplexionLabel()) ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {getComplexionLabel()}
                </p>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              💡 Nota: El IMC se calcula visualmente pero se envían los datos crudos (peso/talla) al servidor
            </p>
          </section>
        )}

        {/* BOTONES */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : 'Guardar Triaje'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default TriageForm
