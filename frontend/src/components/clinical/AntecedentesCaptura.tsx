'use client'

/**
 * @file AntecedentesCaptura — Editor CONTROLADO de los Antecedentes declarativos
 * del paciente, usado como PRIMERA sub-pestaña dentro del estudio "Examen Médico"
 * (inner-tab `antecedentes` de `ExamenMedicoEstudio`).
 *
 * **Responsabilidad:** editar las 5 secciones declarativas del paciente
 * (`datos_personales`, `historia_laboral`, `heredo_familiares`, `no_patologicos`,
 * `patologicos`) y emitir cada cambio al padre (`ExamenMedicoEstudio`) vía
 * `onChange`. El padre acumula el estado y lo persiste junto con el resto del
 * examen vía `saveExamenMedicoPapeleta` (snapshot por cita en
 * `physicalExamData.antecedentes_captured`).
 *
 * **Diferencia con AntecedentesForm.tsx:**
 * - `AntecedentesForm` edita el historial maestro longitudinal (via
 *   `upsertWorkerClinicalHistory`).
 * - `AntecedentesCaptura` edita el snapshot por cita (sub-pestaña del Examen
 *   Médico, persistido por el padre).
 *
 * **Precarga:** la hace el padre (`ExamenMedicoEstudio`) en cascada
 * (snapshot → portal → historial maestro) y la pasa resuelta como `value`.
 *
 * @id IMPL-20260809-02
 * @spec ARCH-20260809-01 v2 — sub-pestaña "Antecedentes" dentro de Examen Médico
 */

import { useEffect, useState } from 'react'
import {
  DATOS_PERSONALES_CAMPOS,
  HISTORIA_LABORAL_EMPLEOS_ANTERIORES_FIELDS,
  HISTORIA_LABORAL_EXPOSICIONES,
  HEREDOFAMILIARES_DESCRIPCIONES,
  NO_PATOLOGICOS_DESCRIPCIONES,
  PATOLOGICOS_DESCRIPCIONES,
  TURNO_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  ALIMENTACION_OPTIONS,
  SI_NEGADO,
  getPatologicosAllFields,
} from '@/lib/antecedentes-fields'
import type { AntecedentesCaptura } from '@/schemas/clinical/exam.schema'
import {
  HEREDOFAMILIARES_VALUES,
  HEREDOFAMILIARES_MENTALES_VALUES,
} from '@/schemas/clinical/exam.schema'

interface AntecedentesCapturaProps {
  /** Estado actual del snapshot (resuelto por el padre). Componente controlado. */
  value: Record<string, unknown>
  /** Callback que el padre usa para actualizar el estado al cambiar un campo. */
  onChange: (next: AntecedentesCaptura) => void
  /** Proveniencia del snapshot persistido (para badge global). Opcional. */
  initialProvenance?: {
    source?: 'portal' | 'longitudinal' | 'captured' | 'mixed'
    updatedAt?: string
    capturedBy?: string
  }
  /** ID del trabajador para CTA hacia Historial Clínico maestro. */
  workerId?: string
  /** Readonly cuando el evento está cerrado (currentStep > 3). */
  readonly?: boolean
  /** Callback para navegar a la siguiente sub-pestaña ("Módulo 1") desde el pie.
   *  IMPL-20260809-03 — affordance UX al pie de Antecedentes (SPEC v2 §6.9). */
  onContinue?: () => void
}

type SectionKey = 'datos_personales' | 'historia_laboral' | 'heredo_familiares' | 'no_patologicos' | 'patologicos'

/**
 * IMPL-20260809-01 (v1, conservado en v2): claves declaradas como
 * `z.enum(...).optional()` en `DatosPersonalesModulo1Schema`
 * (`history.schema.ts:13,16`). Aceptan `undefined` (clave omitida) o un
 * literal del enum, pero NO la cadena vacía. Antes de emitir `onChange`,
 * eliminamos las claves vacías de esos campos para que Zod no rechace con
 * `expected enum, received string`.
 */
const DP_ENUM_KEYS = ['turno', 'estado_civil'] as const

/**
 * Claves SI/NEGADO (`z.enum(['NEGADO','SI'])`) en `NoPatologicosSchema`
 * (`history.schema.ts:69,72,75,78,82,87,94`). Aunque `buildInitialState`
 * ya pre-rellena con `'NEGADO'` por defecto, defendemos contra cualquier
 * clave vacía residual que llegue al payload.
 */
const NP_ENUM_KEYS = [
  'alcohol', 'alcohol_suspendido',
  'tabaco', 'tabaco_suspendido',
  'drogas_estimulantes',
  'ejercicio',
  'tatuajes',
  'alimentacion',
] as const

/**
 * Devuelve una copia del objeto donde las claves `enumKeys` con valor `''`
 * se ELIMINAN (no se mandan al action). Esto permite que el schema Zod las
 * trate como `undefined` (válido en `.optional()`) en lugar de fallar con
 * `expected enum, received string`.
 */
function stripEmptyEnumKeys<T extends Record<string, string>>(
  section: T,
  enumKeys: readonly string[],
): Record<string, string> {
  const result: Record<string, string> = { ...section }
  for (const k of enumKeys) {
    if (result[k] === '') delete result[k]
  }
  return result
}

/** Construye un estado interno vacío a partir de los shapes conocidos. */
function buildEmptySections(): {
  datos_personales: Record<string, string>
  historia_laboral: Record<string, string>
  heredo_familiares: Record<string, string>
  no_patologicos: Record<string, string>
  patologicos: Record<string, string>
} {
  const dp: Record<string, string> = {
    puesto_actual: '', area_departamento: '', turno: '',
    antiguedad_anios: '', antiguedad_meses: '', estado_civil: '',
    escolaridad: '', numero_hijos: '',
  }
  const hl: Record<string, string> = {
    empresa_anterior_1: '', puesto_anterior_1: '', tiempo_anterior_1: '',
    empresa_anterior_2: '', puesto_anterior_2: '', tiempo_anterior_2: '',
    exposicion_quimica_especifique: '',
    exposicion_fisica_especifique: '',
    exposicion_biologica_especifique: '',
    exposicion_ergonomica_especifique: '',
    accidentes_descripcion: '',
    enfermedades_descripcion: '',
  }
  const hf: Record<string, string> = {
    diabetes: '', has: '', epilepsia: '', cardiopatia: '',
    renales: '', asma: '', cancer: '', mentales: '', otras: '',
  }
  const np: Record<string, string> = {
    alcohol: 'NEGADO', alcohol_edad_comienzo: '', alcohol_frecuencia: '',
    alcohol_suspendido: 'NEGADO', alcohol_tiempo_suspendido: '',
    tabaco: 'NEGADO', tabaco_edad_comienzo: '', tabaco_frecuencia: '',
    tabaco_suspendido: 'NEGADO', tabaco_tiempo_suspendido: '', tabaco_cigarros_dia: '',
    drogas_estimulantes: 'NEGADO', drogas_especifique: '',
    drogas_frecuencia: '', drogas_ultimo_consumo: '',
    ejercicio: 'NEGADO', ejercicio_especifique: '', ejercicio_frecuencia: '',
    alimentacion: 'BUENA', grupo_y_rh: 'DESCONOCE',
    tatuajes: 'NEGADO', tatuajes_especifique: '',
  }
  const pt: Record<string, string> = {}
  for (const f of getPatologicosAllFields()) pt[f] = 'NEGADO'
  pt.otras = ''
  pt.especifique = ''
  return {
    datos_personales: dp,
    historia_laboral: hl,
    heredo_familiares: hf,
    no_patologicos: np,
    patologicos: pt,
  }
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Inicializa el estado local de edición desde `value` (objeto resolvido por el padre). */
function sectionsFromValue(value: Record<string, unknown>): {
  datos_personales: Record<string, string>
  historia_laboral: Record<string, string>
  heredo_familiares: Record<string, string>
  no_patologicos: Record<string, string>
  patologicos: Record<string, string>
} {
  const empty = buildEmptySections()
  for (const key of Object.keys(empty) as SectionKey[]) {
    const section = value[key]
    if (!isPlainRecord(section)) continue
    for (const [k, v] of Object.entries(section)) {
      if (typeof v === 'string') empty[key][k] = v
      else if (typeof v === 'boolean') empty[key][k] = v ? 'true' : 'false'
      else if (v === null || v === undefined) empty[key][k] = ''
    }
  }
  return empty
}

export function AntecedentesCaptura({
  value,
  onChange,
  initialProvenance,
  workerId,
  readonly = false,
  onContinue,
}: AntecedentesCapturaProps) {
  // Estado local de edición — espejo del `value` controlado que pasa el padre.
  const [form, setForm] = useState(() => sectionsFromValue(value))
  const [modified, setModified] = useState<Set<string>>(new Set())

  // Re-hidratar cuando el padre propaga un nuevo `value` (p. ej. tras un refresh
  // del servidor, o cuando cambia el cascade snapshot→portal→longitudinal).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(sectionsFromValue(value))
    setModified(new Set())
  }, [value])

  function markModified(key: string) {
    setModified(prev => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  function setField(section: SectionKey, field: string, rawValue: string) {
    const valueToStore = rawValue
    // Historia Laboral: checkboxes exponen 'true'/'false' (almacenamos como string
    // para el form plano); al emitir onChange, los reconvertimos a booleanos.
    const nextForm = {
      ...form,
      [section]: { ...form[section], [field]: valueToStore },
    }
    setForm(nextForm)
    markModified(`${section}.${field}`)
    // Construir el payload final respetando el shape de Zod:
    // - DP: stripEmptyEnumKeys sobre turno/estado_civil
    // - HL: convertir 'true'/'false' de vuelta a booleanos (excepto los campos
    //   *_especifique, que son string)
    // - NP: stripEmptyEnumKeys sobre enums SI/NEGADO
    // - P: copiar tal cual (los campos son string SI/NEGADO)
    // El tipo `AntecedentesCaptura` (inferred de Zod) es muy estricto en los
    // literales SI/NEGADO. Construimos el payload como `Record<string, unknown>`
    // y dejamos que la validación Zod del action (`ExamenMedicoCompletoSchema`)
    // haga el enforcement final — mismo patrón que IMPL-20260809-01 v1.
    const payload: AntecedentesCaptura = {
      datos_personales: stripEmptyEnumKeys(nextForm.datos_personales, DP_ENUM_KEYS),
      historia_laboral: { ...nextForm.historia_laboral },
      heredo_familiares: { ...nextForm.heredo_familiares },
      no_patologicos: stripEmptyEnumKeys(nextForm.no_patologicos, NP_ENUM_KEYS),
      patologicos: { ...nextForm.patologicos },
    } as unknown as AntecedentesCaptura
    for (const exp of HISTORIA_LABORAL_EXPOSICIONES) {
      const v = nextForm.historia_laboral[exp.key]
      ;(payload.historia_laboral as Record<string, unknown>)[exp.key] =
        v === 'true' || v === 'SI'
    }
    onChange(payload)
  }

  const provenanceSource = initialProvenance?.source ?? 'none'
  const provenanceBadge = (() => {
    switch (provenanceSource) {
      case 'captured':
        return { label: '✏️ Capturado en consulta', color: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'portal':
        return { label: '📋 Del portal', color: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'longitudinal':
        return { label: '📋 Historial maestro', color: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'mixed':
        return { label: '📋 Mixto (portal + consulta)', color: 'bg-blue-50 text-blue-700 border-blue-200' }
      default:
        return { label: '🆕 Sin datos previos', color: 'bg-slate-50 text-slate-600 border-slate-200' }
    }
  })()

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 flex-1">
          <span className="text-teal-600">📋</span>
          <div>
            <p className="text-xs font-bold text-teal-800">Antecedentes — Captura por cita</p>
            <p className="text-[10px] text-teal-600 mt-0.5">
              Snapshot local del paciente para esta cita. No modifica el historial maestro longitudinal.
              Se guarda junto con el resto del Examen Médico.
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${provenanceBadge.color}`}>
          {provenanceBadge.label}
        </span>
      </div>

      {/* ── CTA al historial maestro ────────────────────────────────────── */}
      {workerId && (
        <a
          href={`/history/${workerId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 hover:bg-blue-100 transition-colors"
        >
          <span className="text-xs text-blue-800">
            <strong>¿Cambios persistentes?</strong> Para editar el historial
            longitudinal maestro (reutilizable en futuras citas), abre
            <span className="font-bold ml-1">Editar historial longitudinal maestro →</span>
          </span>
        </a>
      )}

      {/* ── Grid 3 columnas: DP | HL | HF ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Datos Personales */}
        <fieldset className="border border-slate-200 rounded-xl p-3 bg-white">
          <legend className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
            Datos Personales
          </legend>
          <div className="space-y-3 mt-2">
            {DATOS_PERSONALES_CAMPOS.map(campo => (
              <FieldRow
                key={campo.field}
                label={campo.label}
                modified={modified.has(`datos_personales.${campo.field}`)}
              >
                {campo.kind === 'text' || campo.kind === 'number' ? (
                  <input
                    type={campo.kind}
                    value={form.datos_personales[campo.field] ?? ''}
                    onChange={e => setField('datos_personales', campo.field, e.target.value)}
                    disabled={readonly}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                  />
                ) : campo.kind === 'select-turno' ? (
                  <select
                    value={form.datos_personales[campo.field] ?? ''}
                    onChange={e => setField('datos_personales', campo.field, e.target.value)}
                    disabled={readonly}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                  >
                    <option value="">—</option>
                    {TURNO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <select
                    value={form.datos_personales[campo.field] ?? ''}
                    onChange={e => setField('datos_personales', campo.field, e.target.value)}
                    disabled={readonly}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                  >
                    <option value="">—</option>
                    {ESTADO_CIVIL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </FieldRow>
            ))}
          </div>
        </fieldset>

        {/* Historia Laboral */}
        <fieldset className="border border-slate-200 rounded-xl p-3 bg-white">
          <legend className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
            Historia Laboral
          </legend>
          <div className="space-y-3 mt-2">
            {(['1', '2'] as const).map(n => (
              <div key={n} className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Empleo {n}</p>
                {HISTORIA_LABORAL_EMPLEOS_ANTERIORES_FIELDS
                  .filter(([field]) => field.endsWith(`_${n}`))
                  .map(([field, label]) => (
                    <FieldRow
                      key={field}
                      label={label}
                      modified={modified.has(`historia_laboral.${field}`)}
                    >
                      <input
                        type="text"
                        value={form.historia_laboral[field] ?? ''}
                        onChange={e => setField('historia_laboral', field, e.target.value)}
                        disabled={readonly}
                        className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                      />
                    </FieldRow>
                  ))}
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Exposición / Antecedentes</p>
              {HISTORIA_LABORAL_EXPOSICIONES.map(exp => (
                <div key={exp.key}>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={form.historia_laboral[exp.key] === 'true' || form.historia_laboral[exp.key] === 'SI'}
                      onChange={e => setField('historia_laboral', exp.key, e.target.checked ? 'true' : 'false')}
                      disabled={readonly}
                      className="rounded border-slate-300 text-teal-600"
                    />
                    <span className="font-medium text-slate-700">{exp.label}</span>
                  </label>
                  {(form.historia_laboral[exp.key] === 'true' || form.historia_laboral[exp.key] === 'SI') && (
                    <input
                      type="text"
                      value={form.historia_laboral[exp.descKey] ?? ''}
                      onChange={e => setField('historia_laboral', exp.descKey, e.target.value)}
                      disabled={readonly}
                      placeholder="Especifique…"
                      className="mt-1 w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </fieldset>

        {/* Heredo-Familiares */}
        <fieldset className="border border-slate-200 rounded-xl p-3 bg-white">
          <legend className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
            Heredo-Familiares
          </legend>
          <div className="space-y-3 mt-2">
            {HEREDOFAMILIARES_DESCRIPCIONES.map(item => {
              // IMPL-20260817-01-C2: 7 campos con HEREDOFAMILIARES_VALUES (8 opciones),
              // `mentales` con HEREDOFAMILIARES_MENTALES_VALUES (3 opciones),
              // `otras` con combo + input "Especifique" condicional. DA-6 espejo AntecedentesForm.
              const isMentales = item.field === 'mentales'
              const isOtras = item.field === 'otras'
              const zinValues = isMentales ? HEREDOFAMILIARES_MENTALES_VALUES : HEREDOFAMILIARES_VALUES
              const currentValue = form.heredo_familiares[item.field] ?? ''
              return (
                <FieldRow
                  key={item.field}
                  label={item.label}
                  help={item.help}
                  modified={modified.has(`heredo_familiares.${item.field}`)}
                >
                  <select
                    value={currentValue}
                    onChange={e => setField('heredo_familiares', item.field, e.target.value)}
                    disabled={readonly}
                    className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                  >
                    <option value="">—</option>
                    {zinValues.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  {isOtras && currentValue === 'OTROS' && (
                    <input
                      type="text"
                      value={currentValue}
                      onChange={e => setField('heredo_familiares', item.field, e.target.value)}
                      disabled={readonly}
                      placeholder="Especifique (ej: TÍO PATERNO)"
                      className="mt-1 w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                    />
                  )}
                </FieldRow>
              )
            })}
          </div>
        </fieldset>
      </div>

      {/* ── Fila 2: No Patológicos ──────────────────────────────────────── */}
      <fieldset className="border border-slate-200 rounded-xl p-3 bg-white">
        <legend className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
          No Patológicos / Toxicomanías
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          {NO_PATOLOGICOS_DESCRIPCIONES.map(item => {
            const active = form.no_patologicos[item.key] === 'SI'
            return (
              <div key={item.key} className="border border-slate-100 rounded-lg p-2">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-medium text-slate-700">{item.label}</span>
                  <div className="flex gap-1">
                    {SI_NEGADO.map(opt => (
                      <button
                        key={opt} type="button"
                        disabled={readonly}
                        onClick={() => setField('no_patologicos', item.key, opt)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                          form.no_patologicos[item.key] === opt
                            ? opt === 'SI' ? 'bg-rose-100 border-rose-400 text-rose-700' : 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >{opt}</button>
                    ))}
                  </div>
                </div>
                {active && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {item.subs.map(([sk, sl]) => (
                      <div key={sk}>
                        <label className="block text-[10px] text-slate-500 mb-0.5">{sl}</label>
                        <input
                          type="text"
                          value={form.no_patologicos[sk] ?? ''}
                          onChange={e => setField('no_patologicos', sk, e.target.value)}
                          disabled={readonly}
                          className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Alimentación / Grupo RH / Tatuajes — campos planos adicionales */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alimentación</label>
            <select
              value={form.no_patologicos.alimentacion ?? 'BUENA'}
              onChange={e => setField('no_patologicos', 'alimentacion', e.target.value)}
              disabled={readonly}
              className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
            >
              {ALIMENTACION_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Grupo y RH</label>
            <input
              type="text"
              value={form.no_patologicos.grupo_y_rh ?? ''}
              onChange={e => setField('no_patologicos', 'grupo_y_rh', e.target.value)}
              disabled={readonly}
              placeholder="Ej: O+"
              className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tatuajes</label>
            <div className="flex gap-1">
              {SI_NEGADO.map(opt => (
                <button key={opt} type="button" disabled={readonly}
                  onClick={() => setField('no_patologicos', 'tatuajes', opt)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                    form.no_patologicos.tatuajes === opt
                      ? 'bg-blue-100 border-blue-400 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >{opt}</button>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      {/* ── Fila 3: Patológicos ─────────────────────────────────────────── */}
      <fieldset className="border border-slate-200 rounded-xl p-3 bg-white">
        <legend className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
          Patológicos
        </legend>
        <p className="text-[10px] text-slate-500 mt-1 mb-3">
          Por defecto todos los campos están en NEGADO. Cambiar solo si aplica.
        </p>
        {([
          ['endocrino',      'Enfermedades Endocrino-Metabólicas'],
          ['cardiopulmonar', 'Sistema Cardiopulmonar'],
          ['neurologico',    'Sistema Neurológico'],
          ['digestivo',      'Sistema Digestivo y Genitourinario'],
          ['otras',          'Otras Condiciones'],
        ] as const).map(([group, title]) => (
          <div key={group} className="mb-4 last:mb-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {PATOLOGICOS_DESCRIPCIONES[group].map(item => (
                <div key={item.field}>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase">{item.label}</label>
                  <p className="text-[9px] text-slate-400 mb-1">{item.help}</p>
                  <select
                    value={form.patologicos[item.field] || 'NEGADO'}
                    onChange={e => setField('patologicos', item.field, e.target.value)}
                    disabled={readonly}
                    className="w-full text-xs px-2 py-1 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                  >
                    <option value="NEGADO">NEGADO</option>
                    <option value="SI">SÍ</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Observaciones */}
        <div className="pt-3 border-t border-slate-100">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observaciones adicionales</label>
          <textarea
            rows={2}
            value={form.patologicos.otras ?? ''}
            onChange={e => setField('patologicos', 'otras', e.target.value)}
            disabled={readonly}
            placeholder="Especificar otras enfermedades relevantes..."
            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60 resize-none"
          />
        </div>
      </fieldset>

      {/* ── Footer: sin botón guardar propio — persistencia integrada ─── */}
      {readonly ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-400 text-center">
          Vista de solo lectura — expediente cerrado.
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
          💾 Los cambios se guardan junto con el Examen Médico (botón
          &ldquo;Guardar borrador&rdquo; de Módulo 1, Exploración o Impresión/Aptitud).
        </div>
      )}

      {/* ── Navegación a la siguiente sub-pestaña ────────────────────────
          IMPL-20260809-03 — affordance UX al pie de Antecedentes
          (SPEC ARCH-20260809-01 v2 §6.9). El botón salta a Módulo 1
          (inner-tab 'declarativa'); se deshabilita en modo readonly. */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onContinue}
          disabled={readonly}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
        >
          Continuar → Módulo 1
        </button>
      </div>
    </div>
  )
}

/** Sub-componente local: etiqueta + indicador de modificado + input children. */
function FieldRow({
  label,
  help,
  modified,
  children,
}: {
  label: string
  help?: string
  modified?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center justify-between mb-0.5">
        <span className="block text-[10px] font-bold text-slate-500 uppercase">{label}</span>
        {modified && (
          <span className="text-[9px] text-amber-700 font-bold" title="Editado en esta consulta">
            ✏️ modificado
          </span>
        )}
      </label>
      {help && <p className="text-[9px] text-slate-400 mb-0.5">{help}</p>}
      {children}
    </div>
  )
}

export default AntecedentesCaptura
