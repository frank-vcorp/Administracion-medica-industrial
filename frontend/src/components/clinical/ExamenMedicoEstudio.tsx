/**
 * @fileoverview Formulario real del estudio "Examen Médico" dentro de la Papeleta de Estudios.
 * Implementa el Módulo 2 (evaluación clínica del médico), muestra datos heredados de Sala,
 * y captura: antecedentes (por médico si no hay prellenado), exploración física e impresión/aptitud.
 * @id IMPL-20260325-01
 * @spec ARCH-20260324-04, ARCH-20260324-08
 * @backup context/checkpoints/CHK_IMPL-20260325-01.md
 */
"use client"

import { useState, useTransition } from "react"
import { saveExamenMedicoPapeleta } from "@/actions/medical-exam.actions"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ExamData = {
  somatometryData?: Record<string, unknown> | null
  eyeAcuityData?: Record<string, unknown> | null
  physicalExamData?: Record<string, unknown> | null
} | null

type Tab = 'sala' | 'declarativa' | 'exploracion' | 'impresion'
type M1Tab = 'hl' | 'hf' | 'nopat' | 'pat' | 'gine' | 'inmuno'

interface ExamenMedicoEstudioProps {
  eventId: string
  eventTestId: string
  examData: ExamData
  prefilledData?: Record<string, unknown> | null
  readonly?: boolean
  /** Callback para actualizar estado local en el workspace padre */
  onStatusChange?: (status: string) => void
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

// ─── Módulo 1: Antecedentes Patológicos (checklist) — ARCH-20260325-09 ────────────────────────
const PAT_FIELDS: { key: string; label: string }[] = [
  { key: 'm1_pat_diabetes', label: 'Diabetes' },
  { key: 'm1_pat_has', label: 'HAS' },
  { key: 'm1_pat_cancer', label: 'Cáncer' },
  { key: 'm1_pat_cardiopatias', label: 'Cardiopatías' },
  { key: 'm1_pat_bronquitis', label: 'Bronquitis' },
  { key: 'm1_pat_neumonias', label: 'Neumonías' },
  { key: 'm1_pat_tuberculosis', label: 'Tuberculosis' },
  { key: 'm1_pat_exantematicas', label: 'Exantemáticas' },
  { key: 'm1_pat_psiquiatricas', label: 'Psiquiátricas' },
  { key: 'm1_pat_tifoidea', label: 'Tifoidea' },
  { key: 'm1_pat_colitis', label: 'Colitis' },
  { key: 'm1_pat_asma', label: 'Asma' },
  { key: 'm1_pat_alergias', label: 'Alergias' },
  { key: 'm1_pat_parotiditis', label: 'Parotiditis' },
  { key: 'm1_pat_dermatitis', label: 'Dermatitis' },
  { key: 'm1_pat_varices', label: 'Várices' },
  { key: 'm1_pat_hepatitis', label: 'Hepatitis' },
  { key: 'm1_pat_renales', label: 'Renales' },
  { key: 'm1_pat_epilepsia', label: 'Epilepsia' },
  { key: 'm1_pat_vertigo', label: 'Vértigo' },
  { key: 'm1_pat_desmayos', label: 'Desmayos' },
  { key: 'm1_pat_gastritis', label: 'Gastritis' },
  { key: 'm1_pat_fracturas', label: 'Fracturas' },
  { key: 'm1_pat_cirugias', label: 'Cirugías' },
  { key: 'm1_pat_transfusiones', label: 'Transfusiones' },
  { key: 'm1_pat_hernias', label: 'Hernias' },
  { key: 'm1_pat_hemorroides', label: 'Hemorroides' },
  { key: 'm1_pat_traumatismos', label: 'Traumatismos' },
  { key: 'm1_pat_c_vertebral', label: 'Pat. C. Vertebral' },
  { key: 'm1_pat_ginecologicos', label: 'Ginecológicos' },
  { key: 'm1_pat_enf_trans_sexual', label: 'ETS' },
  { key: 'm1_pat_endocrinopatias', label: 'Endocrinopatías' },
  { key: 'm1_pat_migrana', label: 'Migraña' },
]

// No patológicos / toxicomanías — grupos con sub-campos
const NOPAT_ITEMS: { key: string; lbl: string; subs: [string, string][] }[] = [
  { key: 'm1_alcohol', lbl: 'Alcohol', subs: [['m1_alc_edad', 'Edad inicio'], ['m1_alc_freq', 'Frecuencia'], ['m1_alc_susp', 'Suspendido']] },
  { key: 'm1_tabaco', lbl: 'Tabaco', subs: [['m1_tab_edad', 'Edad inicio'], ['m1_tab_freq', 'Frecuencia'], ['m1_tab_cig', 'Cigarros/día'], ['m1_tab_susp', 'Suspendido']] },
  { key: 'm1_drogas', lbl: 'Drogas/Estimulantes', subs: [['m1_drog_esp', 'Especifique'], ['m1_drog_ult', 'Último consumo']] },
  { key: 'm1_ejercicio', lbl: 'Ejercicio', subs: [['m1_ej_tipo', 'Tipo y frecuencia']] },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSomatoValue(key: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  const units: Record<string, string> = {
    ta_sistolica: ' mmHg', ta_diastolica: ' mmHg', fc_min: ' lpm',
    peso_kg: ' kg', talla_m: ' m', perimetro_cintura: ' cm',
    perimetro_cadera: ' cm', fr_min: ' rpm', temperatura: ' °C', imc: '',
  }
  return `${value}${units[key] ?? ''}`
}

const SOMATO_LABELS: Record<string, string> = {
  ta_sistolica: 'TA Sistólica', ta_diastolica: 'TA Diastólica', fc_min: 'FC',
  peso_kg: 'Peso', talla_m: 'Talla', perimetro_cintura: 'Cintura',
  perimetro_cadera: 'Cadera', fr_min: 'FR', temperatura: 'Temperatura',
  imc: 'IMC', complexion: 'Complexión',
}

const VISUAL_LABELS: Record<string, string> = {
  vision_lejana_od: 'Visión Lejana OD', vision_lejana_oi: 'Visión Lejana OI',
  vision_cercana_od: 'Visión Cercana OD', vision_cercana_oi: 'Visión Cercana OI',
  lejana_corregida_od: 'Lejana Corregida OD', lejana_corregida_oi: 'Lejana Corregida OI',
  cercana_corregida_od: 'Cercana Corregida OD', cercana_corregida_oi: 'Cercana Corregida OI',
  reflejos: 'Reflejos', test_ishihara: 'Test Ishihara', campimetria: 'Campimetría',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ExamenMedicoEstudio({
  eventId,
  eventTestId,
  examData,
  prefilledData,
  readonly = false,
  onStatusChange,
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

  const [activeTab, setActiveTab] = useState<Tab>('sala')
  const [isPending, startTransition] = useTransition()
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')

  // Estado Módulo 1 — ARCH-20260325-09
  const [modulo1, setModulo1] = useState<Record<string, string>>(() => {
    const existing = physicalExamData.modulo1
    const base: Record<string, string> =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? Object.fromEntries(
            Object.entries(existing as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
          )
        : {}
    // Inicializar patológicos en NEGADO si no existen
    PAT_FIELDS.forEach(f => { if (!base[f.key]) base[f.key] = 'NEGADO' })
    return base
  })
  const [m1Tab, setM1Tab] = useState<M1Tab>('hl')

  function setM1Field(key: string, value: string) {
    setModulo1(prev => ({ ...prev, [key]: value }))
  }

  const somatometryData = (examData?.somatometryData ?? {}) as Record<string, unknown>
  const eyeAcuityData = (examData?.eyeAcuityData ?? {}) as Record<string, unknown>

  const hasSomatometry = Object.keys(somatometryData).some(k => somatometryData[k] !== null && somatometryData[k] !== '')
  const hasVisualAcuity = Object.keys(eyeAcuityData).some(k => eyeAcuityData[k] !== null && eyeAcuityData[k] !== '')
  const hasPhysicalExam = Object.keys(physicalExamData).some(k => physicalExamData[k] !== null && physicalExamData[k] !== '')
  const hasAptitud = !!physicalExamData.aptitud || !!physicalExamData.impresion_diagnostica
  const hasM1 = Object.entries(modulo1).some(
    ([k, v]) => !k.startsWith('m1_pat_') && v && v.trim() !== '' && v !== 'NEGADO'
  )

  const tabs: { id: Tab; label: string; icon: string; done: boolean }[] = [
    { id: 'sala', label: 'Datos de Sala', icon: '📊', done: hasSomatometry || hasVisualAcuity },
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

      {/* ── Tab 1: Datos heredados de Sala ──────────────────────────────── */}
      {activeTab === 'sala' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <span className="text-amber-500 text-sm mt-0.5">ℹ️</span>
            <p className="text-xs text-amber-800">
              Datos capturados en Sala. Son de referencia para el médico y no se modifican aquí.
            </p>
          </div>

          {/* Somatometría */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-teal-50 border-b border-teal-100 flex items-center gap-2">
              <span className="text-teal-600">⚖️</span>
              <p className="text-sm font-bold text-teal-800">Somatometría y Signos Vitales</p>
              {!hasSomatometry && (
                <span className="ml-auto text-[10px] text-amber-600 font-medium bg-amber-100 px-2 py-0.5 rounded-full">Sin datos</span>
              )}
            </div>
            {hasSomatometry ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
                {Object.entries(somatometryData)
                  .filter(([, v]) => v !== null && v !== '' && v !== undefined)
                  .map(([key, value]) => (
                    <div key={key} className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                        {SOMATO_LABELS[key] ?? key}
                      </p>
                      <p className="text-sm font-semibold text-slate-700 mt-0.5">
                        {formatSomatoValue(key, value)}
                      </p>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="p-4 text-sm text-slate-400">No se han capturado datos de somatometría en Sala.</p>
            )}
          </div>

          {/* Agudeza Visual */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
              <span className="text-blue-600">👁️</span>
              <p className="text-sm font-bold text-blue-800">Agudeza Visual</p>
              {!hasVisualAcuity && (
                <span className="ml-auto text-[10px] text-amber-600 font-medium bg-amber-100 px-2 py-0.5 rounded-full">Sin datos</span>
              )}
            </div>
            {hasVisualAcuity ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
                {Object.entries(eyeAcuityData)
                  .filter(([, v]) => v !== null && v !== '' && v !== undefined && v !== 'NO APLICA')
                  .map(([key, value]) => (
                    <div key={key} className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                        {VISUAL_LABELS[key] ?? key}
                      </p>
                      <p className="text-sm font-semibold text-slate-700 mt-0.5">{String(value)}</p>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="p-4 text-sm text-slate-400">No se han capturado datos de agudeza visual en Sala.</p>
            )}
          </div>

          <button
            onClick={() => setActiveTab('declarativa')}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
          >
            Continuar → Antecedentes
          </button>
        </div>
      )}

      {/* ── Tab 2: Módulo 1 — Cuestionario del Paciente (ARCH-20260325-09) ── */}
      {activeTab === 'declarativa' && (
        <div className="space-y-3">
          {/* Banner info */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
            <span className="text-teal-600 text-sm mt-0.5">📋</span>
            <p className="text-xs text-teal-800">
              <strong>Módulo 1 — Cuestionario del Paciente.</strong> Captura in-situ dentro del estudio, sin depender del portal público.
              {prefilledData && <span className="ml-1 text-emerald-700 font-semibold">✓ Prellenado del trabajador disponible.</span>}
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

          {/* Sub-tabs de Módulo 1 */}
          <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1">
            {([
              ['hl', '🏢', 'Historia Laboral'],
              ['hf', '👨‍👩‍👧', 'Heredo-Familiares'],
              ['nopat', '🍺', 'No Patológicos'],
              ['pat', '🏥', 'Patológicos'],
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

          {/* HL: Historia Laboral */}
          {m1Tab === 'hl' && (
            <div className="space-y-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Empleos Anteriores</p>
                {([['m1_emp1', 'Empleo 1'], ['m1_emp2', 'Empleo 2']] as [string, string][]).map(([prefix, lbl]) => (
                  <div key={prefix} className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">{lbl} — Empresa</label>
                      <input type="text" value={modulo1[prefix + '_empresa'] ?? ''} onChange={e => setM1Field(prefix + '_empresa', e.target.value)} disabled={readonly}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" placeholder="Empresa" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Área / Puesto</label>
                      <input type="text" value={modulo1[prefix + '_puesto'] ?? ''} onChange={e => setM1Field(prefix + '_puesto', e.target.value)} disabled={readonly}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" placeholder="Puesto" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Antigüedad</label>
                      <input type="text" value={modulo1[prefix + '_tiempo'] ?? ''} onChange={e => setM1Field(prefix + '_tiempo', e.target.value)} disabled={readonly}
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" placeholder="Ej: 2 años" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Exposición a Factores de Riesgo</p>
                {([['m1_exp_quim', 'Químico'], ['m1_exp_fis', 'Físico'], ['m1_exp_bio', 'Biológico'], ['m1_exp_ergo', 'Ergonómico']] as [string, string][]).map(([key, lbl]) => (
                  <div key={key} className="flex items-center gap-2">
                    <button onClick={() => setM1Field(key, modulo1[key] === 'SI' ? 'NEGADO' : 'SI')} disabled={readonly}
                      className={`shrink-0 px-3 py-1 text-[10px] font-bold rounded-lg border-2 transition-colors ${modulo1[key] === 'SI' ? 'bg-rose-100 border-rose-400 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      {lbl}
                    </button>
                    {modulo1[key] === 'SI' && (
                      <input type="text" value={modulo1[key + '_desc'] ?? ''} onChange={e => setM1Field(key + '_desc', e.target.value)} disabled={readonly}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-teal-500 outline-none" placeholder="Especifique..." />
                    )}
                  </div>
                ))}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Accidentes / Enfermedades Profesionales</p>
                {([['m1_accidentes', 'Accidente de Trabajo'], ['m1_enf_prof', 'Enfermedad Profesional']] as [string, string][]).map(([key, lbl]) => (
                  <div key={key} className="flex items-center gap-2">
                    <button onClick={() => setM1Field(key, modulo1[key] === 'SI' ? 'NEGADO' : 'SI')} disabled={readonly}
                      className={`shrink-0 px-3 py-1 text-[10px] font-bold rounded-lg border-2 transition-colors ${modulo1[key] === 'SI' ? 'bg-amber-100 border-amber-400 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      {lbl}
                    </button>
                    {modulo1[key] === 'SI' && (
                      <input type="text" value={modulo1[key + '_desc'] ?? ''} onChange={e => setM1Field(key + '_desc', e.target.value)} disabled={readonly}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-teal-500 outline-none" placeholder="Describa..." />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HF: Heredo-Familiares */}
          {m1Tab === 'hf' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Antecedentes Heredo-Familiares — Especifique parentesco si aplica</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  ['m1_hf_has', 'HAS'], ['m1_hf_diabetes', 'Diabetes'], ['m1_hf_asma', 'Asma'],
                  ['m1_hf_epilepsia', 'Epilepsia'], ['m1_hf_cancer', 'Cáncer'], ['m1_hf_cardiopatia', 'Cardiopatía'],
                  ['m1_hf_renales', 'Renales'], ['m1_hf_mentales', 'Mentales'],
                ] as [string, string][]).map(([key, lbl]) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">{lbl}</label>
                    <input type="text" value={modulo1[key] ?? ''} onChange={e => setM1Field(key, e.target.value)} disabled={readonly}
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" placeholder="NEGADO o parentesco" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Otras</label>
                <textarea rows={2} value={modulo1['m1_hf_otras'] ?? ''} onChange={e => setM1Field('m1_hf_otras', e.target.value)} disabled={readonly}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs resize-none focus:ring-1 focus:ring-teal-500 outline-none" placeholder="Otras condiciones hereditarias..." />
              </div>
            </div>
          )}

          {/* NOPAT: No Patológicos y Toxicomanías */}
          {m1Tab === 'nopat' && (
            <div className="space-y-3">
              {NOPAT_ITEMS.map(({ key, lbl, subs }) => (
                <div key={key} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setM1Field(key, modulo1[key] === 'SI' ? 'NEGADO' : 'SI')} disabled={readonly}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border-2 transition-colors ${modulo1[key] === 'SI' ? 'bg-rose-100 border-rose-400 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      {lbl}: {modulo1[key] === 'SI' ? 'SI' : 'NEGADO'}
                    </button>
                  </div>
                  {modulo1[key] === 'SI' && (
                    <div className="grid grid-cols-2 gap-2 pl-2">
                      {subs.map(([sk, slbl]) => (
                        <div key={sk}>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">{slbl}</label>
                          <input type="text" value={modulo1[sk] ?? ''} onChange={e => setM1Field(sk, e.target.value)} disabled={readonly}
                            className="w-full mt-0.5 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-teal-500 outline-none" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Alimentación</label>
                  <select value={modulo1['m1_alimentacion'] || 'BUENA'} onChange={e => setM1Field('m1_alimentacion', e.target.value)} disabled={readonly}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none">
                    {['BUENA', 'REGULAR', 'MALA'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Grupo y RH</label>
                  <input type="text" value={modulo1['m1_grupo_rh'] ?? ''} onChange={e => setM1Field('m1_grupo_rh', e.target.value)} disabled={readonly}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" placeholder="Ej: O+" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setM1Field('m1_tatuajes', modulo1['m1_tatuajes'] === 'SI' ? 'NEGADO' : 'SI')} disabled={readonly}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border-2 transition-colors ${modulo1['m1_tatuajes'] === 'SI' ? 'bg-rose-100 border-rose-400 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    Tatuajes: {modulo1['m1_tatuajes'] === 'SI' ? 'SI' : 'NEGADO'}
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tx Médico Actual</label>
                  <div className="mt-1 flex gap-1">
                    <button onClick={() => setM1Field('m1_tx_actual', modulo1['m1_tx_actual'] === 'SI' ? 'NEGADO' : 'SI')} disabled={readonly}
                      className={`px-2 py-1 text-[10px] font-bold rounded border-2 transition-colors ${modulo1['m1_tx_actual'] === 'SI' ? 'bg-amber-100 border-amber-400 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      {modulo1['m1_tx_actual'] === 'SI' ? 'SI' : 'NEGADO'}
                    </button>
                    {modulo1['m1_tx_actual'] === 'SI' && (
                      <input type="text" value={modulo1['m1_tx_actual_desc'] ?? ''} onChange={e => setM1Field('m1_tx_actual_desc', e.target.value)} disabled={readonly} placeholder="Especifique..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-teal-500 outline-none" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAT: Antecedentes Patológicos */}
          {m1Tab === 'pat' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Antecedentes Personales Patológicos — default NEGADO</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {PAT_FIELDS.map(({ key, label }) => (
                  <button key={key} disabled={readonly}
                    onClick={() => setM1Field(key, modulo1[key] === 'SI' ? 'NEGADO' : 'SI')}
                    className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border-2 transition-colors ${
                      modulo1[key] === 'SI'
                        ? 'bg-rose-100 border-rose-400 text-rose-800'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >{label}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Otras</label>
                  <input type="text" value={modulo1['m1_pat_otras'] ?? ''} onChange={e => setM1Field('m1_pat_otras', e.target.value)} disabled={readonly}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Especifique</label>
                  <input type="text" value={modulo1['m1_pat_especifique'] ?? ''} onChange={e => setM1Field('m1_pat_especifique', e.target.value)} disabled={readonly}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-none" />
                </div>
              </div>
            </div>
          )}

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
            <button onClick={() => setActiveTab('sala')}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-2.5 rounded-xl transition-colors">
              ← Sala
            </button>
            <button onClick={() => setActiveTab('exploracion')}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
              Continuar → Exploración
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 3: Exploración Física ────────────────────────────────────── */}
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

      {/* ── Tab 4: Impresión Diagnóstica y Aptitud ──────────────────────── */}
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
