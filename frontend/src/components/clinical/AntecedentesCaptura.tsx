'use client'

/**
 * @file AntecedentesCaptura — Editor snapshot por cita de los Antecedentes
 * declarativos del paciente, dentro de la outer-tab "Antecedentes" del
 * estudio "Examen Médico".
 *
 * **Responsabilidad:** persistir en `physicalExamData.antecedentes_captured`
 * (MedicalExam) — snapshot local de la cita — sin sobrescribir el historial
 * maestro longitudinal (`WorkerClinicalHistory`).
 *
 * **Diferencia con AntecedentesForm.tsx:**
 * - `AntecedentesForm` edita el historial maestro (via `upsertWorkerClinicalHistory`).
 * - `AntecedentesCaptura` edita el snapshot de la cita (via `saveAntecedentesCaptura`).
 *
 * **Precarga en cascada:** (a) snapshot previo de la cita si existe →
 * (b) `prefilledData` del portal → (c) `fallbackLongitudinal` del historial maestro.
 *
 * @id IMPL-20260809-01
 * @spec ARCH-20260809-01 — outer-tab "Antecedentes" en Examen Médico
 * @ref SPEC §7
 */

import { useEffect, useMemo, useState } from 'react'
import { saveAntecedentesCaptura } from '@/actions/medical-exam.actions'
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
import type { ClinicalHistoryData } from '@/schemas/clinical/history.schema'

interface AntecedentesCapturaProps {
  eventId: string
  workerId?: string
  initialData?: AntecedentesCaptura | null
  fallbackLongitudinal?: ClinicalHistoryData | null
  prefilledData?: Record<string, unknown> | null
  readonly?: boolean
}

type SectionKey = 'datos_personales' | 'historia_laboral' | 'heredo_familiares' | 'no_patologicos' | 'patologicos'

/**
 * IMPL-20260809-01 rework (QA-20260809-01 I-2): claves declaradas como
 * `z.enum(...).optional()` en `DatosPersonalesModulo1Schema`
 * (`history.schema.ts:13,16`). Aceptan `undefined` (clave omitida) o un
 * literal del enum, pero NO la cadena vacía. Si el médico deja el select
 * en "—" (que mapea a `''` en el form), el cliente debe filtrar la clave
 * antes de enviar al action.
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

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Estados iniciales (vacíos pero con defaults coherentes con el historial maestro). */
function buildInitialState(longitudinal: ClinicalHistoryData | null | undefined): {
  datos_personales: Record<string, string>
  historia_laboral: Record<string, string>
  heredo_familiares: Record<string, string>
  no_patologicos: Record<string, string>
  patologicos: Record<string, string>
} {
  // Defaults lógicos: Patológicos → NEGADO, No Patológicos → NEGADO, etc.
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

  // Si llega longitudinal, prefillar SOLO strings no vacíos (preservar defaults lógicos).
  const ldp = isPlainRecord(longitudinal?.datos_personales) ? longitudinal!.datos_personales as Record<string, unknown> : {}
  for (const k of Object.keys(dp)) {
    const v = ldp[k]
    if (typeof v === 'string' && v !== '') dp[k] = v
    else if (typeof v === 'number') dp[k] = String(v)
  }
  const lhl = isPlainRecord(longitudinal?.historia_laboral) ? longitudinal!.historia_laboral as Record<string, unknown> : {}
  for (const k of Object.keys(hl)) {
    const v = lhl[k]
    if (typeof v === 'string' && v !== '') hl[k] = v
  }
  // Booleans de exposición → guardar como 'true'/'false' para serialización
  for (const exp of HISTORIA_LABORAL_EXPOSICIONES) {
    const v = lhl[exp.key]
    hl[exp.key] = v ? 'true' : 'false'
  }
  const lhf = isPlainRecord(longitudinal?.heredo_familiares) ? longitudinal!.heredo_familiares as Record<string, unknown> : {}
  for (const k of Object.keys(hf)) {
    const v = lhf[k]
    if (typeof v === 'string' && v !== '') hf[k] = v
  }
  const lnp = isPlainRecord(longitudinal?.no_patologicos) ? longitudinal!.no_patologicos as Record<string, unknown> : {}
  for (const k of Object.keys(np)) {
    const v = lnp[k]
    if (typeof v === 'string' && v !== '') np[k] = v
  }
  const lpt = isPlainRecord(longitudinal?.patologicos) ? longitudinal!.patologicos as Record<string, unknown> : {}
  for (const k of Object.keys(pt)) {
    const v = lpt[k]
    if (typeof v === 'string' && v !== '') pt[k] = v
  }

  return {
    datos_personales: dp,
    historia_laboral: hl,
    heredo_familiares: hf,
    no_patologicos: np,
    patologicos: pt,
  }
}

/**
 * Selecciona la fuente de prefill en orden de precedencia:
 * 1. `initialData` (snapshot previo de la cita, ya persistido)
 * 2. `prefilledData` (snapshot del portal)
 * 3. `fallbackLongitudinal` (historial maestro)
 * Devuelve también la proveniencia detectada para mostrar el badge.
 */
function pickPrefill(
  initialData: AntecedentesCaptura | null | undefined,
  prefilledData: Record<string, unknown> | null | undefined,
  fallbackLongitudinal: ClinicalHistoryData | null | undefined,
): { source: 'snapshot' | 'portal' | 'longitudinal' | 'none'; data: ClinicalHistoryData | null } {
  if (initialData && typeof initialData === 'object') {
    return { source: 'snapshot', data: initialData as ClinicalHistoryData }
  }
  if (prefilledData && typeof prefilledData === 'object') {
    return { source: 'portal', data: prefilledData as ClinicalHistoryData }
  }
  if (fallbackLongitudinal && typeof fallbackLongitudinal === 'object') {
    return { source: 'longitudinal', data: fallbackLongitudinal }
  }
  return { source: 'none', data: null }
}

export function AntecedentesCaptura({
  eventId,
  workerId,
  initialData,
  fallbackLongitudinal,
  prefilledData,
  readonly = false,
}: AntecedentesCapturaProps) {
  const { source: prefillSource, data: prefillData } = useMemo(
    () => pickPrefill(initialData, prefilledData, fallbackLongitudinal),
    [initialData, prefilledData, fallbackLongitudinal],
  )

  const [form, setForm] = useState(() => buildInitialState(prefillData))
  const [modified, setModified] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Rehidratación intencional al cambiar initialData/prefill (ver pickPrefill).
  useEffect(() => {
    setForm(buildInitialState(prefillData))
    setModified(new Set())
  }, [prefillData])

  function markModified(key: string) {
    setModified(prev => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  function setField(section: SectionKey, field: string, value: string) {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }))
    markModified(`${section}.${field}`)
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveMsg(null)
    try {
      // Construir payload respetando el shape esperado por el schema.
      // Para Patológicos: pasar strings SI/NEGADO. Para Historia Laboral: convertir
      // los booleanos 'true'/'false' de vuelta a booleanos.
      // El tipo `AntecedentesCaptura` (inferred de Zod) es muy estricto en los
      // literales SI/NEGADO; casteamos a `Record<string, unknown>` y dejamos que
      // la validación Zod del action haga el enforcement final.
      // IMPL-20260809-01 rework (QA-20260809-01 I-2): los schemas de
      // `history.schema.ts` definen varios campos como `z.enum(...).optional()`,
      // que solo admiten `undefined` (no `''`). Antes de enviar, eliminamos
      // del payload cualquier clave vacía en esos campos para que Zod no
      // rechace con `expected one of ... received string`.
      const payload: Record<string, unknown> = {
        datos_personales: stripEmptyEnumKeys(form.datos_personales, DP_ENUM_KEYS),
        historia_laboral: { ...form.historia_laboral },
        heredo_familiares: { ...form.heredo_familiares },
        no_patologicos: stripEmptyEnumKeys(form.no_patologicos, NP_ENUM_KEYS),
        patologicos: { ...form.patologicos },
      }
      // Reconvertir booleanos de exposición al tipo real (el schema espera booleanos).
      for (const exp of HISTORIA_LABORAL_EXPOSICIONES) {
        const v = form.historia_laboral[exp.key]
        ;(payload.historia_laboral as Record<string, unknown>)[exp.key] = v === 'true' || v === 'SI'
      }
      const res = await saveAntecedentesCaptura(eventId, payload)
      if (res.success) {
        setSaveMsg({ type: 'success', text: 'Antecedentes guardados para esta cita.' })
      } else {
        setSaveMsg({ type: 'error', text: res.error ?? 'Error al guardar' })
      }
    } catch (err: unknown) {
      setSaveMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error desconocido',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const provenanceBadge = useMemo(() => {
    switch (prefillSource) {
      case 'snapshot':
        return { label: '✏️ Capturado en consulta', color: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'portal':
        return { label: '📋 Del portal', color: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'longitudinal':
        return { label: '📋 Historial maestro', color: 'bg-blue-50 text-blue-700 border-blue-200' }
      default:
        return { label: '🆕 Sin datos previos', color: 'bg-slate-50 text-slate-600 border-slate-200' }
    }
  }, [prefillSource])

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
            {HEREDOFAMILIARES_DESCRIPCIONES.map(item => (
              <FieldRow
                key={item.field}
                label={item.label}
                help={item.help}
                modified={modified.has(`heredo_familiares.${item.field}`)}
              >
                <input
                  type="text"
                  value={form.heredo_familiares[item.field] ?? ''}
                  onChange={e => setField('heredo_familiares', item.field, e.target.value)}
                  disabled={readonly}
                  placeholder="Relación familiar (ej: PADRE)"
                  className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                />
              </FieldRow>
            ))}
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

      {/* ── Footer: mensajes + botón guardar + banner readonly ──────────── */}
      {saveMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-medium ${
            saveMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {saveMsg.type === 'success' ? '✅ ' : '❌ '}{saveMsg.text}
        </div>
      )}
      {readonly ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-400 text-center">
          Vista de solo lectura — expediente cerrado.
        </div>
      ) : (
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : '💾 Guardar antecedentes'}
          </button>
        </div>
      )}
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
