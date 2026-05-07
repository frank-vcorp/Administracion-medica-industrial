/**
 * @fileoverview Formulario real del estudio "Examen Médico" dentro de la Papeleta de Estudios.
 * Implementa 4 pestañas: Somatometría, Signos Vitales, Agudeza Visual y Examen Médico.
 * Las pestañas 1-3 son prerrequisito para acceder a la pestaña 4 (Examen Médico).
 * @id IMPL-20260506-10
 * @spec ARCH-20260506-06
 * @backup context/checkpoints/CHK_IMPL-20260506-10.md
 * @intervention ARCH-20260325-05, ARCH-20260326-07, ARCH-20260326-10
 */
"use client"

import { useState, useTransition } from "react"
import { saveExamenMedicoPapeleta, updateSomatometria, updateAgudezaVisual } from "@/actions/medical-exam.actions"
import { updateEventTestStatus } from "@/actions/event-test.actions"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ExamData = {
  physicalExamData?: Record<string, unknown> | null
  somatometryData?: Record<string, unknown> | null
  eyeAcuityData?: Record<string, unknown> | null
} | null

/** Pestañas externas de Examen Médico — ARCH-20260506-06 */
type OuterTab = 'somatometria' | 'signos_vitales' | 'agudeza_visual' | 'examen_medico'
/** Sub-pestañas del Examen Médico clínico (pestaña 4) */
type InnerTab = 'declarativa' | 'exploracion' | 'impresion'
type M1Tab = 'gine' | 'inmuno'

const VISUAL_FIELDS_NAMES = [
  'vision_lejana_od', 'vision_lejana_oi',
  'vision_cercana_od', 'vision_cercana_oi',
  'lejana_corregida_od', 'lejana_corregida_oi',
  'cercana_corregida_od', 'cercana_corregida_oi',
]

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
  /** ID del EventTest de Somatometría para actualizar su estado al guardar — ARCH-20260506-06 */
  somatometryEventTestId?: string
  /** ID del EventTest de Agudeza Visual para actualizar su estado al guardar — ARCH-20260506-06 */
  agudezaEventTestId?: string
}

// ─── Constantes de formularios ────────────────────────────────────────────────

const VISUAL_FIELDS: { name: string; label: string }[] = [
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
const SEX_OPTIONS = ['Femenino', 'Masculino'] as const
const LONGITUDINAL_SECTIONS: [string, string][] = [
  ['datos_personales', 'Datos Personales'],
  ['historia_laboral', 'Historia Laboral'],
  ['heredo_familiares', 'Heredo-Familiares'],
]
const GINE_FIELDS: [string, string][] = [
  ['m1_gine_menarca', 'Menarca'], ['m1_gine_fum', 'FUM'], ['m1_gine_ivs', 'IVS'],
  ['m1_gine_ritmo', 'Ritmo'], ['m1_gine_gesta', 'Gesta'], ['m1_gine_aborto', 'Aborto'],
  ['m1_gine_parto', 'Parto'], ['m1_gine_cesarea', 'Cesárea'], ['m1_gine_doc', 'DOC'],
  ['m1_gine_fup_uc', 'FUP/FUC'], ['m1_gine_exp_mamaria', 'Exp. Mamaria'], ['m1_gine_mpf', 'MPF'],
]
const INMUNO_FIELDS: [string, string][] = [
  ['m1_vac_rubeola', 'Rubéola'], ['m1_vac_neumococo', 'Neumococo'],
  ['m1_vac_sarampion', 'Sarampión'], ['m1_vac_influenza', 'Influenza'],
  ['m1_vac_toxoide', 'Toxoide Tetánico'], ['m1_vac_hepatitisb', 'Hepatitis B'],
  ['m1_vac_otras', 'Otras'],
]
const RESUMEN_CLINICO_FIELDS: [string, string][] = [
  ['estado_nutricional', 'Estado Nutricional'],
  ['salud_bucal', 'Salud Bucal'],
  ['agudeza_visual_resumen', 'Agudeza Visual'],
  ['presion_arterial_resumen', 'Presión Arterial'],
]

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
  somatometryEventTestId,
  agudezaEventTestId,
}: ExamenMedicoEstudioProps) {
  const physicalExamData = (examData?.physicalExamData ?? {}) as Record<string, unknown>
  const initSomatometryData = (examData?.somatometryData ?? {}) as Record<string, unknown>
  const initEyeAcuityData = (examData?.eyeAcuityData ?? {}) as Record<string, unknown>

  // ── Estado Examen Médico (pestaña 4 — existente) ──────────────────────────
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(physicalExamData).map(([k, v]) => [k, String(v ?? '')])
    )
  )
  const [aptitud, setAptitud] = useState<string>(
    (physicalExamData.aptitud as string) ?? ''
  )
  const [activeInnerTab, setActiveInnerTab] = useState<InnerTab>('declarativa')
  const [isPending, startTransition] = useTransition()
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [aiWarning, setAiWarning] = useState('')

  // Estado Módulo 1
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

  // ── Estado Somatometría (pestaña 1) ───────────────────────────────────────
  const [somaForm, setSomaForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initSomatometryData).map(([k, v]) => [k, String(v ?? '')])
    )
  )
  const [isSavingSoma, setIsSavingSoma] = useState(false)
  const [somaSaveMsg, setSomaSaveMsg] = useState('')
  // "terminada" si el dato ya existe en DB o fue guardado en esta sesión
  const [somaCompleted, setSomaCompleted] = useState<boolean>(
    !!(initSomatometryData.peso_kg || initSomatometryData.talla_m)
  )

  // ── Estado Signos Vitales (pestaña 2) ─────────────────────────────────────
  // Los campos de vitales viven en somatometryData — se inician desde los mismos datos
  const [vitalsForm, setVitalsForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initSomatometryData).map(([k, v]) => [k, String(v ?? '')])
    )
  )
  const [isSavingVitals, setIsSavingVitals] = useState(false)
  const [vitalsSaveMsg, setVitalsSaveMsg] = useState('')
  const [vitalsCompleted, setVitalsCompleted] = useState<boolean>(
    !!(initSomatometryData.ta_sistolica || initSomatometryData.fc_min)
  )

  // ── Estado Agudeza Visual (pestaña 3) ─────────────────────────────────────
  const [agudezaForm, setAgudezaForm] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(VISUAL_FIELDS_NAMES.map(f => [f, NO_APLICA])),
    reflejos: 'PRESENTES Y NORMOREFLECTICOS',
    campimetria: '',
    test_ishihara: '',
    ...Object.fromEntries(
      Object.entries(initEyeAcuityData).map(([k, v]) => [k, String(v ?? '')])
    ),
  }))
  const [isSavingAgudeza, setIsSavingAgudeza] = useState(false)
  const [agudezaSaveMsg, setAgudezaSaveMsg] = useState('')
  const [agudezaCompleted, setAgudezaCompleted] = useState<boolean>(
    Object.keys(initEyeAcuityData).length > 0
  )

  // ── Pestaña activa externa (1-4) ──────────────────────────────────────────
  const [outerTab, setOuterTab] = useState<OuterTab>('somatometria')

  // ── Bloqueo de pestaña 4 ─────────────────────────────────────────────────
  const canAccessExamen = somaCompleted && vitalsCompleted && agudezaCompleted

  // ── Cálculos derivados Somatometría ───────────────────────────────────────
  const peso = parseFloat(somaForm.peso_kg) || 0
  const talla = parseFloat(somaForm.talla_m) || 0
  const imc = peso > 0 && talla > 0 ? (peso / (talla * talla)).toFixed(2) : '0.00'
  let complexion = 'NORMAL'
  if (parseFloat(imc) > 29.9) complexion = 'OBESIDAD'
  else if (parseFloat(imc) > 24.9) complexion = 'SOBREPESO'
  else if (parseFloat(imc) < 18.5 && parseFloat(imc) > 0) complexion = 'BAJO PESO'

  // ── Indicadores de completitud para ExamenMedico (pestaña 4) ─────────────
  const hasPhysicalExam = Object.keys(physicalExamData).some(k => physicalExamData[k] !== null && physicalExamData[k] !== '')
  const hasAptitud = !!physicalExamData.aptitud || !!physicalExamData.impresion_diagnostica
  const hasM1 = Object.entries(modulo1).some(([, v]) => v && v.trim() !== '' && v !== 'NEGADO' && v !== 'NO')
  const longitudinalReference = prefilledData ?? longitudinalData ?? null
  const hasLongitudinalReference = !!longitudinalReference && Object.keys(longitudinalReference).length > 0
  const longitudinalReferenceLabel = prefilledData
    ? 'Snapshot del portal disponible abajo.'
    : 'Resumen longitudinal maestro disponible abajo.'

  const innerTabs: { id: InnerTab; label: string; icon: string; done: boolean }[] = [
    { id: 'declarativa', label: 'Módulo 1', icon: '📋', done: hasM1 },
    { id: 'exploracion', label: 'Exploración Física', icon: '🩺', done: hasPhysicalExam },
    { id: 'impresion', label: 'Impresión y Aptitud', icon: '✅', done: hasAptitud },
  ]

  // ── Handlers ──────────────────────────────────────────────────────────────
  function setM1Field(key: string, value: string) {
    setModulo1(prev => ({ ...prev, [key]: value }))
  }
  function handleField(name: string, value: string) {
    setForm(prev => ({ ...prev, [name]: value }))
  }
  function buildPayload() {
    return { ...form, aptitud: aptitud || undefined, modulo1 }
  }

  async function handleSaveSoma(markComplete: boolean) {
    setIsSavingSoma(true)
    setSomaSaveMsg('')
    const payload = { ...somaForm, ...vitalsForm, imc: parseFloat(imc), complexion }
    const res = await updateSomatometria(eventId, payload)
    if (res.success) {
      setSomaSaveMsg(markComplete ? '🏁 Somatometría completada.' : '✅ Datos guardados.')
      setSomaCompleted(true)
      if (somatometryEventTestId) {
        const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
        await updateEventTestStatus(
          somatometryEventTestId,
          newStatus as Parameters<typeof updateEventTestStatus>[1],
          eventId
        )
      }
    } else {
      setSomaSaveMsg('❌ Error: ' + (res.error ?? 'Error al guardar'))
    }
    setIsSavingSoma(false)
  }

  async function handleSaveVitals(markComplete: boolean) {
    setIsSavingVitals(true)
    setVitalsSaveMsg('')
    // Vitales se guardan junto con datos de soma (merge en somatometryData)
    const currentSoma = { ...somaForm }
    const payload = { ...currentSoma, ...vitalsForm, imc: parseFloat(imc), complexion }
    const res = await updateSomatometria(eventId, payload)
    if (res.success) {
      setVitalsSaveMsg(markComplete ? '🏁 Signos Vitales completados.' : '✅ Datos guardados.')
      setVitalsCompleted(true)
      if (somatometryEventTestId) {
        const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
        await updateEventTestStatus(
          somatometryEventTestId,
          newStatus as Parameters<typeof updateEventTestStatus>[1],
          eventId
        )
      }
    } else {
      setVitalsSaveMsg('❌ Error: ' + (res.error ?? 'Error al guardar'))
    }
    setIsSavingVitals(false)
  }

  async function handleSaveAgudeza(markComplete: boolean) {
    setIsSavingAgudeza(true)
    setAgudezaSaveMsg('')
    const res = await updateAgudezaVisual(eventId, agudezaForm)
    if (res.success) {
      setAgudezaSaveMsg(markComplete ? '🏁 Agudeza Visual completada.' : '✅ Datos guardados.')
      setAgudezaCompleted(true)
      if (agudezaEventTestId) {
        const newStatus = markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'
        await updateEventTestStatus(
          agudezaEventTestId,
          newStatus as Parameters<typeof updateEventTestStatus>[1],
          eventId
        )
      }
    } else {
      setAgudezaSaveMsg('❌ Error: ' + (res.error ?? 'Error al guardar'))
    }
    setIsSavingAgudeza(false)
  }

  function handleSave(markComplete: boolean) {
    setSaveMsg('')
    setSaveError('')
    setAiWarning('')
    startTransition(async () => {
      const payload = buildPayload()
      const res = await saveExamenMedicoPapeleta(eventId, eventTestId, payload, markComplete)
      if (res.success) {
        setSaveMsg(markComplete ? '🏁 Examen Médico completado.' : '✅ Borrador guardado.')
        if (res.aiWarning) {
          setAiWarning(`La captura clínica se guardó, pero la IA no pudo generar prediagnóstico: ${res.aiWarning}`)
        }
        onStatusChange?.(res.status ?? (markComplete ? 'COMPLETED' : 'RESULT_REGISTERED'))
      } else {
        setSaveError(res.error ?? 'Error al guardar')
      }
    })
  }

  // ── Pestañas externas ─────────────────────────────────────────────────────
  const outerTabs: { id: OuterTab; label: string; icon: string; done: boolean; locked: boolean }[] = [
    { id: 'somatometria', label: 'Somatometría', icon: '⚖️', done: somaCompleted, locked: false },
    { id: 'signos_vitales', label: 'Signos Vitales', icon: '💓', done: vitalsCompleted, locked: false },
    { id: 'agudeza_visual', label: 'Agudeza Visual', icon: '👁️', done: agudezaCompleted, locked: false },
    { id: 'examen_medico', label: 'Examen Médico', icon: '📋', done: hasAptitud, locked: !canAccessExamen },
  ]
  const modulo1Tabs: [M1Tab, string, string][] = [
    ...(modulo1['m1_sexo'] === 'Femenino' ? [['gine', '♀️', 'Ginecológicos'] as [M1Tab, string, string]] : []),
    ['inmuno', '💉', 'Inmunizaciones'],
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Pestañas externas (1-4) ────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {outerTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.locked) return
              setOuterTab(tab.id)
            }}
            disabled={tab.locked}
            title={tab.locked ? 'Completa Somatometría, Signos Vitales y Agudeza Visual primero' : undefined}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-1 justify-center ${
              outerTab === tab.id
                ? 'bg-white shadow text-teal-700'
                : tab.locked
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.done && !tab.locked && <span className="text-emerald-500 text-[10px]">●</span>}
            {tab.locked && <span className="text-slate-300 text-[10px]">🔒</span>}
          </button>
        ))}
      </div>

      {/* Banner de bloqueo visible cuando el médico intenta ir a Examen Médico sin completar prereqs */}
      {outerTab !== 'examen_medico' && !canAccessExamen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
          <span className="text-amber-500 text-sm mt-0.5">🔒</span>
          <p className="text-xs text-amber-800">
            <strong>Examen Médico bloqueado.</strong> Completa y guarda{' '}
            {[!somaCompleted && 'Somatometría', !vitalsCompleted && 'Signos Vitales', !agudezaCompleted && 'Agudeza Visual']
              .filter(Boolean)
              .join(', ')}{' '}
            para habilitar la pestaña 4.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 1: SOMATOMETRÍA                                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'somatometria' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5">
            <span className="text-teal-600">⚖️</span>
            <p className="text-xs font-bold text-teal-800">Somatometría — Peso, Talla e IMC</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Peso (KG)</label>
              <input
                type="number" step="0.1"
                value={somaForm.peso_kg || ''}
                onChange={e => setSomaForm(prev => ({ ...prev, peso_kg: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-teal-500 text-lg font-mono placeholder-slate-300 disabled:opacity-60"
                placeholder="Ej: 75.5"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Talla (Metros)</label>
              <input
                type="number" step="0.01"
                value={somaForm.talla_m || ''}
                onChange={e => setSomaForm(prev => ({ ...prev, talla_m: e.target.value }))}
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
                complexion === 'NORMAL' ? 'bg-green-100 text-green-700' :
                complexion === 'SOBREPESO' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              }`}>
                {complexion}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3 flex-wrap">
            <p className="text-sm font-medium text-slate-500">{somaSaveMsg}</p>
            {!readonly && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveSoma(false)}
                  disabled={isSavingSoma}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingSoma ? 'Guardando...' : 'Guardar borrador'}
                </button>
                <button
                  onClick={() => handleSaveSoma(true)}
                  disabled={isSavingSoma}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-teal-200 transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingSoma ? 'Guardando...' : '✓ Completar Somatometría'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 2: SIGNOS VITALES                                     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'signos_vitales' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
            <span className="text-rose-600">💓</span>
            <p className="text-xs font-bold text-rose-800">Signos Vitales — Tensión Arterial, FC, Temperatura y Perímetros</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-2">TENSIÓN ARTERIAL (Sist / Diast)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={vitalsForm.ta_sistolica || ''}
                  onChange={e => setVitalsForm(prev => ({ ...prev, ta_sistolica: e.target.value }))}
                  disabled={readonly}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 font-mono text-center disabled:opacity-60"
                  placeholder="120"
                />
                <span className="text-slate-400 font-bold text-xl">/</span>
                <input
                  type="number"
                  value={vitalsForm.ta_diastolica || ''}
                  onChange={e => setVitalsForm(prev => ({ ...prev, ta_diastolica: e.target.value }))}
                  disabled={readonly}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 font-mono text-center disabled:opacity-60"
                  placeholder="80"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Frec. Cardiaca</label>
              <input
                type="number"
                value={vitalsForm.fc_min || ''}
                onChange={e => setVitalsForm(prev => ({ ...prev, fc_min: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-mono disabled:opacity-60"
                placeholder="BPM"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Temperatura</label>
              <input
                type="number" step="0.1"
                value={vitalsForm.temperatura || ''}
                onChange={e => setVitalsForm(prev => ({ ...prev, temperatura: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-mono disabled:opacity-60"
                placeholder="°C"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Frec. Respiratoria</label>
              <input
                type="number"
                value={vitalsForm.fr_min || ''}
                onChange={e => setVitalsForm(prev => ({ ...prev, fr_min: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-mono disabled:opacity-60"
                placeholder="RPM"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Cintura (cm)</label>
              <input
                type="number" step="0.1"
                value={vitalsForm.perimetro_cintura || ''}
                onChange={e => setVitalsForm(prev => ({ ...prev, perimetro_cintura: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-mono disabled:opacity-60"
                placeholder="cm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Cadera (cm)</label>
              <input
                type="number" step="0.1"
                value={vitalsForm.perimetro_cadera || ''}
                onChange={e => setVitalsForm(prev => ({ ...prev, perimetro_cadera: e.target.value }))}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 text-center font-mono disabled:opacity-60"
                placeholder="cm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3 flex-wrap">
            <p className="text-sm font-medium text-slate-500">{vitalsSaveMsg}</p>
            {!readonly && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveVitals(false)}
                  disabled={isSavingVitals}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingVitals ? 'Guardando...' : 'Guardar borrador'}
                </button>
                <button
                  onClick={() => handleSaveVitals(true)}
                  disabled={isSavingVitals}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-rose-200 transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingVitals ? 'Guardando...' : '✓ Completar Signos Vitales'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 3: AGUDEZA VISUAL                                     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'agudeza_visual' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
            <span className="text-indigo-600">👁️</span>
            <p className="text-xs font-bold text-indigo-800">Agudeza Visual — Campo Visual y Pruebas Complementarias</p>
          </div>

          {/* Campo Visual */}
          <div>
            <h4 className="text-sm font-bold text-slate-600 mb-3 uppercase border-b pb-2">Campo Visual</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {VISUAL_FIELDS.map(f => (
                <div key={f.name}>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">{f.label}</label>
                  <input
                    type="text"
                    value={agudezaForm[f.name] || ''}
                    onChange={e => setAgudezaForm(prev => ({ ...prev, [f.name]: e.target.value }))}
                    disabled={readonly}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm disabled:opacity-60"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pruebas Complementarias */}
          <div>
            <h4 className="text-sm font-bold text-slate-600 mb-3 uppercase border-b pb-2">Pruebas Complementarias</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                ['campimetria', 'Campimetría'],
                ['test_ishihara', 'Test Ishihara'],
                ['reflejos', 'Reflejos'],
              ] as [string, string][]).map(([name, label]) => (
                <div key={name}>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">{label}</label>
                  <input
                    type="text"
                    value={agudezaForm[name] || ''}
                    onChange={e => setAgudezaForm(prev => ({ ...prev, [name]: e.target.value }))}
                    disabled={readonly}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-60"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3 flex-wrap">
            <p className="text-sm font-medium text-slate-500">{agudezaSaveMsg}</p>
            {!readonly && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveAgudeza(false)}
                  disabled={isSavingAgudeza}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingAgudeza ? 'Guardando...' : 'Guardar borrador'}
                </button>
                <button
                  onClick={() => handleSaveAgudeza(true)}
                  disabled={isSavingAgudeza}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 text-sm"
                >
                  {isSavingAgudeza ? 'Guardando...' : '✓ Completar Agudeza Visual'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PESTAÑA 4: EXAMEN MÉDICO (bloqueada si no completan 1-3)      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {outerTab === 'examen_medico' && !canAccessExamen && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center space-y-3">
          <div className="text-4xl">🔒</div>
          <p className="text-base font-bold text-amber-800">Examen Médico bloqueado</p>
          <p className="text-sm text-amber-700">
            Para acceder a esta sección debes completar primero:
          </p>
          <ul className="text-sm text-amber-700 space-y-1">
            {!somaCompleted && (
              <li>
                <button onClick={() => setOuterTab('somatometria')} className="underline font-semibold hover:text-amber-900">
                  ⚖️ Somatometría
                </button>
              </li>
            )}
            {!vitalsCompleted && (
              <li>
                <button onClick={() => setOuterTab('signos_vitales')} className="underline font-semibold hover:text-amber-900">
                  💓 Signos Vitales
                </button>
              </li>
            )}
            {!agudezaCompleted && (
              <li>
                <button onClick={() => setOuterTab('agudeza_visual')} className="underline font-semibold hover:text-amber-900">
                  👁️ Agudeza Visual
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      {outerTab === 'examen_medico' && canAccessExamen && (
        <div className="space-y-4">
          {/* Sub-tabs internos del Examen Médico */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
            {innerTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveInnerTab(tab.id)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-1 justify-center ${
                  activeInnerTab === tab.id
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

          {/* ── Sub-tab 1: Módulo 1 — Cuestionario del Paciente ── */}
          {activeInnerTab === 'declarativa' && (
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
                {SEX_OPTIONS.map(opt => (
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
                    {LONGITUDINAL_SECTIONS.map(([sKey, sLabel]) => {
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
              {modulo1Tabs.map(([id, icon, lbl]) => (
              <button
                key={id}
                  onClick={() => setM1Tab(id)}
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
                {GINE_FIELDS.map(([key, lbl]) => (
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
                  {INMUNO_FIELDS.map(([key, lbl]) => (
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
            <button onClick={() => setActiveInnerTab('exploracion')}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
              Continuar → Exploración
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 2: Exploración Física ──────────────────────────────── */}
          {activeInnerTab === 'exploracion' && (
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
              onClick={() => setActiveInnerTab('declarativa')}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-2.5 rounded-xl transition-colors"
            >
              ← Antecedentes
            </button>
            <button
              onClick={() => setActiveInnerTab('impresion')}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
            >
              Continuar → Impresión
            </button>
          </div>
        </div>
      )}

      {/* ── Tab 3: Impresión Diagnóstica y Aptitud ────────────────── */}
          {activeInnerTab === 'impresion' && (
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
                {RESUMEN_CLINICO_FIELDS.map(([field, label]) => (
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
          {aiWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 font-medium">
              ⚠️ {aiWarning}
            </div>
          )}

          {/* Acciones de guardado */}
          {!readonly && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setActiveInnerTab('exploracion')}
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
