'use client'

import React, { useState, useEffect } from 'react'
import { upsertWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import { PatologicosSchema, HeredoFamiliaresSchema } from '@/schemas/clinical/history.schema'
import { z } from 'zod'

interface AntecedentesFormProps {
  workerId: string
  workerName: string
  initialData?: any
  onSuccess?: () => void
}

/**
 * IMPL-20260305-01
 * Formulario de Antecedentes (Patológicos + Heredo-Familiares)
 * Diseño limpio con Tailwind
 * Opciones por defecto en NEGADO según especificación del cliente
 */
export function AntecedentesForm({
  workerId,
  workerName,
  initialData,
  onSuccess
}: AntecedentesFormProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'patologicos' | 'heredofamiliares'>('patologicos')

  // Estado para Antecedentes Patológicos
  const [patologicos, setPatologicos] = useState({
    diabetes: 'NEGADO',
    hernias: 'NEGADO',
    epilepsia: 'NEGADO',
    alergias: 'NEGADO',
    cardiopatias: 'NEGADO',
    bronquitis: 'NEGADO',
    ginecologicos: 'NEGADO',
    varices: 'NEGADO',
    tuberculosis: 'NEGADO',
    endocrinopatias: 'NEGADO',
    colitis: 'NEGADO',
    tifoidea: 'NEGADO',
    has: 'NEGADO',
    hemorroides: 'NEGADO',
    vertigo: 'NEGADO',
    parotiditis: 'NEGADO',
    dermatitis: 'NEGADO',
    pat_c_vertebral: 'NEGADO',
    cirugias: 'NEGADO',
    hepatitis: 'NEGADO',
    exantematicas: 'NEGADO',
    gastritis: 'NEGADO',
    renales: 'NEGADO',
    asma: 'NEGADO',
    cancer: 'NEGADO',
    traumatismos_craneales: 'NEGADO',
    desmayos: 'NEGADO',
    fracturas: 'NEGADO',
    neumonias: 'NEGADO',
    enf_trans_sexual: 'NEGADO',
    transfusiones: 'NEGADO',
    psiquiatricas: 'NEGADO',
    migrana: 'NEGADO',
    otras: '',
    especifique: ''
  })

  // Estado para Antecedentes Heredo-Familiares
  const [heredofamiliares, setHeredofamiliares] = useState({
    diabetes: '',
    has: '',
    epilepsia: '',
    cardiopatia: '',
    renales: '',
    asma: '',
    cancer: '',
    mentales: '',
    otras: ''
  })

  // Cargar datos iniciales si existen
  useEffect(() => {
    if (initialData?.patologicos) {
      setPatologicos(prev => ({ ...prev, ...initialData.patologicos }))
    }
    if (initialData?.heredo_familiares) {
      setHeredofamiliares(prev => ({ ...prev, ...initialData.heredo_familiares }))
    }
  }, [initialData])

  const handlePatologicosChange = (field: string, value: string) => {
    setPatologicos(prev => ({ ...prev, [field]: value }))
  }

  const handleHeredofamiliaresChange = (field: string, value: string) => {
    setHeredofamiliares(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const payload = {
        patologicos: patologicos,
        heredo_familiares: heredofamiliares
      }

      const result = await upsertWorkerClinicalHistory(workerId, payload)

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Historial clínico guardado exitosamente'
        })
        onSuccess?.()
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Error al guardar'
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Error desconocido'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Historia Clínica Digital
        </h1>
        <p className="text-gray-600">
          <strong>Paciente:</strong> {workerName} (ID: {workerId})
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('patologicos')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'patologicos'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Antecedentes Patológicos
        </button>
        <button
          onClick={() => setActiveTab('heredofamiliares')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'heredofamiliares'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Antecedentes Heredo-Familiares
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* PESTAÑA: ANTECEDENTES PATOLÓGICOS */}
        {activeTab === 'patologicos' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600 mb-4">
              ℹ️ Por defecto, todos los campos están configurados como "NEGADO". Cambiar solo si aplica.
            </p>

            {/* Sección 1: Enfermedades Endocrino-Metabólicas */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-lg font-semibold text-gray-900 px-2">
                Enfermedades Endocrino-Metabólicas
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {['diabetes', 'endocrinopatias', 'asma'].map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
                    </label>
                    <select
                      value={patologicos[field as keyof typeof patologicos] || 'NEGADO'}
                      onChange={(e) => handlePatologicosChange(field, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="NEGADO">NEGADO</option>
                      <option value="SI">SÍ</option>
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Sección 2: Cardiopulmonar */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-lg font-semibold text-gray-900 px-2">
                Sistema Cardiopulmonar
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {['cardiopatias', 'bronquitis', 'neumonias', 'has'].map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field === 'has'
                        ? 'Hipertensión Arterial'
                        : field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
                    </label>
                    <select
                      value={patologicos[field as keyof typeof patologicos] || 'NEGADO'}
                      onChange={(e) => handlePatologicosChange(field, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="NEGADO">NEGADO</option>
                      <option value="SI">SÍ</option>
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Sección 3: Neurológico */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-lg font-semibold text-gray-900 px-2">
                Sistema Neurológico
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {['epilepsia', 'migrana', 'desmayos', 'traumatismos_craneales'].map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
                    </label>
                    <select
                      value={patologicos[field as keyof typeof patologicos] || 'NEGADO'}
                      onChange={(e) => handlePatologicosChange(field, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="NEGADO">NEGADO</option>
                      <option value="SI">SÍ</option>
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Sección 4: Digestivo y Genitourinario */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-lg font-semibold text-gray-900 px-2">
                Sistema Digestivo y Genitourinario
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {['gastritis', 'colitis', 'hemorroides', 'hernias', 'renales'].map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
                    </label>
                    <select
                      value={patologicos[field as keyof typeof patologicos] || 'NEGADO'}
                      onChange={(e) => handlePatologicosChange(field, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="NEGADO">NEGADO</option>
                      <option value="SI">SÍ</option>
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Sección 5: Otras Condiciones */}
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-lg font-semibold text-gray-900 px-2">
                Otras Condiciones
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {['alergias', 'varices', 'ginecologicos', 'dermatitis', 'psiquiatricas'].map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
                    </label>
                    <select
                      value={patologicos[field as keyof typeof patologicos] || 'NEGADO'}
                      onChange={(e) => handlePatologicosChange(field, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="NEGADO">NEGADO</option>
                      <option value="SI">SÍ</option>
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones Adicionales
              </label>
              <textarea
                value={patologicos.otras}
                onChange={(e) => handlePatologicosChange('otras', e.target.value)}
                placeholder="Especificar otras enfermedades relevantes..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* PESTAÑA: ANTECEDENTES HEREDO-FAMILIARES */}
        {activeTab === 'heredofamiliares' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600 mb-4">
              ℹ️ Indique familiares con antecedentes de estas enfermedades (ej: "PADRE", "ABUELO", "ABUELA MATERNA", etc.)
            </p>

            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-lg font-semibold text-gray-900 px-2">
                Antecedentes en Familia
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {Object.keys(heredofamiliares).map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      value={heredofamiliares[field as keyof typeof heredofamiliares]}
                      onChange={(e) => handleHeredofamiliaresChange(field, e.target.value)}
                      placeholder="Relación familiar (ej: PADRE)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
          >
            {loading ? 'Guardando...' : 'Guardar Historial Clínico'}
          </button>
        </div>
      </form>
    </div>
  )
}
