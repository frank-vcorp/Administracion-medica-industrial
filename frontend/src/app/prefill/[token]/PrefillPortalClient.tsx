'use client'

/**
 * @fileoverview Formulario cliente del Portal Público de Prellenado — Módulo 1
 * @description Permite al trabajador capturar antecedentes médicos declarativos
 *              antes de su cita. Secciones: Datos Personales, Historia Laboral,
 *              Antecedentes Heredo-Familiares.
 * @see SPEC ARCH-20260324-09, ARCH-20260325-06
 * @id IMPL-20260325-01
 */

import { useState } from 'react'
import { savePartialModule1, submitModule1 } from '@/actions/prefilled-invitation.actions'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type Turno = 'MATUTINO' | 'VESPERTINO' | 'NOCTURNO' | 'MIXTO'
type EstadoCivil = 'SOLTERO' | 'CASADO' | 'UNION_LIBRE' | 'DIVORCIADO' | 'VIUDO' | 'OTRO'

interface DatosPersonales {
  puesto_actual?: string
  area_departamento?: string
  turno?: Turno
  antiguedad_anios?: number
  antiguedad_meses?: number
  estado_civil?: EstadoCivil
  escolaridad?: string
  numero_hijos?: number
}

interface HistoriaLaboral {
  empresa_anterior_1?: string
  puesto_anterior_1?: string
  tiempo_anterior_1?: string
  empresa_anterior_2?: string
  puesto_anterior_2?: string
  tiempo_anterior_2?: string
  accidentes_trabajo?: boolean
  accidentes_descripcion?: string
  enfermedades_trabajo?: boolean
  enfermedades_descripcion?: string
}

interface HeredoFamiliares {
  diabetes?: string
  has?: string
  epilepsia?: string
  cardiopatia?: string
  renales?: string
  asma?: string
  cancer?: string
  otras?: string
}

interface FormData {
  datos_personales?: DatosPersonales
  historia_laboral?: HistoriaLaboral
  heredo_familiares?: HeredoFamiliares
}

type Tab = 'datos_personales' | 'historia_laboral' | 'heredo_familiares'

interface Props {
  token: string
  workerName: string
  companyName: string
  scheduledAt: string
  expiresAt: string
  existingData: Record<string, unknown> | null
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function InputField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  name: string
  value: string | number | undefined
  onChange: (val: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white"
      />
    </div>
  )
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (val: T) => void
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
        {label}
      </label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
      >
        <option value="">— Seleccionar —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function BooleanField({
  label,
  value,
  detailLabel,
  detailValue,
  onBoolChange,
  onDetailChange,
}: {
  label: string
  value: boolean | undefined
  detailLabel: string
  detailValue: string | undefined
  onBoolChange: (v: boolean) => void
  onDetailChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex-1">
          {label}
        </label>
        <div className="flex gap-2">
          {(['Sí', 'No'] as const).map((opt) => {
            const isYes = opt === 'Sí'
            const active = value === isYes
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onBoolChange(isYes)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>
      {value === true && (
        <input
          type="text"
          placeholder={detailLabel}
          value={detailValue ?? ''}
          onChange={(e) => onDetailChange(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PrefillPortalClient({
  token,
  workerName,
  companyName,
  scheduledAt,
  expiresAt,
  existingData,
}: Props) {
  const [formData, setFormData] = useState<FormData>({
    datos_personales: (existingData?.datos_personales as DatosPersonales) ?? {},
    historia_laboral:  (existingData?.historia_laboral  as HistoriaLaboral) ?? {},
    heredo_familiares: (existingData?.heredo_familiares as HeredoFamiliares) ?? {},
  })
  const [activeTab, setActiveTab] = useState<Tab>('datos_personales')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Helpers de actualización de sección ────────────────────────────────────

  const updateDP = (patch: Partial<DatosPersonales>) =>
    setFormData((p) => ({ ...p, datos_personales: { ...p.datos_personales, ...patch } }))

  const updateHL = (patch: Partial<HistoriaLaboral>) =>
    setFormData((p) => ({ ...p, historia_laboral: { ...p.historia_laboral, ...patch } }))

  const updateHF = (patch: Partial<HeredoFamiliares>) =>
    setFormData((p) => ({ ...p, heredo_familiares: { ...p.heredo_familiares, ...patch } }))

  // ── Acciones ───────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    setSaving(true)
    setMessage(null)
    const res = await savePartialModule1(token, formData)
    setSaving(false)
    if (res.success) {
      setMessage({ type: 'success', text: '✓ Borrador guardado. Puedes retomar más tarde.' })
    } else {
      setMessage({ type: 'error', text: res.error ?? 'Error al guardar borrador.' })
    }
  }

  const handleSubmit = async () => {
    if (!confirm('¿Confirmas el envío definitivo? No podrás modificar los datos después.')) return
    setSubmitting(true)
    setMessage(null)
    const res = await submitModule1(token, formData)
    setSubmitting(false)
    if (res.success) {
      setSubmitted(true)
    } else {
      setMessage({ type: 'error', text: res.error ?? 'Error al enviar.' })
    }
  }

  // ── Estado: enviado ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-4xl">
            ✅
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">¡Datos enviados!</h1>
            <p className="text-slate-500 text-sm mt-3 leading-relaxed">
              Gracias, <strong>{workerName}</strong>. Tus antecedentes médicos han sido
              registrados y el médico los revisará durante tu cita el{' '}
              {formatDateTime(scheduledAt)}.
            </p>
          </div>
          <div className="border-t border-slate-100 pt-4 text-xs text-slate-400">
            Sistema de Gestión Médica Industrial · AMI
          </div>
        </div>
      </div>
    )
  }

  // ── Tab definitions ────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'datos_personales',  label: 'Datos Personales', emoji: '👤' },
    { id: 'historia_laboral',  label: 'Historia Laboral', emoji: '🏭' },
    { id: 'heredo_familiares', label: 'Familia / Heredo',  emoji: '🧬' },
  ]

  const dp = formData.datos_personales ?? {}
  const hl = formData.historia_laboral ?? {}
  const hf = formData.heredo_familiares ?? {}

  // ── Render principal ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-blue-700 text-white">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">
                Formulario de Antecedentes Médicos
              </p>
              <h1 className="text-xl font-black mt-1">{workerName}</h1>
              <p className="text-blue-100 text-sm">{companyName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">
                Cita programada
              </p>
              <p className="text-sm font-bold">{formatDateTime(scheduledAt)}</p>
              <p className="text-blue-300 text-[10px] mt-1">
                Expira: {formatDateTime(expiresAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-bold transition-all border-b-2 ${
                  activeTab === t.id
                    ? 'text-blue-700 border-blue-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                <span>{t.emoji}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form Body */}
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* ── Sección 1: Datos Personales ─── */}
        {activeTab === 'datos_personales' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-base font-black text-slate-800">
              👤 Datos Personales Declarativos
            </h2>
            <p className="text-xs text-slate-500">
              Información sobre tu puesto y situación personal.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Puesto actual"
                name="puesto_actual"
                value={dp.puesto_actual}
                onChange={(v) => updateDP({ puesto_actual: v })}
                placeholder="Ej: Operador de producción"
              />
              <InputField
                label="Área / Departamento"
                name="area_departamento"
                value={dp.area_departamento}
                onChange={(v) => updateDP({ area_departamento: v })}
                placeholder="Ej: Manufactura"
              />
              <SelectField<Turno>
                label="Turno"
                value={dp.turno}
                options={[
                  { value: 'MATUTINO',  label: 'Matutino'  },
                  { value: 'VESPERTINO', label: 'Vespertino' },
                  { value: 'NOCTURNO',  label: 'Nocturno'  },
                  { value: 'MIXTO',     label: 'Mixto'     },
                ]}
                onChange={(v) => updateDP({ turno: v })}
              />
              <SelectField<EstadoCivil>
                label="Estado civil"
                value={dp.estado_civil}
                options={[
                  { value: 'SOLTERO',     label: 'Soltero/a'      },
                  { value: 'CASADO',      label: 'Casado/a'       },
                  { value: 'UNION_LIBRE', label: 'Unión libre'    },
                  { value: 'DIVORCIADO',  label: 'Divorciado/a'   },
                  { value: 'VIUDO',       label: 'Viudo/a'        },
                  { value: 'OTRO',        label: 'Otro'           },
                ]}
                onChange={(v) => updateDP({ estado_civil: v })}
              />
              <InputField
                label="Antigüedad (años)"
                name="antiguedad_anios"
                type="number"
                value={dp.antiguedad_anios}
                onChange={(v) => updateDP({ antiguedad_anios: parseInt(v) || 0 })}
                placeholder="0"
              />
              <InputField
                label="Antigüedad (meses)"
                name="antiguedad_meses"
                type="number"
                value={dp.antiguedad_meses}
                onChange={(v) => updateDP({ antiguedad_meses: parseInt(v) || 0 })}
                placeholder="0"
              />
              <InputField
                label="Escolaridad"
                name="escolaridad"
                value={dp.escolaridad}
                onChange={(v) => updateDP({ escolaridad: v })}
                placeholder="Ej: Bachillerato"
              />
              <InputField
                label="Número de hijos"
                name="numero_hijos"
                type="number"
                value={dp.numero_hijos}
                onChange={(v) => updateDP({ numero_hijos: parseInt(v) || 0 })}
                placeholder="0"
              />
            </div>
          </div>
        )}

        {/* ── Sección 2: Historia Laboral ─── */}
        {activeTab === 'historia_laboral' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <h2 className="text-base font-black text-slate-800">🏭 Historia Laboral</h2>
            <p className="text-xs text-slate-500">
              Empleos anteriores y antecedentes de riesgos laborales.
            </p>

            {/* Empleo anterior 1 */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                Empleo anterior 1
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InputField
                  label="Empresa"
                  name="empresa_anterior_1"
                  value={hl.empresa_anterior_1}
                  onChange={(v) => updateHL({ empresa_anterior_1: v })}
                />
                <InputField
                  label="Puesto"
                  name="puesto_anterior_1"
                  value={hl.puesto_anterior_1}
                  onChange={(v) => updateHL({ puesto_anterior_1: v })}
                />
                <InputField
                  label="Duración"
                  name="tiempo_anterior_1"
                  value={hl.tiempo_anterior_1}
                  onChange={(v) => updateHL({ tiempo_anterior_1: v })}
                  placeholder="Ej: 2 años"
                />
              </div>
            </div>

            {/* Empleo anterior 2 */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                Empleo anterior 2
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InputField
                  label="Empresa"
                  name="empresa_anterior_2"
                  value={hl.empresa_anterior_2}
                  onChange={(v) => updateHL({ empresa_anterior_2: v })}
                />
                <InputField
                  label="Puesto"
                  name="puesto_anterior_2"
                  value={hl.puesto_anterior_2}
                  onChange={(v) => updateHL({ puesto_anterior_2: v })}
                />
                <InputField
                  label="Duración"
                  name="tiempo_anterior_2"
                  value={hl.tiempo_anterior_2}
                  onChange={(v) => updateHL({ tiempo_anterior_2: v })}
                  placeholder="Ej: 1 año"
                />
              </div>
            </div>

            {/* Accidentes y enfermedades */}
            <div className="space-y-4 pt-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                Antecedentes de salud laboral
              </p>
              <BooleanField
                label="¿Ha tenido accidentes de trabajo?"
                value={hl.accidentes_trabajo}
                detailLabel="Describe brevemente el accidente"
                detailValue={hl.accidentes_descripcion}
                onBoolChange={(v) => updateHL({ accidentes_trabajo: v })}
                onDetailChange={(v) => updateHL({ accidentes_descripcion: v })}
              />
              <BooleanField
                label="¿Ha padecido enfermedades de trabajo?"
                value={hl.enfermedades_trabajo}
                detailLabel="Describe brevemente la enfermedad"
                detailValue={hl.enfermedades_descripcion}
                onBoolChange={(v) => updateHL({ enfermedades_trabajo: v })}
                onDetailChange={(v) => updateHL({ enfermedades_descripcion: v })}
              />
            </div>
          </div>
        )}

        {/* ── Sección 3: Heredo-Familiares ─── */}
        {activeTab === 'heredo_familiares' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-base font-black text-slate-800">🧬 Antecedentes Heredo-Familiares</h2>
            <p className="text-xs text-slate-500">
              Indica qué familiar tiene o tuvo estas enfermedades (ej: &quot;Padre&quot;, &quot;Madre&quot;,
              &quot;Abuelo materno&quot;). Deja en blanco si nadie en tu familia lo tiene.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  ['diabetes',    'Diabetes'],
                  ['has',         'Hipertensión (HAS)'],
                  ['epilepsia',   'Epilepsia'],
                  ['cardiopatia', 'Cardiopatía'],
                  ['renales',     'Enf. Renales'],
                  ['asma',        'Asma'],
                  ['cancer',      'Cáncer'],
                ] as [keyof HeredoFamiliares, string][]
              ).map(([field, label]) => (
                <InputField
                  key={field}
                  label={label}
                  name={field}
                  value={hf[field]}
                  onChange={(v) => updateHF({ [field]: v })}
                  placeholder="Ej: Madre, Abuelo"
                />
              ))}
              <div className="sm:col-span-2">
                <InputField
                  label="Otras enfermedades familiares"
                  name="otras"
                  value={hf.otras}
                  onChange={(v) => updateHF({ otras: v })}
                  placeholder="Describe otras condiciones hereditarias relevantes"
                />
              </div>
            </div>
          </div>
        )}

        {/* Mensaje de feedback */}
        {message && (
          <div
            className={`rounded-xl px-5 py-4 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Navegación de secciones */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2">
            {tabs.map((t, i) => {
              const prev = tabs[i - 1]
              const next = tabs[i + 1]
              if (activeTab !== t.id) return null
              return (
                <div key={t.id} className="flex gap-2">
                  {prev && (
                    <button
                      onClick={() => setActiveTab(prev.id)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    >
                      ← {prev.emoji}
                    </button>
                  )}
                  {next && (
                    <button
                      onClick={() => setActiveTab(next.id)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    >
                      {next.emoji} →
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Acciones principales */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              {saving ? 'Guardando…' : '💾 Borrador'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'Enviando…' : '✅ Enviar definitivo'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center pb-4">
          Puedes guardar borrador y retomar más tarde mientras el enlace esté vigente ·
          Sistema de Gestión Médica Industrial · AMI
        </p>
      </div>
    </div>
  )
}
