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
 * IMPL-20260817-02 (FIX L2 QA-20260817-01-C2): el input "Especifique" del
 * campo `otras` (heredo-familiares) ahora lee/escribe el state key
 * INDEPENDIENTE `heredo_familiares.otras_especifique`. Antes compartía
 * `otras` con el select, causando auto-destrucción al primer carácter.
 *
 * IMPL-20260817-04 (junta AMI 10/ago, Erika, línea 285): acordeón Sí/Negado/
 * No Aplica + 3 campos condicionales (desde_cuando / tratamiento /
 * observaciones) para cada enfermedad del `PatologicosSchema`. El campo
 * legacy top-level `especifique` se elimina; su contenido se captura ahora
 * en `otras.detalle.observaciones`. DA-1: la hidratación reconoce tanto el
 * formato legacy (`{ diabetes: 'SI' }`) como el nuevo (`{ diabetes: { estado,
 * detalle } }`).
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
import {
  GRUPO_RH_VALUES,
  type DetalleTriple,
} from '@/schemas/clinical/history.schema'

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
 * IMPL-20260817-04 — opciones del acordeón Sí/Negado/No Aplica para cada
 * enfermedad del PatologicosSchema. Se mantienen como array de literales
 * (no `as const`) para compatibilidad con el `<select>` controlado por
 * strings (evita `.includes` con `unknown`).
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
  /** IMPL-20260817-04 — el section `patologicos` ahora usa objetos
   * `{ estado, detalle }` por enfermedad (acordeón Sí/Negado/No Aplica +
   * 3 campos). La forma legacy `{ diabetes: 'SI' }` se normaliza al cargar
   * (ver `sectionsFromValue`). */
  patologicos: Record<string, PatologiaEntry>
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
    renales: '', asma: '', cancer: '', mentales: '',
    otras: '', otras_especifique: '',
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
  // IMPL-20260817-04: cada enfermedad (incl. `otras`) inicializa como
  // acordeón colapsado `{ estado: 'NEGADO', detalle: undefined }`. El
  // campo legacy top-level `especifique` se elimina: su contenido se
  // captura ahora en `otras.detalle.observaciones`.
  const pt: Record<string, PatologiaEntry> = {}
  for (const f of getPatologicosAllFields()) pt[f] = emptyPatologia()
  pt.otras = emptyPatologia()
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

function isSnaValue(v: unknown): v is SnaValue {
  return v === 'NEGADO' || v === 'SI' || v === 'NO APLICA'
}

/**
 * Normaliza un valor desconocido de una enfermedad patológica al shape
 * `PatologiaEntry`. Acepta:
 *  - String legacy (`'SI'`, `'NEGADO'`, `'NO APLICA'`).
 *  - Objeto nuevo (`{ estado, detalle }`) — `detalle` opcional.
 *  - `null` / `undefined` → entrada vacía `{ estado: 'NEGADO', detalle: undefined }`.
 */
function coercePatologiaEntry(v: unknown): PatologiaEntry {
  if (typeof v === 'string') {
    const s = v.trim().toUpperCase()
    if (isSnaValue(s)) return { estado: s, detalle: undefined }
    // Strings legacy no canónicos (p.ej. typos): conservar como 'NEGADO' para
    // no romper renders. El schema Zod puede quejarse, pero la UI debe
    // seguir operativa.
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

/** Inicializa el estado local de edición desde `value` (objeto resolvido por el padre). */
function sectionsFromValue(value: Record<string, unknown>): {
  datos_personales: Record<string, string>
  historia_laboral: Record<string, string>
  heredo_familiares: Record<string, string>
  no_patologicos: Record<string, string>
  patologicos: Record<string, PatologiaEntry>
} {
  const empty = buildEmptySections()
  for (const key of Object.keys(empty) as SectionKey[]) {
    const section = value[key]
    if (!isPlainRecord(section)) continue
    for (const [k, v] of Object.entries(section)) {
      if (key === 'patologicos') {
        // IMPL-20260817-04 — el section patologicos maneja la forma objeto;
        // `coercePatologiaEntry` acepta strings legacy o el nuevo objeto.
        empty.patologicos[k] = coercePatologiaEntry(v)
        continue
      }
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

  // IMPL-20260817-05 (fix bug acordeón Patologicos no colapsa al cambiar a NEGADO).
  // Frank reportó: al pasar de SÍ a NEGADO en una enfermedad, los 3 inputs
  // (desde_cuando / tratamiento / observaciones) quedaban visibles.
  //
  // Causa raíz: este useEffect se disparaba también cada vez que la prop `value`
  // cambiaba por cualquier re-render del padre (nueva ref del mismo objeto),
  // sobrescribiendo el state local con `sectionsFromValue(value)` y revirtiendo
  // los cambios del usuario. En particular, si el servidor aún tenía `estado:'SI'`
  // (Frank no había guardado), el state local se restauraba y los inputs
  // reaparecían aunque Frank hubiera cambiado a NEGADO localmente.
  //
  // Fix: hidratar SOLO al montar (`[]`). El componente es snapshot por cita
  // (ARCH-20260809-01): los cambios externos del servidor disparan REMOUNT
  // (cambio de cita / refresh completo), no re-hidratación dentro del mismo
  // ciclo de vida. Si se requiriera re-hidratación en caliente en el futuro,
  // usar dirty-checking (ver handoff Atlas IMPL-20260817-05 §"Opción B").
  useEffect(() => {
    setForm(sectionsFromValue(value))
    setModified(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // IMPL-20260817-05: solo al montar (fix bug re-hidratación)

  function markModified(key: string) {
    setModified(prev => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  /**
   * IMPL-20260817-04 — actualiza una enfermedad patológica (acordeón
   * Sí/Negado/No Aplica + 3 campos). Si el nuevo estado es `SI`,
   * materializa un `detalle` por defecto para que los inputs aparezcan
   * ya visibles. Si pasa a `NEGADO` / `NO APLICA`, colapsa el detalle
   * (lo deja en `undefined` para ahorrar payload).
   */
  function updatePatologia(field: string, patch: Partial<PatologiaEntry>) {
    const current = form.patologicos[field] ?? emptyPatologia()
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
    const nextForm = {
      ...form,
      patologicos: { ...form.patologicos, [field]: next },
    }
    setForm(nextForm)
    markModified(`patologicos.${field}`)
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
                    // IMPL-20260817-02 (FIX L2): el input lee/escribe
                    // `form.heredo_familiares.otras_especifique` (state key
                    // independiente del select). Antes compartía `item.field`
                    // y se auto-destruía al tipear.
                    <input
                      type="text"
                      value={form.heredo_familiares.otras_especifique ?? ''}
                      onChange={e => setField('heredo_familiares', 'otras_especifique', e.target.value)}
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
            <select
              value={form.no_patologicos.grupo_y_rh ?? ''}
              onChange={e => setField('no_patologicos', 'grupo_y_rh', e.target.value)}
              disabled={readonly}
              className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
            >
              <option value="">— Seleccionar —</option>
              {GRUPO_RH_VALUES.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
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
          Al marcar <strong>SÍ</strong> aparecen 3 inputs: desde cuándo, tratamiento y observaciones.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {PATOLOGICOS_DESCRIPCIONES[group].map(item => {
                // IMPL-20260817-04 — acordeón Sí/Negado/No Aplica + 3 campos
                // condicionales (desde_cuando / tratamiento / observaciones).
                // El campo legacy `especifique` se eliminó: se captura ahora
                // en `otras.detalle.observaciones`.
                const entry = form.patologicos[item.field] ?? emptyPatologia()
                const showDetail = entry.estado === 'SI'
                const detalle = entry.detalle ?? emptyDetalle()
                return (
                  <div key={item.field} className="border border-slate-100 rounded-lg p-2 bg-white">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">{item.label}</label>
                    <p className="text-[9px] text-slate-400 mb-1">{item.help}</p>
                    <select
                      value={entry.estado}
                      onChange={e => updatePatologia(item.field, { estado: e.target.value as SnaValue })}
                      disabled={readonly}
                      className={`w-full text-xs px-2 py-1 border rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60 ${
                        entry.estado === 'SI'
                          ? 'border-rose-300 bg-rose-50 text-rose-800'
                          : entry.estado === 'NO APLICA'
                            ? 'border-slate-200 bg-slate-50 text-slate-500'
                            : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {SNA_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {showDetail && (
                      <div className="mt-2 space-y-2 p-2 bg-slate-50 rounded border border-slate-100">
                        <div>
                          <label className="block text-[9px] font-medium text-slate-500 uppercase mb-0.5">
                            Desde cuándo
                          </label>
                          <input
                            type="text"
                            value={detalle.desde_cuando}
                            onChange={e => updatePatologia(item.field, {
                              detalle: { ...detalle, desde_cuando: e.target.value },
                            })}
                            disabled={readonly}
                            placeholder="ej: 15 años, 2019"
                            maxLength={200}
                            className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-medium text-slate-500 uppercase mb-0.5">
                            Tratamiento
                          </label>
                          <textarea
                            value={detalle.tratamiento}
                            onChange={e => updatePatologia(item.field, {
                              detalle: { ...detalle, tratamiento: e.target.value },
                            })}
                            disabled={readonly}
                            placeholder="ej: Metformina 500mg cada 24h"
                            rows={2}
                            maxLength={500}
                            className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 disabled:opacity-60 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-medium text-slate-500 uppercase mb-0.5">
                            Observaciones
                          </label>
                          <textarea
                            value={detalle.observaciones}
                            onChange={e => updatePatologia(item.field, {
                              detalle: { ...detalle, observaciones: e.target.value },
                            })}
                            disabled={readonly}
                            placeholder="ej: HbA1c 6.5%, sin complicaciones"
                            rows={3}
                            maxLength={1500}
                            className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 disabled:opacity-60 resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
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
