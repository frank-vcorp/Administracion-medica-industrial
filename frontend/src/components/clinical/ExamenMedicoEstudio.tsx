/**
 * @fileoverview Formulario real del estudio "Examen Médico" dentro de la Papeleta de Estudios.
 * Implementa el Módulo 1 (antecedentes declarativos), Exploración Física e Impresión/Aptitud.
 * Somatometría y Agudeza Visual operan como EventTests independientes (ARCH-20260325-05).
 * @id IMPL-20260325-01
 * @spec ARCH-20260324-04, ARCH-20260324-08, ARCH-20260325-05
 * @backup context/checkpoints/CHK_IMPL-20260325-01.md
 * @intervention ARCH-20260326-07, ARCH-20260326-10
 * @see context/checkpoints/CHK_IMPL-ARCH-20260326-06.md
 */
"use client"

import { useState, useTransition } from "react"
import { saveExamenMedicoPapeleta } from "@/actions/medical-exam.actions"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ExamData = {
  physicalExamData?: Record<string, unknown> | null
} | null

type Tab = 'declarativa' | 'exploracion' | 'impresion'
type M1Tab = 'gine' | 'inmuno'

interface ExamenMedicoEstudioProps {
  eventId: string
  eventTestId: string
  examData: ExamData
  prefilledData?: Record<string, unknown> | null
  longitudinalData?: Record<string, unknown> | null
  readonly?: boolean
  /** Callback para actualizar estado local en el workspace padre */
  onStatusChange?: (status: string) => void
  /** ID del trabajador para CTA hacia Historial Clínico — ARCH-20260326-06 */
  workerId?: string
}

// ─── Campos de Exploración Física (de ExploracionFisicaSchema) ───────────────

const EXPLORACION_FIELDS: { name: string; label: string }[] = [
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
  { name: "ms_superiores", label: "MMSS" },
  { name: "fuerza_muscular_daniels_sup", label: "Fuerza (Daniels Sup)" },
  { name: "ms_inferiores", label: "MMII" },
  { name: "fuerza_muscular_daniels_inf", label: "Fuerza (Daniels Inf)" },
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
  { name: "presencia_quiste_sinovial", label: "Quiste Sinovial" },
  { name: "especificar_quiste", label: "Especificar Quiste" },
]

const APTITUD_OPTIONS = [
  { value: 'APTO', label: '✅ Apto', color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  { value: 'APTO CON RESTRICCIONES', label: '⚠️ Apto con Restricciones', color: 'border-amber-400 bg-amber-50 text-amber-800' },
  { value: 'NO APTO', label: '❌ No Apto', color: 'border-red-400 bg-red-50 text-red-800' },
  { value: 'PENDIENTE DE RESULTADOS', label: '⏳ Pendiente de Resultados', color: 'border-slate-300 bg-slate-50 text-slate-700' },
]

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ExamenMedicoEstudio({
  eventId,
  eventTestId,
  examData,
  prefilledData,
  longitudinalData,
  readonly = false,
  onStatusChange,
  workerId,
}: ExamenMedicoEstudioProps) {
  const physicalExamData = (examData?.physicalExamData ?? {}) as Record<string, unknown>

  // Estado del formulario — se inicializa desde physicalExamData ya guardado
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(physicalExamData).map(([k, v]) => [k, String(v ?? '')])
    )
  )

  const [aptitud, setAptitud] = useState<string>(
    (physicalExamData.aptitud as string) ?? ''
  )

  const [activeTab, setActiveTab] = useState<Tab>('declarativa')
  const [isPending, startTransition] = useTransition()
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')

  // Estado Módulo 1 — solo campos por cita que siguen viviendo en Examen Médico
  const [modulo1, setModulo1] = useState<Record<string, string>>(() => {
    const existing = physicalExamData.modulo1
    return (
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? Object.fromEntries(
            Object.entries(existing as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
          )
        : {}
    )
  })
  const [m1Tab, setM1Tab] = useState<M1Tab>('inmuno')

  function setM1Field(key: string, value: string) {
    setModulo1(prev => ({ ...prev, [key]: value }))
  }

  const hasPhysicalExam = Object.keys(physicalExamData).some(k => physicalExamData[k] !== null && physicalExamData[k] !== '')
  const hasAptitud = !!physicalExamData.aptitud || !!physicalExamData.impresion_diagnostica
  const hasM1 = Object.entries(modulo1).some(([, v]) => v && v.trim() !== '' && v !== 'NEGADO' && v !== 'NO')
  const longitudinalReference = prefilledData ?? longitudinalData ?? null
  const hasLongitudinalReference = !!longitudinalReference && Object.keys(longitudinalReference).length > 0
  const longitudinalReferenceLabel = prefilledData
    ? 'Snapshot del portal disponible abajo.'
    : 'Resumen longitudinal maestro disponible abajo.'

  const tabs: { id: Tab; label: string; icon: string; done: boolean }[] = [
    { id: 'declarativa', label: 'Módulo 1', icon: '📋', done: hasM1 },
    { id: 'exploracion', label: 'Exploración Física', icon: '🩺', done: hasPhysicalExam },
    { id: 'impresion', label: 'Impresión y Aptitud', icon: '✅', done: hasAptitud },
  ]

  function handleField(name: string, value: string) {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function buildPayload() {
    return { ...form, aptitud: aptitud || undefined, modulo1 }
  }

  function handleSave(markComplete: boolean) {
    setSaveMsg('')
    setSaveError('')
    startTransition(async () => {
      const payload = buildPayload()
      const res = await saveExamenMedicoPapeleta(eventId, eventTestId, payload, markComplete)
      if (res.success) {
        setSaveMsg(markComplete ? '🏁 Examen Médico completado.' : '✅ Borrador guardado.')
        onStatusChange?.(res.status ?? (markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'))
      } else {
        setSaveError(res.error ?? 'Error al guardar')
      }
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Tabs de navegación interna */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-white shadow text-teal-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.done && <span className="text-emerald-500 text-[10px]">●</span>}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Módulo 1 — Cuestionario del Paciente (ARCH-20260325-09, ARCH-20260325-05) ── */}
      {activeTab === 'declarativa' && (
        <div className="space-y-3">
          {/* Banner info */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
            <span className="text-teal-600 text-sm mt-0.5">📋</span>
            <p className="text-xs text-teal-800">
              <strong>Módulo 1 — Cuestionario del Paciente.</strong> Captura in-situ dentro del estudio, sin depender del portal público.
              {prefilledData && (
                <span className="ml-1 text-emerald-700 font-semibold">
                  ✓ Snapshot del portal disponible — datos enviados por el trabajador antes de la cita.
                </span>
              )}
            </p>
          </div>

          {/* Sexo — necesario para condicional ginecológicos */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Sexo</span>
            <div className="flex gap-2">
              {(['Femenino', 'Masculino'] as const).map(opt => (
                <button
                  key={opt}
                  disabled={readonly}
                  onClick={() => setM1Field('m1_sexo', opt)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg border-2 transition-colors ${
                    modulo1['m1_sexo'] === opt
                      ? 'bg-teal-100 border-teal-400 text-teal-800'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >{opt}</button>
              ))}
            </div>
          </div>

          {/* ARCH-20260326-06: Referencia al snapshot longitudinal + CTA al Historial Clínico maestro */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="text-blue-500 text-base mt-0.5">📋</span>
                <div>
                  <p className="text-xs font-bold text-blue-800">
                    Datos longitudinales — ahora en Historial Clínico
                  </p>
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    Datos Personales, Historia Laboral, Heredo-Familiares, Patológicos y No Patológicos
                    se editan desde el Historial Clínico del trabajador.
                    {hasLongitudinalReference && <span className="font-semibold"> {longitudinalReferenceLabel}</span>}
                  </p>
                </div>
              </div>
              {workerId && (
                <a
                  href={`/history/${workerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Abrir Historial →
                </a>
              )}
            </div>
            {/* ARCH-20260326-10: Sin snapshot → mensaje de ausencia; con snapshot → panel único (no duplicado) */}
            {!hasLongitudinalReference && (
              <div className="px-4 pb-3 pt-1 border-t border-blue-100">
                <p className="text-[10px] text-blue-500 italic">
                  Sin referencia longitudinal embebida para esta cita. Consulta el Historial Clínico para ver los datos actualizados.
                </p>
              </div>
            )}
            {hasLongitudinalReference && (
              <details className="border-t border-blue-200">
                <summary className="px-4 py-2 cursor-pointer text-[10px] font-bold text-blue-700 select-none">
                  {prefilledData
                    ? 'Ver snapshot del portal (datos declarados por el trabajador antes de esta cita — sólo referencia)'
                    : 'Ver resumen longitudinal maestro (datos persistentes del Historial Clínico)'}
                </summary>
                <div className="px-4 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {([
                    ['datos_personales', '👤 Datos Personales'],
                    ['historia_laboral', '🏭 Historia Laboral'],
                    ['heredo_familiares', '🧬 Heredo-Familiares'],
                  ] as [string, string][]).map(([sKey, sLabel]) => {
                    const section = longitudinalReference[sKey] as Record<string, unknown> | undefined
                    if (!section || typeof section !== 'object') return null
                    const entries = Object.entries(section).filter(([, v]) => v !== undefined && v !== '' && v !== null)
                    if (!entries.length) return null
                    return (
                      <div key={sKey} className="col-span-full">
                        <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mb-1">{sLabel}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                          {entries.map(([k, v]) => (
                            <div key={k} className="bg-white/70 rounded px-2 py-1">
                              <p className="text-[9px] text-blue-400 uppercase">{k.replace(/_/g, ' ')}</p>
                              <p className="text-[10px] text-blue-900 font-semibold">{String(v)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
            )}
          </div>

          {/* Sub-tabs de Módulo 1 — solo antecedentes clínicos de la cita */}
          <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1">
            {([
              ...(modulo1['m1_sexo'] === 'Femenino' ? [['gine', '♀️', 'Ginecológicos']] : []),
              ['inmuno', '💉', 'Inmunizaciones'],
            ] as [string, string, string][]).map(([id, icon, lbl]) => (
              <button
                key={id}
                onClick={() => setM1Tab(id as M1Tab)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors flex-1 justify-center ${
                  m1Tab === id ? 'bg-white shadow text-teal-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{icon}</span>
                <span className="hidden sm:inline">{lbl}</span>
              </button>
            ))}
          </div>

          {/* GINE: Ginecológicos (solo si m1_sexo === Femenino) */}
          {m1Tab === 'gine' && modulo1['m1_sexo'] === 'Femenino' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Antecedentes Ginecológicos</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  ['m1_gine_menarca', 'Menarca'], ['m1_gine_fum', 'FUM'], ['m1_gine_ivs', 'IVS'],
                  ['m1_gine_ritmo', 'Ritmo'], ['m1_gine_gesta', 'Gesta'], ['m1_gine_aborto', 'Aborto'],
                  ['m1_gine_parto', 'Parto'], ['m1_gine_cesarea', 'Cesárea'], ['m1_gine_doc', 'DOC'],
                  ['m1_gine_fup_uc', 'FUP/FUC'], ['m1_gine_exp_mamaria', 'Exp. Mamaria'], ['m1_gine_mpf', 'MPF'],
                ] as [string, string][]).map(([key, lbl]) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{lbl}</label>
                    <input type="text" value={modulo1[key] ?? ''} onChange={e => setM1Field(key, e.target.value)} disabled={readonly}
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">VSA</label>
                <button onClick={() => setM1Field('m1_gine_vsa', modulo1['m1_gine_vsa'] === 'SI' ? 'NO' : 'SI')} disabled={readonly}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border-2 ${modulo1['m1_gine_vsa'] === 'SI' ? 'bg-teal-100 border-teal-400 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  {modulo1['m1_gine_vsa'] || 'NO'}
                </button>
              </div>
            </div>
          )}

          {/* INMUNO: Inmunizaciones */}
          {m1Tab === 'inmuno' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inmunizaciones (reportadas por el paciente)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  ['m1_vac_rubeola', 'Rubéola'], ['m1_vac_neumococo', 'Neumococo'],
                  ['m1_vac_sarampion', 'Sarampión'], ['m1_vac_influenza', 'Influenza'],
                  ['m1_vac_toxoide', 'Toxoide Tetánico'], ['m1_vac_hepatitisb', 'Hepatitis B'],
                  ['m1_vac_otras', 'Otras'],
                ] as [string, string][]).map(([key, lbl]) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{lbl}</label>
                    <input type="text" value={modulo1[key] ?? ''} onChange={e => setM1Field(key, e.target.value)} disabled={readonly}
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" placeholder="Fecha / Estado" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Próxima Dosis / Esquema Completo</label>
                <input type="text" value={modulo1['m1_vac_proxima_dosis'] ?? ''} onChange={e => setM1Field('m1_vac_proxima_dosis', e.target.value)} disabled={readonly}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" />
              </div>
            </div>
          )}

          {/* Nota resumen del médico — siempre visible */}
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nota del médico — resumen de antecedentes</span>
              <textarea rows={3} value={form.antecedentes_medico ?? ''} onChange={e => handleField('antecedentes_medico', e.target.value)} disabled={readonly}
                placeholder="Resumen de antecedentes relevantes para el expediente..."
                className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60" />
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setActiveTab('exploracion')}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
              Continuar → Exploración
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 2: Exploración Física ──────────────────────────────── */}
      {activeTab === 'exploracion' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Hallazgos por aparato y sistema
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {EXPLORACION_FIELDS.map(field => (
                <div key={field.name}>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                    {field.label}
                  </label>
                  <input
                    type="text"
                    value={form[field.name] ?? ''}
                    onChange={e => handleField(field.name, e.target.value)}
                    disabled={readonly}
                    placeholder="Normal"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Guardar borrador desde exploración */}
          {!readonly && (
            <button
              onClick={() => handleSave(false)}
              disabled={isPending}
              className="w-full border-2 border-teal-400 text-teal-700 hover:bg-teal-50 text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : '💾 Guardar borrador'}
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('declarativa')}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-2.5 rounded-xl transition-colors"
            >
              ← Antecedentes
            </button>
            <button
              onClick={() => setActiveTab('impresion')}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
            >
              Continuar → Impresión
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 3: Impresión Diagnóstica y Aptitud ────────────────── */}
      {activeTab === 'impresion' && (
        <div className="space-y-4">
          {/* Selección de Aptitud */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Aptitud laboral
            </p>
            <div className="grid grid-cols-2 gap-2">
              {APTITUD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  disabled={readonly}
                  onClick={() => setAptitud(aptitud === opt.value ? '' : opt.value)}
                  className={`text-xs font-bold px-3 py-3 rounded-xl border-2 transition-all text-left ${
                    aptitud === opt.value
                      ? opt.color + ' border-current ring-2 ring-offset-1 ring-current/30'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 disabled:opacity-60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen Clínico por Sistema — ARCH-20260325-09 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resumen Clínico por Sistema</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['estado_nutricional', 'Estado Nutricional'],
                ['salud_bucal', 'Salud Bucal'],
                ['agudeza_visual_resumen', 'Agudeza Visual'],
                ['presion_arterial_resumen', 'Presión Arterial'],
              ] as [string, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
                  <input type="text" value={form[field] ?? ''} onChange={e => handleField(field, e.target.value)} disabled={readonly}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60" />
                </div>
              ))}
            </div>
          </div>

          {/* Impresión Diagnóstica */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Impresión diagnóstica
              </span>
              <textarea
                rows={4}
                value={form.impresion_diagnostica ?? ''}
                onChange={e => handleField('impresion_diagnostica', e.target.value)}
                disabled={readonly}
                placeholder="Describe los diagnósticos principales o hallazgos clínicos relevantes..."
                className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Restricciones / condicionantes
              </span>
              <textarea
                rows={3}
                value={form.restricciones ?? ''}
                onChange={e => handleField('restricciones', e.target.value)}
                disabled={readonly}
                placeholder="Si aplica, detalla las restricciones o condicionantes laborales..."
                className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Observaciones finales
              </span>
              <textarea
                rows={2}
                value={form.observaciones_finales ?? ''}
                onChange={e => handleField('observaciones_finales', e.target.value)}
                disabled={readonly}
                placeholder="Observaciones adicionales para el expediente..."
                className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
              />
            </label>

            {/* Médicos firmantes — ARCH-20260325-09 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Médico Evaluador (Nombre y Cédula)</span>
                <input type="text" value={form.medico_evaluador ?? ''} onChange={e => handleField('medico_evaluador', e.target.value)} disabled={readonly}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                  placeholder="Dr. Nombre Apellido — Cédula: 0000000" />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Médico Revisor (Nombre y Cédula)</span>
                <input type="text" value={form.medico_revisor ?? ''} onChange={e => handleField('medico_revisor', e.target.value)} disabled={readonly}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
                  placeholder="Dr. Nombre Apellido — Cédula: 0000000" />
              </label>
            </div>
          </div>

          {/* Mensajes de resultado */}
          {saveMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 font-medium">
              {saveMsg}
            </div>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium">
              ❌ {saveError}
            </div>
          )}

          {/* Acciones de guardado */}
          {!readonly && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setActiveTab('exploracion')}
                className="sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
              >
                ← Exploración
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={isPending}
                className="flex-1 border-2 border-teal-400 text-teal-700 hover:bg-teal-50 text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {isPending ? 'Guardando...' : '💾 Guardar borrador'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isPending || !aptitud || !form.impresion_diagnostica}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!aptitud ? 'Selecciona aptitud antes de completar' : !form.impresion_diagnostica ? 'Agrega impresión diagnóstica' : ''}
              >
                {isPending ? 'Guardando...' : '🏁 Completar Examen Médico'}
              </button>
            </div>
          )}

          {readonly && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-400 text-center">
              Vista de solo lectura — expediente cerrado.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
