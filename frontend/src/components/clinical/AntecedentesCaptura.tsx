'use client'

/**
 * @file AntecedentesCaptura — Editor CONTROLADO de los Antecedentes declarativos
 * del paciente, usado como PRIMERA sub-pestaña dentro del estudio "Examen Médico"
 * (inner-tab `antecedentes` de `ExamenMedicoEstudio`).
 *
 * **Responsabilidad:** editar las 5 secciones declarativas del paciente más
 * gineco/reproductivos/inmunizaciones (ex Módulo 1, persistidos en `modulo1`).
 * Emite cada cambio al padre (`ExamenMedicoEstudio`) vía
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
 * IMPL-20260817-06 (junta AMI 10/ago, Erika, decisión Frank — solo opción 1):
 * acordeón colapsable con resumen. Estado SÍ + 3 campos vacíos → inputs
 * desplegados con placeholders. Estado SÍ + 3 campos con contenido →
 * resumen colapsado (click para editar). Click en otra enfermedad colapsa
 * la actual automáticamente (auto-colapso por `focusedField`). Estado
 * NEGADO/NO APLICA → card pequeño sin campos. NO se incluye botón
 * "Confirmar" (Frank lo descartó).
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
  emptyHeredoFamiliaresRecord,
  heredoFamiliaresEspecifiqueKey,
  NO_PATOLOGICOS_DESCRIPCIONES,
  PATOLOGICOS_DESCRIPCIONES,
  TURNO_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  ALIMENTACION_OPTIONS,
  SI_NEGADO,
  getPatologicosAllFields,
  PATOLOGICOS_GROUP_ORDER,
  PATOLOGICOS_GROUP_TITLES,
} from '@/lib/antecedentes-fields'
import {
  GINE_FIELDS,
  M1_SEX_OPTIONS,
  REPRO_FIELDS,
  VACUNAS_CAPTURE_LIST,
  VAC_SI_NO_VALUES,
  type Modulo1FieldDef,
} from '@/lib/modulo1-capture-fields'
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
  /** Callback para navegar a Exploración Física desde el pie. */
  onContinue?: () => void
  /** Gineco / reproductivos / vacunas (persisten en `physicalExamData.modulo1`). */
  modulo1: Record<string, string>
  onModulo1Change: (next: Record<string, string>) => void
  /** Nota libre del médico sobre antecedentes. */
  antecedentesMedico?: string
  onAntecedentesMedicoChange?: (value: string) => void
  /** Hint si hay datos del portal pre-cita. */
  portalPrefillHint?: boolean
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
  'tratamiento_medico_actual',
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
  const hf: Record<string, string> = emptyHeredoFamiliaresRecord()
  const np: Record<string, string> = {
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
  }
  // IMPL-20260817-04: cada enfermedad (incl. `otras`) inicializa como
  // acordeón colapsado `{ estado: 'NEGADO', detalle: undefined }`. El
  // campo legacy top-level `especifique` se elimina: su contenido se
  // captura ahora en `otras.detalle.observaciones`.
  const pt: Record<string, PatologiaEntry> = {}
  for (const f of getPatologicosAllFields()) pt[f] = emptyPatologia()
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

function renderModulo1Fields(
  fields: Modulo1FieldDef[],
  modulo1: Record<string, string>,
  setM1Field: (name: string, value: string) => void,
  readonly: boolean,
) {
  const baseInputClass =
    'w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60'
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {fields.map(field => {
        const currentValue = modulo1[field.name] ?? ''
        if (field.kind === 'select' && field.values) {
          return (
            <div key={field.name}>
              <label className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</label>
              <select
                value={currentValue}
                onChange={e => setM1Field(field.name, e.target.value)}
                disabled={readonly}
                className={baseInputClass}
              >
                <option value="">—</option>
                {field.values.map(v => (
                  <option key={String(v)} value={String(v)}>{String(v)}</option>
                ))}
              </select>
            </div>
          )
        }
        if (field.kind === 'number') {
          return (
            <div key={field.name}>
              <label className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</label>
              <input
                type="number"
                min={field.min}
                max={field.max}
                value={currentValue}
                onChange={e => setM1Field(field.name, e.target.value)}
                disabled={readonly}
                className={baseInputClass}
              />
            </div>
          )
        }
        if (field.kind === 'date') {
          return (
            <div key={field.name}>
              <label className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</label>
              <input
                type="text"
                value={currentValue}
                onChange={e => setM1Field(field.name, e.target.value)}
                disabled={readonly}
                placeholder="DD/MM/AAAA o ISO"
                className={baseInputClass}
              />
            </div>
          )
        }
        return (
          <div key={field.name} className={field.name.includes('doc_prost') ? 'col-span-full' : undefined}>
            <label className="text-[10px] font-bold text-slate-400 uppercase">{field.label}</label>
            <input
              type="text"
              value={currentValue}
              onChange={e => setM1Field(field.name, e.target.value)}
              disabled={readonly}
              className={baseInputClass}
            />
          </div>
        )
      })}
    </div>
  )
}

export function AntecedentesCaptura({
  value,
  onChange,
  initialProvenance,
  workerId,
  readonly = false,
  onContinue,
  modulo1,
  onModulo1Change,
  antecedentesMedico = '',
  onAntecedentesMedicoChange,
  portalPrefillHint = false,
}: AntecedentesCapturaProps) {
  const [form, setForm] = useState(() => sectionsFromValue(value))
  const [modified, setModified] = useState<Set<string>>(new Set())

  function setM1Field(name: string, raw: string) {
    onModulo1Change({ ...modulo1, [name]: raw })
  }

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
   *
   * IMPL-20260817-06 — al cambiar a `SI`, marca este field como focused
   * (auto-expande los inputs). Al cambiar a `NEGADO`/`NO APLICA`, limpia
   * el focus (el card pasa a modo pequeño). Al editar un detalle, NO
   * toca el focus: el usuario puede seguir editando sin perder la
   * selección.
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
              Cuestionario del paciente + gineco/reproductivos e inmunizaciones para esta cita.
              Se guarda junto con el resto del Examen Médico.
              {portalPrefillHint && (
                <span className="ml-1 text-emerald-700 font-semibold">
                  Snapshot del portal disponible.
                </span>
              )}
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
              const zinValues = isMentales ? HEREDOFAMILIARES_MENTALES_VALUES : HEREDOFAMILIARES_VALUES
              const currentValue = form.heredo_familiares[item.field] ?? ''
              const especifiqueKey = heredoFamiliaresEspecifiqueKey(item.field)
              const showEspecifique = !isMentales && currentValue === 'OTROS'
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
                  {showEspecifique && (
                    <input
                      type="text"
                      value={form.heredo_familiares[especifiqueKey] ?? ''}
                      onChange={e => setField('heredo_familiares', especifiqueKey, e.target.value)}
                      disabled={readonly}
                      placeholder="Especifique (ej: TÍO PATERNO, cáncer de mama)"
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
        {/* Alimentación / Tratamiento médico / Grupo RH / Tatuajes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100">
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
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tratamiento médico actual</label>
            <p className="text-[9px] text-slate-400 mb-1">Medicamentos o terapias que toma actualmente de forma regular.</p>
            <div className="flex gap-1">
              {SI_NEGADO.map(opt => (
                <button key={opt} type="button" disabled={readonly}
                  onClick={() => setField('no_patologicos', 'tratamiento_medico_actual', opt)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                    form.no_patologicos.tratamiento_medico_actual === opt
                      ? 'bg-blue-100 border-blue-400 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >{opt}</button>
              ))}
            </div>
            {form.no_patologicos.tratamiento_medico_actual === 'SI' && (
              <div className="mt-2">
                <label className="block text-[9px] font-medium text-slate-500 uppercase mb-0.5">
                  Especifique
                </label>
                <input
                  type="text"
                  value={form.no_patologicos.tratamiento_medico_actual_especifique ?? ''}
                  onChange={e => setField('no_patologicos', 'tratamiento_medico_actual_especifique', e.target.value)}
                  disabled={readonly}
                  placeholder="ej: Metformina 850 mg, Losartán 50 mg"
                  maxLength={500}
                  className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                />
              </div>
            )}
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
            <p className="text-[9px] text-slate-400 mb-1">Indique si tiene tatuajes visibles. Algunos puestos lo requieren declarar.</p>
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
            {form.no_patologicos.tatuajes === 'SI' && (
              <div className="mt-2">
                <label className="block text-[9px] font-medium text-slate-500 uppercase mb-0.5">
                  Ubicación
                </label>
                <input
                  type="text"
                  value={form.no_patologicos.tatuajes_especifique ?? ''}
                  onChange={e => setField('no_patologicos', 'tatuajes_especifique', e.target.value)}
                  disabled={readonly}
                  placeholder="ej: brazo derecho, espalda, tobillo"
                  maxLength={500}
                  className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                />
              </div>
            )}
          </div>
        </div>
      </fieldset>

      {/* ── Fila 3: Patológicos ─────────────────────────────────────────── */}
      <fieldset className="border border-slate-200 rounded-xl p-3 bg-white">
        <legend className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
          Patológicos
        </legend>
        <p className="text-[10px] text-slate-500 mt-1 mb-3">
          Por defecto NEGADO. Si marca <strong>SÍ</strong>, complete desde cuándo, tratamiento y observaciones (sin acordeón).
        </p>
        {PATOLOGICOS_GROUP_ORDER.map(group => (
          <div key={group} className="mb-4 last:mb-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              {PATOLOGICOS_GROUP_TITLES[group]}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {PATOLOGICOS_DESCRIPCIONES[group].map(item => {
                const entry = form.patologicos[item.field] ?? emptyPatologia()
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
                    {entry.estado === 'SI' && (
                      <div className="mt-2 space-y-2 p-2 bg-slate-50 rounded border border-slate-100">
                        <input
                          type="text"
                          value={detalle.desde_cuando}
                          onChange={e => updatePatologia(item.field, {
                            detalle: { ...detalle, desde_cuando: e.target.value },
                          })}
                          disabled={readonly}
                          placeholder="Desde cuándo"
                          maxLength={200}
                          className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                        />
                        <textarea
                          value={detalle.tratamiento}
                          onChange={e => updatePatologia(item.field, {
                            detalle: { ...detalle, tratamiento: e.target.value },
                          })}
                          disabled={readonly}
                          placeholder="Tratamiento"
                          rows={2}
                          maxLength={500}
                          className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 disabled:opacity-60 resize-none"
                        />
                        <textarea
                          value={detalle.observaciones}
                          onChange={e => updatePatologia(item.field, {
                            detalle: { ...detalle, observaciones: e.target.value },
                          })}
                          disabled={readonly}
                          placeholder="Observaciones"
                          rows={2}
                          maxLength={1500}
                          className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-teal-500 disabled:opacity-60 resize-none"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </fieldset>

      {/* ── Sexo (condicional gine / repro) ───────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-4">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Sexo</span>
        <div className="flex gap-2">
          {M1_SEX_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              disabled={readonly}
              onClick={() => setM1Field('m1_sexo', opt)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg border-2 transition-colors ${
                modulo1.m1_sexo === opt
                  ? 'bg-teal-100 border-teal-400 text-teal-800'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {modulo1.m1_sexo === 'Femenino' && (
        <fieldset className="border border-slate-200 rounded-xl p-3 bg-white">
          <legend className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
            Antecedentes ginecológicos
          </legend>
          <div className="mt-2">
            {renderModulo1Fields(GINE_FIELDS, modulo1, setM1Field, readonly)}
          </div>
        </fieldset>
      )}

      {modulo1.m1_sexo === 'Masculino' && (
        <fieldset className="border border-slate-200 rounded-xl p-3 bg-white">
          <legend className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
            Antecedentes reproductivos — salud prostática
          </legend>
          <div className="mt-2">
            {renderModulo1Fields(REPRO_FIELDS, modulo1, setM1Field, readonly)}
          </div>
        </fieldset>
      )}

      <fieldset className="border border-slate-200 rounded-xl p-3 bg-white">
        <legend className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
          Inmunizaciones
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
          {VACUNAS_CAPTURE_LIST.map(({ key, label }) => {
            const estado = modulo1[key] ?? 'NEGADO'
            const especifiqueKey = `${key}_especifique`
            const especifique = modulo1[especifiqueKey] ?? ''
            return (
              <div key={key} className="border border-slate-100 rounded-lg p-2">
                <label className="block text-[10px] font-bold text-slate-600 uppercase">{label}</label>
                <select
                  value={estado}
                  onChange={e => setM1Field(key, e.target.value)}
                  disabled={readonly}
                  className="w-full text-xs px-2 py-1 border border-slate-200 rounded-lg mt-1 focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                >
                  {VAC_SI_NO_VALUES.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {estado === 'SI' && (
                  <input
                    type="text"
                    value={especifique}
                    onChange={e => setM1Field(especifiqueKey, e.target.value)}
                    disabled={readonly}
                    placeholder="Dosis / fecha / esquema"
                    maxLength={200}
                    className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded mt-2 focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
                  />
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Próxima dosis / esquema completo</label>
          <input
            type="text"
            value={modulo1.m1_vac_proxima_dosis ?? ''}
            onChange={e => setM1Field('m1_vac_proxima_dosis', e.target.value)}
            disabled={readonly}
            className="w-full mt-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
          />
        </div>
      </fieldset>

      {onAntecedentesMedicoChange && (
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Nota del médico — resumen de antecedentes
            </span>
            <textarea
              rows={3}
              value={antecedentesMedico}
              onChange={e => onAntecedentesMedicoChange(e.target.value)}
              disabled={readonly}
              placeholder="Resumen de antecedentes relevantes para el expediente..."
              className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-teal-500 outline-none disabled:opacity-60"
            />
          </label>
        </div>
      )}

      {/* ── Footer: sin botón guardar propio — persistencia integrada ─── */}
      {readonly ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-400 text-center">
          Vista de solo lectura — expediente cerrado.
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
          💾 Los cambios se guardan con el botón &ldquo;Guardar borrador&rdquo; en Exploración o Impresión.
        </div>
      )}

      {/* ── Navegación a la siguiente sub-pestaña ────────────────────────
          IMPL-20260809-03 — affordance UX al pie de Antecedentes
          (SPEC ARCH-20260809-01 v2 §6.9). El botón salta a Módulo 1
          se deshabilita en modo readonly. */}
      {onContinue && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onContinue}
            disabled={readonly}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            Continuar → Exploración Física
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
