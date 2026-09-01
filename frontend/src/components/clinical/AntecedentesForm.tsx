'use client'

/**
 * ARCH-20260326-06 — Editor Maestro Longitudinal del Historial Clínico
 * Convierte el formulario parcial en el editor maestro longitudinal con 5 secciones.
 * @backup context/checkpoints/CHK_IMPL-ARCH-20260326-06.md
 *
 * IMPL-20260817-01-C2 (ARCH-20260817-01 corte 2): heredo-familiares adoptan
 * los catálogos ZIN (8 opciones para los 7 campos canónicos + 3 opciones para
 * `mentales`). El campo `otras` muestra un input "Especifique" condicional
 * cuando value === 'OTROS'. DA-1: schema sigue tolerante — legacy libre
 * parsea sin error (ver SPEC §4.4).
 *
 * IMPL-20260817-02 (FIX L2 QA-20260817-01-C2): el input "Especifique" del
 * campo `otras` ahora lee/escribe el state key INDEPENDIENTE
 * `heredofamiliares.otras_especifique` (antes compartía `otras` con el
 * select, causando auto-destrucción al primer carácter tipeado).
 *
 * IMPL-20260817-04 (junta AMI 10/ago, Erika, línea 285 — DA-6 espejo): acordeón
 * Sí/Negado/No Aplica + 3 campos condicionales (desde_cuando / tratamiento /
 * observaciones) para cada enfermedad del `PatologicosSchema`. El campo
 * legacy top-level `especifique` se elimina; su contenido se captura en
 * `otras.detalle.observaciones`. La hidratación acepta formato legacy
 * (`{ diabetes: 'SI' }`) y nuevo (`{ diabetes: { estado, detalle } }`).
 *
 * IMPL-20260817-06 (DA-6 espejo de AntecedentesCaptura): acordeón colapsable
 * con resumen. Estado SÍ + 3 campos vacíos → inputs desplegados. Estado
 * SÍ + 3 campos con contenido → resumen colapsado (click para editar).
 * Click en otra enfermedad colapsa la actual automáticamente. Estado
 * NEGADO/NO APLICA → card pequeño sin campos. Sin botón "Confirmar".
 */
import React, { useState, useEffect } from 'react'
import { upsertWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import {
  DATOS_PERSONALES_CAMPOS,
  HISTORIA_LABORAL_EMPLEOS_ANTERIORES_FIELDS,
  HISTORIA_LABORAL_EXPOSICIONES,
  HEREDOFAMILIARES_DESCRIPCIONES,
  emptyHeredoFamiliaresRecord,
  heredoFamiliaresEspecifiqueKey,
  NO_PATOLOGICOS_DESCRIPCIONES,
  PATOLOGICOS_DESCRIPCIONES,
  TURNO_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  getPatologicosAllFields,
} from '@/lib/antecedentes-fields'
import { hasDetalleContent } from '@/lib/patologicos-accordion'
import {
  HEREDOFAMILIARES_VALUES,
  HEREDOFAMILIARES_MENTALES_VALUES,
} from '@/schemas/clinical/exam.schema'
import {
  GRUPO_RH_VALUES,
  type DetalleTriple,
} from '@/schemas/clinical/history.schema'

interface AntecedentesFormProps {
  workerId: string
  workerName: string
  initialData?: unknown
  onSuccess?: () => void
}

type ActiveTab = 'datos_personales' | 'historia_laboral' | 'heredofamiliares' | 'no_patologicos' | 'patologicos'

/**
 * IMPL-20260817-04 — opciones Sí/Negado/No Aplica del acordeón patológico.
 * Espejo de `AntecedentesCaptura` (DA-6).
 */
const SNA_OPTIONS = ['NEGADO', 'SI', 'NO APLICA'] as const
type SnaValue = (typeof SNA_OPTIONS)[number]

/** Estado local de una enfermedad patológica (acordeón). */
type PatologiaEntry = {
  estado: SnaValue
  detalle: DetalleTriple | undefined
}

const emptyDetalle = (): DetalleTriple => ({ desde_cuando: '', tratamiento: '', observaciones: '' })
const emptyPatologia = (): PatologiaEntry => ({ estado: 'NEGADO', detalle: undefined })

function isSnaValue(v: unknown): v is SnaValue {
  return v === 'NEGADO' || v === 'SI' || v === 'NO APLICA'
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Normaliza un valor desconocido de una enfermedad patológica al shape
 * `PatologiaEntry`. Acepta string legacy o el nuevo objeto. Usado en la
 * hidratación de `initialData` (DA-1).
 */
function coercePatologiaEntry(v: unknown): PatologiaEntry {
  if (typeof v === 'string') {
    const s = v.trim().toUpperCase()
    if (isSnaValue(s)) return { estado: s, detalle: undefined }
    return { estado: 'NEGADO', detalle: undefined }
  }
  if (isPlainRecord(v) && isSnaValue(v.estado)) {
    const detalle = isPlainRecord(v.detalle)
      ? {
          desde_cuando:  typeof v.detalle.desde_cuando  === 'string' ? v.detalle.desde_cuando  : '',
          tratamiento:   typeof v.detalle.tratamiento   === 'string' ? v.detalle.tratamiento   : '',
          observaciones: typeof v.detalle.observaciones === 'string' ? v.detalle.observaciones : '',
        }
      : undefined
    return { estado: v.estado, detalle }
  }
  return emptyPatologia()
}

/**
 * ARCH-20260326-06
 * Editor Maestro Longitudinal: Datos Personales + Historia Laboral + Heredo-Familiares + No Patológicos + Patológicos
 */
export function AntecedentesForm({
  workerId,
  workerName,
  initialData,
  onSuccess
}: AntecedentesFormProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('datos_personales')

  // ── Estado: Datos Personales ───────────────────────────────────────────────────
  const [datosPersonales, setDatosPersonales] = useState<Record<string, string>>({
    puesto_actual: '', area_departamento: '', turno: '',
    antiguedad_anios: '', antiguedad_meses: '', estado_civil: '',
    escolaridad: '', numero_hijos: '',
  })

  // ── Estado: Historia Laboral ──────────────────────────────────────────────────
  const [historiaLaboral, setHistoriaLaboral] = useState<Record<string, string | boolean>>({
    empresa_anterior_1: '', puesto_anterior_1: '', tiempo_anterior_1: '',
    empresa_anterior_2: '', puesto_anterior_2: '', tiempo_anterior_2: '',
    exposicion_quimica: false, exposicion_quimica_especifique: '',
    exposicion_fisica: false,  exposicion_fisica_especifique: '',
    exposicion_biologica: false, exposicion_biologica_especifique: '',
    exposicion_ergonomica: false, exposicion_ergonomica_especifique: '',
    accidentes_trabajo: false, accidentes_descripcion: '',
    enfermedades_trabajo: false, enfermedades_descripcion: '',
  })

  // ── Estado: Heredo-Familiares ───────────────────────────────────────────────
  // IMPL-20260817-02 (FIX L2 QA-20260817-01-C2): `otras_especifique` es un state
  // key INDEPENDIENTE del select `otras`. Antes compartían state y al primer
  // carácter tipeado en el input, `otras` cambiaba de 'OTROS' al texto y el
  // input se auto-destruía (ver commit fix).
  const [heredofamiliares, setHeredofamiliares] = useState<Record<string, string>>(
    () => emptyHeredoFamiliaresRecord(),
  )

  // ── Estado: No Patológicos ────────────────────────────────────────────────
  const [noPatologicos, setNoPatologicos] = useState<Record<string, string>>({
    alcohol: 'NEGADO', alcohol_edad_comienzo: '', alcohol_frecuencia: '',
    alcohol_suspendido: 'NEGADO', alcohol_tiempo_suspendido: '',
    tabaco: 'NEGADO', tabaco_edad_comienzo: '', tabaco_frecuencia: '',
    tabaco_suspendido: 'NEGADO', tabaco_tiempo_suspendido: '', tabaco_cigarros_dia: '',
    drogas_estimulantes: 'NEGADO', drogas_especifique: '',
    drogas_frecuencia: '', drogas_ultimo_consumo: '',
    ejercicio: 'NEGADO', ejercicio_especifique: '', ejercicio_frecuencia: '',
    alimentacion: 'BUENA',
    tratamiento_medico_actual: 'NEGADO', tratamiento_medico_actual_especifique: '',
    grupo_y_rh: 'DESCONOCE',
    tatuajes: 'NEGADO', tatuajes_especifique: '',
  })

  // ── Estado: Patológicos ────────────────────────────────────────────────────
  // IMPL-20260817-04 — acordeón Sí/Negado/No Aplica + 3 campos condicionales.
  // DA-1: la hidratación (useEffect abajo) reconoce tanto el formato legacy
  // `{ diabetes: 'SI' }` como el nuevo `{ diabetes: { estado, detalle } }`.
  const [patologicos, setPatologicos] = useState<Record<string, PatologiaEntry>>(() => {
    const out: Record<string, PatologiaEntry> = {}
    for (const f of getPatologicosAllFields()) out[f] = emptyPatologia()
    out.otras = emptyPatologia()
    return out
  })
  // IMPL-20260817-06 — field actualmente expandido del acordeón. `null`
  // significa "ninguno" — la UI entonces muestra resumen si hay contenido
  // o inputs si están vacíos.
  const [focusedPatologiaField, setFocusedPatologiaField] = useState<string | null>(null)

  // ── Inicialización desde datos guardados ──────────────────────────────────────
  /* eslint-disable react-hooks/set-state-in-effect -- hidratación intencional al montar / cuando cambia initialData (editor maestro longitudinal). */
  useEffect(() => {
    const data = initialData as
      | {
          datos_personales?: Record<string, string>
          historia_laboral?: Record<string, string | boolean>
          heredo_familiares?: Record<string, string>
          no_patologicos?: Record<string, string>
          patologicos?: Record<string, unknown>
        }
      | undefined
    if (data?.datos_personales)  setDatosPersonales(p => ({ ...p, ...data.datos_personales }))
    if (data?.historia_laboral)  setHistoriaLaboral(p => ({ ...p, ...data.historia_laboral }))
    if (data?.heredo_familiares) setHeredofamiliares(p => ({ ...p, ...data.heredo_familiares }))
    if (data?.no_patologicos)    setNoPatologicos(p => ({ ...p, ...data.no_patologicos }))
    if (data?.patologicos) {
      // IMPL-20260817-04 — normaliza cada valor al shape PatologiaEntry
      // (acepta string legacy o el nuevo objeto).
      const pat = data.patologicos
      setPatologicos(prev => {
        const next = { ...prev }
        for (const [k, v] of Object.entries(pat)) {
          next[k] = coercePatologiaEntry(v)
        }
        return next
      })
    }
  }, [initialData])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleHeredofamiliaresChange = (field: string, value: string) => {
    setHeredofamiliares(prev => ({ ...prev, [field]: value }))
  }

  /**
   * IMPL-20260817-04 — actualiza una enfermedad patológica con un patch
   * parcial. Si el nuevo estado es `SI`, materializa un `detalle` por
   * defecto. Si pasa a `NEGADO`/`NO APLICA`, colapsa el detalle.
   *
   * IMPL-20260817-06 — al cambiar a `SI`, auto-focus este field. Al
   * cambiar a `NEGADO`/`NO APLICA`, limpia el focus.
   */
  const handlePatologiaPatch = (field: string, patch: Partial<PatologiaEntry>) => {
    if (patch.estado !== undefined) {
      setFocusedPatologiaField(patch.estado === 'SI' ? field : null)
    }
    setPatologicos(prev => {
      const current = prev[field] ?? emptyPatologia()
      const next: PatologiaEntry = {
        estado: patch.estado ?? current.estado,
        detalle:
          patch.estado !== undefined
            ? patch.estado === 'SI'
              ? (current.detalle ?? emptyDetalle())
              : undefined
            : patch.detalle !== undefined
              ? patch.detalle
              : current.detalle,
      }
      return { ...prev, [field]: next }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const payload = {
        datos_personales:  datosPersonales,
        historia_laboral:  historiaLaboral,
        heredo_familiares: heredofamiliares,
        no_patologicos:    noPatologicos,
        patologicos:       patologicos,
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

      {/* Tabs — 5 secciones longitudinales ARCH-20260326-06 */}
      <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1 mb-6">
        {([
          ['datos_personales', '👤', 'Datos Personales'],
          ['historia_laboral', '🏭', 'Historia Laboral'],
          ['heredofamiliares', '🧬', 'Heredo-Familiares'],
          ['no_patologicos',   '🍺', 'No Patológicos'],
          ['patologicos',      '🏥', 'Patológicos'],
        ] as [string, string, string][]).map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id as ActiveTab)}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === id
                ? 'bg-white shadow text-blue-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{icon}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── DATOS PERSONALES ────────────────────────────────────────────── */}
        {activeTab === 'datos_personales' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600">
              ℹ️ Datos declarativos del trabajador — sirven como base longitudinal reutilizable entre citas.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DATOS_PERSONALES_CAMPOS.filter(c => c.kind === 'text' || c.kind === 'number').map(campo => (
                <div key={campo.field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{campo.label}</label>
                  <input
                    type={campo.kind}
                    value={String(datosPersonales[campo.field] ?? '')}
                    onChange={e => setDatosPersonales(p => ({ ...p, [campo.field]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
                <select
                  value={datosPersonales.turno ?? ''}
                  onChange={e => setDatosPersonales(p => ({ ...p, turno: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">— Seleccionar —</option>
                  {TURNO_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado Civil</label>
                <select
                  value={datosPersonales.estado_civil ?? ''}
                  onChange={e => setDatosPersonales(p => ({ ...p, estado_civil: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">— Seleccionar —</option>
                  {ESTADO_CIVIL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORIA LABORAL ───────────────────────────────────────────── */}
        {activeTab === 'historia_laboral' && (
          <div className="space-y-6">
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-base font-semibold text-gray-900 px-2">Empleos Anteriores</legend>
              <div className="space-y-4 mt-3">
                {(['1', '2'] as const).map(n => (
                  <div key={n} className="grid grid-cols-3 gap-3">
                    {HISTORIA_LABORAL_EMPLEOS_ANTERIORES_FIELDS
                      .filter(([field]) => field.endsWith(`_${n}`))
                      .map(([field, label]) => (
                        <div key={field}>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                          <input
                            type="text"
                            value={String(historiaLaboral[field] ?? '')}
                            onChange={e => setHistoriaLaboral(p => ({ ...p, [field]: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-base font-semibold text-gray-900 px-2">Exposición a Riesgos y Antecedentes</legend>
              <div className="space-y-3 mt-3">
                {HISTORIA_LABORAL_EXPOSICIONES.map(({ key, label, descKey }) => (
                  <div key={key} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={!!historiaLaboral[key]}
                        onChange={e => setHistoriaLaboral(p => ({ ...p, [key]: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700 w-44">{label}</span>
                    </label>
                    {historiaLaboral[key] && (
                      <input
                        type="text"
                        value={String(historiaLaboral[descKey] ?? '')}
                        onChange={e => setHistoriaLaboral(p => ({ ...p, [descKey]: e.target.value }))}
                        placeholder="Especifique…"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {/* SECCIÓN: ANTECEDENTES PATOLÓGICOS — IMPL-20260817-04 acordeón */}
        {activeTab === 'patologicos' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600 mb-4">
              ℹ️ Por defecto, todos los campos están configurados como &quot;NEGADO&quot;. Cambiar solo si aplica.
              <br />
              <span className="text-gray-500">Auto: conteste lo que recuerde. No es necesario que sea un diagnóstico médico formal.</span>
              <br />
              <span className="text-gray-500">Al marcar <strong>SÍ</strong> aparecen 3 campos: desde cuándo, tratamiento y observaciones.</span>
            </p>

            {([
              ['endocrino',      'Enfermedades Endocrino-Metabólicas'],
              ['cardiopulmonar', 'Sistema Cardiopulmonar'],
              ['neurologico',    'Sistema Neurológico'],
              ['digestivo',      'Sistema Digestivo y Genitourinario'],
              ['otras',          'Otras Condiciones'],
            ] as const).map(([group, title]) => (
              <fieldset key={group} className="border border-gray-200 rounded-lg p-4">
                <legend className="text-lg font-semibold text-gray-900 px-2">{title}</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {PATOLOGICOS_DESCRIPCIONES[group].map(item => {
                    // IMPL-20260817-06 (DA-6 espejo AntecedentesCaptura) —
                    // acordeón colapsable con resumen. Ver handoff §"Cambio
                    // en AntecedentesForm.tsx".
                    const entry = patologicos[item.field] ?? emptyPatologia()
                    const detalle = entry.detalle ?? emptyDetalle()
                    const isFocused = focusedPatologiaField === item.field
                    const showInputs = entry.estado === 'SI' && (isFocused || !hasDetalleContent(detalle))
                    const showSummary = entry.estado === 'SI' && !showInputs
                    return (
                      <div key={item.field} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {item.label}
                        </label>
                        <p className="text-xs text-gray-500 mb-2">{item.help}</p>
                        <select
                          value={entry.estado}
                          onChange={e => handlePatologiaPatch(item.field, { estado: e.target.value as SnaValue })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                            entry.estado === 'SI'
                              ? 'border-rose-300 bg-rose-50 focus:ring-rose-400'
                              : entry.estado === 'NO APLICA'
                                ? 'border-gray-300 bg-gray-100 focus:ring-gray-400'
                                : 'border-gray-300 bg-white focus:ring-blue-500'
                          }`}
                        >
                          {SNA_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {showSummary && (
                          // IMPL-20260817-06 — resumen colapsado, click expande.
                          <button
                            type="button"
                            onClick={() => setFocusedPatologiaField(item.field)}
                            className="w-full text-left mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm hover:bg-emerald-100 transition-colors"
                          >
                            <div className="flex items-center gap-1 font-medium text-emerald-800 mb-1">
                              <span>✓</span>
                              <span>{item.label}</span>
                              <span className="text-emerald-600 ml-auto text-xs">click para editar</span>
                            </div>
                            <div className="text-gray-600 space-y-0.5">
                              {detalle.desde_cuando && (
                                <p><span className="font-medium">Desde:</span> {detalle.desde_cuando}</p>
                              )}
                              {detalle.tratamiento && (
                                <p><span className="font-medium">Tratamiento:</span> {detalle.tratamiento}</p>
                              )}
                              {detalle.observaciones && (
                                <p><span className="font-medium">Observaciones:</span> {detalle.observaciones}</p>
                              )}
                            </div>
                          </button>
                        )}
                        {showInputs && (
                          <div className="mt-3 space-y-2 p-3 bg-white border border-gray-200 rounded-lg">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Desde cuándo
                              </label>
                              <input
                                type="text"
                                value={detalle.desde_cuando}
                                onChange={e => handlePatologiaPatch(item.field, {
                                  detalle: { ...detalle, desde_cuando: e.target.value },
                                })}
                                placeholder="ej: 15 años, 2019"
                                maxLength={200}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Tratamiento
                              </label>
                              <textarea
                                value={detalle.tratamiento}
                                onChange={e => handlePatologiaPatch(item.field, {
                                  detalle: { ...detalle, tratamiento: e.target.value },
                                })}
                                placeholder="ej: Metformina 500mg cada 24h"
                                rows={2}
                                maxLength={500}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Observaciones
                              </label>
                              <textarea
                                value={detalle.observaciones}
                                onChange={e => handlePatologiaPatch(item.field, {
                                  detalle: { ...detalle, observaciones: e.target.value },
                                })}
                                placeholder="ej: HbA1c 6.5%, sin complicaciones"
                                rows={3}
                                maxLength={1500}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {/* PESTAÑA: ANTECEDENTES HEREDO-FAMILIARES */}
        {activeTab === 'heredofamiliares' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600 mb-4">
              ℹ️ Indique familiares con antecedentes de estas enfermedades (ej: &quot;PADRE&quot;, &quot;ABUELO&quot;, &quot;ABUELA MATERNA&quot;, etc.)
              <br />
              <span className="text-gray-500">Auto: si no recuerda el familiar exacto, deje el campo en blanco. Solo anote lo que recuerde con seguridad.</span>
            </p>

            <fieldset className="border border-gray-200 rounded-lg p-4">
              <legend className="text-lg font-semibold text-gray-900 px-2">
                Antecedentes en Familia
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {HEREDOFAMILIARES_DESCRIPCIONES.map((item) => {
                  // IMPL-20260817-01-C2: 7 campos con catálogo ZIN de 8 opciones
                  // (NEGADOS/PADRE/MADRE/AMBOS/HERMANOS/AB PATERNO/AB MATERNO/OTROS),
                  // `mentales` con SI/NO/NO APLICA, `otras` con combo + input "Especifique"
                  // condicional cuando value === 'OTROS'. Ver SPEC §4.4.
                  const isMentales = item.field === 'mentales'
                  const zinValues = isMentales ? HEREDOFAMILIARES_MENTALES_VALUES : HEREDOFAMILIARES_VALUES
                  const currentValue = heredofamiliares[item.field as keyof typeof heredofamiliares] ?? ''
                  const especifiqueKey = heredoFamiliaresEspecifiqueKey(item.field)
                  const showEspecifique = !isMentales && currentValue === 'OTROS'
                  return (
                    <div key={item.field}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {item.label}
                      </label>
                      <p className="text-xs text-gray-500 mb-2">{item.help}</p>
                      <select
                        value={currentValue}
                        onChange={(e) => handleHeredofamiliaresChange(item.field, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">— Seleccionar —</option>
                        {zinValues.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                      {showEspecifique && (
                        <input
                          type="text"
                          value={heredofamiliares[especifiqueKey] ?? ''}
                          onChange={(e) => handleHeredofamiliaresChange(especifiqueKey, e.target.value)}
                          placeholder="Especifique (ej: TÍO PATERNO, cáncer de mama)"
                          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </fieldset>
          </div>
        )}

        {/* ── NO PATOLÓGICOS / TOXICOMANÍAS ───────────────────────────────────── */}
        {activeTab === 'no_patologicos' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-600">
              ℹ️ Indique SI o NEGADO para cada hábito. Si aplica, complete los detalles adicionales.
              <br />
              <span className="text-gray-500">Auto: conteste lo que recuerde. Aproxime las cantidades si no las sabe exactas (ej: &quot;3-4 por semana&quot;).</span>
            </p>
            {NO_PATOLOGICOS_DESCRIPCIONES.map((item) => (
              <div key={item.key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-4 mb-1">
                  <span className="text-sm font-medium text-gray-700 w-44">{item.label}</span>
                  <div className="flex gap-2">
                    {['NEGADO', 'SI'].map(opt => (
                      <button
                        key={opt} type="button"
                        onClick={() => setNoPatologicos(p => ({ ...p, [item.key]: opt }))}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium border-2 transition ${
                          noPatologicos[item.key] === opt
                            ? opt === 'SI' ? 'bg-rose-100 border-rose-400 text-rose-700' : 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-white border-gray-200 text-gray-500'
                        }`}
                      >{opt}</button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-2">{item.help}</p>
                {noPatologicos[item.key] === 'SI' && (
                  <div className="grid grid-cols-2 gap-3 pl-4">
                    {item.subs.map(([sk, sl]) => (
                      <div key={sk}>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{sl}</label>
                        <input
                          type="text"
                          value={String(noPatologicos[sk] ?? '')}
                          onChange={e => setNoPatologicos(p => ({ ...p, [sk]: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alimentación</label>
                <p className="text-xs text-gray-500 mb-1">¿Cómo considera su alimentación diaria? BUENA = balanceada · REGULAR = mejorable · MALA = muy desequilibrada.</p>
                <select
                  value={noPatologicos.alimentacion ?? 'BUENA'}
                  onChange={e => setNoPatologicos(p => ({ ...p, alimentacion: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {['BUENA', 'REGULAR', 'MALA'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tratamiento médico actual</label>
                <p className="text-xs text-gray-500 mb-1">Medicamentos o terapias que toma actualmente de forma regular.</p>
                <div className="flex gap-2 mt-1">
                  {['NEGADO', 'SI'].map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setNoPatologicos(p => ({ ...p, tratamiento_medico_actual: opt }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition ${noPatologicos.tratamiento_medico_actual === opt ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}
                    >{opt}</button>
                  ))}
                </div>
                {noPatologicos.tratamiento_medico_actual === 'SI' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Especifique</label>
                    <input
                      type="text"
                      value={noPatologicos.tratamiento_medico_actual_especifique ?? ''}
                      onChange={e => setNoPatologicos(p => ({ ...p, tratamiento_medico_actual_especifique: e.target.value }))}
                      placeholder="ej: Metformina 850 mg, Losartán 50 mg"
                      maxLength={500}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grupo y RH</label>
                <p className="text-xs text-gray-500 mb-1">Tipo de sangre, ej: O+, A-, B+. Si no lo sabe, deje DESCONOCE.</p>
                <select
                  value={noPatologicos.grupo_y_rh ?? ''}
                  onChange={e => setNoPatologicos(p => ({ ...p, grupo_y_rh: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Seleccionar —</option>
                  {GRUPO_RH_VALUES.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tatuajes</label>
                <p className="text-xs text-gray-500 mb-1">Indique si tiene tatuajes visibles. Algunos puestos lo requieren declarar.</p>
                <div className="flex gap-2 mt-1">
                  {['NEGADO', 'SI'].map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setNoPatologicos(p => ({ ...p, tatuajes: opt }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition ${noPatologicos.tatuajes === opt ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}
                    >{opt}</button>
                  ))}
                </div>
                {noPatologicos.tatuajes === 'SI' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Ubicación</label>
                    <input
                      type="text"
                      value={noPatologicos.tatuajes_especifique ?? ''}
                      onChange={e => setNoPatologicos(p => ({ ...p, tatuajes_especifique: e.target.value }))}
                      placeholder="ej: brazo derecho, espalda, tobillo"
                      maxLength={500}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
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
