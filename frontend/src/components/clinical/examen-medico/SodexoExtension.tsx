'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { type SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import {
  SODEXO_MATRIZ_FACTOR_IDS,
  SODEXO_MATRIZ_FACTOR_LABELS,
} from '@/lib/sodexo-matriz-factor-labels'
import { SODEXO_GINECO_TOXICO_EXTENSION_ROWS } from '@/lib/sodexo-gineco-extension-rows'
import { SODEXO_PATOLOGICOS_EXTRA_KEYS } from '@/lib/sodexo-pdf-patologicos'

type ManoDominante = NonNullable<
  NonNullable<SodexoExtensionData['examen_encabezado']>['mano_dominante']
>
type TabacoIntensidad = NonNullable<
  NonNullable<SodexoExtensionData['estilos_vida_sodexo']>['tabaco_intensidad']
>
type TabacoAnios = NonNullable<NonNullable<SodexoExtensionData['estilos_vida_sodexo']>['tabaco_anios']>
type AlcoholModo = NonNullable<NonNullable<SodexoExtensionData['estilos_vida_sodexo']>['alcohol_modo']>

const MATRIZ_LIKERT = ['1', '2', '3', '4', '5', 'A'] as const
type MatrizNivel = (typeof MATRIZ_LIKERT)[number]

type HoFila = NonNullable<SodexoExtensionData['historia_ocupacional_filas']>[number]
const HO_EMPTY_ROW: HoFila = { empresa: '', ocupacion: '', tiempo: '', agentes_riesgo: '' }

/** Índice alineado al REG-SO-01 (mismo orden que el formato ejemplo Sodexo). */
const SODEXO_BLOCK_NAV: { id: string; label: string }[] = [
  { id: '1', label: '§1 Identificación' },
  { id: '2-3', label: '§2–3 HO y riesgos' },
  { id: '4', label: '§4 Heredo-familiares' },
  { id: '5', label: '§5 Patológicos' },
  { id: '6', label: '§6 Inmunizaciones' },
  { id: '7', label: '§7 Gineco-obstétricos' },
  { id: '8', label: '§8 Estilos de vida' },
  { id: '9', label: '§9 Examen físico' },
  { id: '10-12', label: '§10–12 Cierre' },
]

function SodexoBlock({
  blockId,
  section,
  title,
  subtitle,
  mode = 'extension',
  children,
}: {
  blockId: string
  section: string
  title: string
  subtitle?: string
  mode?: 'extension' | 'ami'
  children?: ReactNode
}) {
  const isAmi = mode === 'ami'
  return (
    <section
      id={`sodexo-block-${blockId}`}
      className={`rounded-xl overflow-hidden scroll-mt-4 ${
        isAmi
          ? 'border border-dashed border-slate-300 bg-slate-50/90'
          : 'border-2 border-emerald-200 bg-white shadow-sm'
      }`}
    >
      <div
        className={`flex gap-3 px-4 py-3 border-b ${
          isAmi ? 'border-slate-200 bg-slate-100/80' : 'border-emerald-100 bg-emerald-50/60'
        }`}
      >
        <span
          className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-bold ${
            isAmi ? 'bg-slate-500 text-white' : 'bg-emerald-700 text-white'
          }`}
        >
          {section}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 leading-snug">{title}</h2>
          {subtitle ? <p className="text-[11px] text-slate-600 mt-0.5">{subtitle}</p> : null}
          {isAmi ? (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mt-1">
              Solo papeleta AMI — no se captura aquí
            </p>
          ) : (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 mt-1">
              Extensión Sodexo REG-SO-01
            </p>
          )}
        </div>
      </div>
      {children ? <div className="p-4 space-y-5">{children}</div> : null}
    </section>
  )
}

function BlockSubsection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 border-b border-slate-100 pb-1">
        {title}
      </h3>
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
      {children}
    </div>
  )
}

function AmiCaptureNote({ where, detail }: { where: string; detail?: string }) {
  return (
    <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2.5 leading-relaxed">
      <span className="font-bold text-slate-900">Captura en papeleta estándar:</span>{' '}
      <span className="text-emerald-900 font-medium">{where}</span>
      {detail ? <span className="text-slate-600"> — {detail}</span> : null}
    </p>
  )
}

function SodexoBlockNav() {
  return (
    <nav
      className="flex flex-wrap gap-1.5 text-[11px]"
      aria-label="Secciones REG-SO-01"
    >
      {SODEXO_BLOCK_NAV.map((item) => (
        <a
          key={item.id}
          href={`#sodexo-block-${item.id}`}
          className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 font-semibold text-emerald-900 hover:bg-emerald-50 transition-colors"
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}

function hoRowHasContent(row: HoFila | undefined) {
  if (!row) return false
  return Boolean(
    row.empresa?.trim() ||
      row.ocupacion?.trim() ||
      row.tiempo?.trim() ||
      row.agentes_riesgo?.trim(),
  )
}

function hoFilasForUi(value: SodexoExtensionData) {
  const stored = value.historia_ocupacional_filas
  if (!stored?.length) return [{ ...HO_EMPTY_ROW }]
  if (stored.every((r) => !hoRowHasContent(r))) {
    if (stored.length <= 1) return [{ ...HO_EMPTY_ROW, ...stored[0] }]
    return stored.slice(0, Math.min(4, stored.length)).map((r) => ({ ...HO_EMPTY_ROW, ...r }))
  }
  const lastIdx = stored.findLastIndex(hoRowHasContent)
  const count = Math.min(4, Math.max(stored.length, lastIdx + 1))
  const out = stored.slice(0, count).map((r) => ({ ...HO_EMPTY_ROW, ...r }))
  while (out.length < count) out.push({ ...HO_EMPTY_ROW })
  return out
}

function commitHoFilas(value: SodexoExtensionData, filas: HoFila[]) {
  if (filas.length === 1 && !hoRowHasContent(filas[0])) {
    return { ...value, historia_ocupacional_filas: null }
  }
  return { ...value, historia_ocupacional_filas: filas.slice(0, 4) }
}

function NegadoSiRadios({
  name,
  value,
  readonly,
  onChange,
}: {
  name: string
  value: 'NEGADO' | 'SI' | null | undefined
  readonly?: boolean
  onChange: (v: 'NEGADO' | 'SI' | null) => void
}) {
  return (
    <div className="flex justify-center gap-3">
      {(['NEGADO', 'SI'] as const).map((opt) => (
        <label key={opt} className="inline-flex items-center gap-1 text-[11px] text-slate-600">
          <input
            type="radio"
            name={name}
            disabled={readonly}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="border-slate-300"
          />
          {opt === 'NEGADO' ? 'Neg.' : 'Sí'}
        </label>
      ))}
      {value ? (
        <button
          type="button"
          disabled={readonly}
          onClick={() => onChange(null)}
          className="text-[10px] text-slate-400 hover:text-slate-600 underline"
        >
          —
        </button>
      ) : null}
    </div>
  )
}
const FUNCIONES_ITEMS: { key: keyof NonNullable<SodexoExtensionData['funciones_principales']>; label: string }[] = [
  { key: 'administrativa', label: 'Administrativa' },
  { key: 'ayudante', label: 'Ayudante' },
  { key: 'mantenimiento', label: 'Mantenimiento' },
  { key: 'tecnica', label: 'Técnica' },
  { key: 'telefono', label: 'Atención telefónica' },
  { key: 'conduccion', label: 'Conducción' },
]

const TIPO_EXAMEN_OPTS = [
  ['PREINGRESO', 'Preingreso'],
  ['PERIODICA', 'Periódica'],
  ['RETIRO', 'Retiro'],
  ['REINGRESO', 'Reingreso'],
] as const

const EPP_ITEMS: { key: keyof SodexoExtensionData; label: string }[] = [
  { key: 'epp_casco', label: 'Casco' },
  { key: 'epp_mascarilla', label: 'Mascarilla' },
  { key: 'epp_lentes', label: 'Lentes de seguridad' },
  { key: 'epp_botas', label: 'Botas' },
  { key: 'epp_guantes', label: 'Guantes' },
  { key: 'epp_faja', label: 'Faja' },
]

type Props = {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
  sodexoPdfUrl?: string
  showSodexoPdfDownload?: boolean
  sodexoPdfPending?: boolean
  validatingViewHref?: string
}

export function SodexoExtension({
  value,
  onChange,
  readonly = false,
  sodexoPdfUrl,
  showSodexoPdfDownload = false,
  sodexoPdfPending = false,
  validatingViewHref,
}: Props) {
  const set = <K extends keyof SodexoExtensionData>(key: K, v: SodexoExtensionData[K]) => {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <p className="text-sm font-bold text-emerald-900">Formato Sodexo — campos adicionales</p>
        <p className="text-xs text-emerald-700 mt-1">
          Mismo orden que el <strong>formato ejemplo REG-SO-01</strong>: cada bloque numerado coincide con
          una sección del impreso. Los bloques punteados grises se llenan en la papeleta AMI; los verdes,
          solo aquí. El PDF Sodexo no inventa datos.
        </p>
        <div className="mt-3">
          <SodexoBlockNav />
        </div>
      </div>

      {showSodexoPdfDownload && sodexoPdfUrl ? (
        <div
          className="bg-white border-2 border-emerald-400 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3"
          data-testid="sodexo-reg-so01-pdf-download"
        >
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-900">Impresión Sodexo REG-SO-01</p>
            <p className="text-xs text-slate-600 mt-1">
              Formato oficial de historia clínica laboral Sodexo (plantilla AcroForm). No sustituye
              el PDF clínico estándar.
            </p>
          </div>
          <a
            href={sodexoPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors whitespace-nowrap"
          >
            📄 PDF Sodexo
          </a>
        </div>
      ) : sodexoPdfPending ? (
        <div
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-3"
          data-testid="sodexo-reg-so01-pdf-pending"
        >
          <p>
            ⏳ El PDF Sodexo REG-SO-01 se habilita después de{' '}
            <strong>Firmar y Emitir Dictamen</strong> (mismo requisito que el entregable clínico).
          </p>
          {validatingViewHref ? (
            <Link
              href={validatingViewHref}
              className="inline-flex items-center justify-center rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-4 py-2.5 transition-colors"
            >
              Ir a Firma y emitir dictamen →
            </Link>
          ) : null}
        </div>
      ) : null}

      <SodexoBlock
        blockId="1"
        section="§1"
        title="Identificación y datos generales"
        subtitle="Equivalente a la primera hoja del formato ejemplo: datos del trabajador, funciones, EPP y actividades."
      >
        <AmiCaptureNote
          where="Ficha del trabajador + papeleta (nombre, edad, sexo, domicilio, escolaridad, estado civil)"
          detail="La extensión solo pide los campos extra del impreso Sodexo."
        />
        <BlockSubsection title="Tipo de examen y datos de contacto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de examen Sodexo</label>
          <select
            disabled={readonly}
            value={value.tipo_examen ?? ''}
            onChange={(e) => set('tipo_examen', (e.target.value || null) as SodexoExtensionData['tipo_examen'])}
            className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          >
            <option value="">—</option>
            {TIPO_EXAMEN_OPTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <Field
          label="Contacto de emergencia"
          value={value.contacto_emergencia ?? ''}
          onChange={(v) => set('contacto_emergencia', v)}
          readonly={readonly}
        />
        <Field
          label="Teléfono de emergencia"
          value={value.telefono_emergencia ?? ''}
          onChange={(v) => set('telefono_emergencia', v)}
          readonly={readonly}
        />
        <Field
          label="Lugar de nacimiento (PDF §1)"
          value={value.lugar_nacimiento ?? ''}
          onChange={(v) => set('lugar_nacimiento', v)}
          readonly={readonly}
        />
        <Field
          label="Teléfono casa (PDF §1)"
          value={value.telefono_casa ?? ''}
          onChange={(v) => set('telefono_casa', v)}
          readonly={readonly}
        />
        <Field
          label="Teléfono móvil (PDF §1)"
          value={value.telefono_movil ?? ''}
          onChange={(v) => set('telefono_movil', v)}
          readonly={readonly}
        />
        <Field
          label="Núm. exterior"
          value={value.numero_exterior ?? ''}
          onChange={(v) => set('numero_exterior', v)}
          readonly={readonly}
        />
        <Field
          label="Núm. interior"
          value={value.numero_interior ?? ''}
          onChange={(v) => set('numero_interior', v)}
          readonly={readonly}
        />
        <Field
          label="Estado (domicilio)"
          value={value.estado_domicilio ?? ''}
          onChange={(v) => set('estado_domicilio', v)}
          readonly={readonly}
        />
        <Field
          label="Tiempo de radicar en la localidad"
          value={value.tiempo_radicar ?? ''}
          onChange={(v) => set('tiempo_radicar', v)}
          readonly={readonly}
        />
        <Field
          label="Profesión (PDF §1)"
          value={value.profesion ?? ''}
          onChange={(v) => set('profesion', v)}
          readonly={readonly}
        />
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Lee y escribe</label>
          <select
            disabled={readonly}
            value={value.lee_y_escribe ?? ''}
            onChange={(e) =>
              set('lee_y_escribe', (e.target.value || null) as SodexoExtensionData['lee_y_escribe'])
            }
            className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          >
            <option value="">—</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
          </select>
        </div>
        </div>
        </BlockSubsection>

        <BlockSubsection title="Funciones principales del puesto">
        <div className="flex flex-wrap gap-3">
          {FUNCIONES_ITEMS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={readonly}
                checked={Boolean(value.funciones_principales?.[key])}
                onChange={(e) =>
                  set('funciones_principales', {
                    ...(value.funciones_principales ?? {}),
                    [key]: e.target.checked,
                  })
                }
                className="rounded border-slate-300"
              />
              {label}
            </label>
          ))}
        </div>
        </BlockSubsection>

        <BlockSubsection title="Equipo de protección personal (EPP)">
        <div className="mb-3">
          <label className="block text-xs font-bold text-slate-500 mb-1">Uso de EPP (PDF)</label>
          <select
            disabled={readonly}
            value={value.epp_uso ?? ''}
            onChange={(e) =>
              set('epp_uso', (e.target.value || null) as SodexoExtensionData['epp_uso'])
            }
            className="w-full max-w-xs border border-slate-200 rounded-lg p-2 text-sm"
          >
            <option value="">—</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
            <option value="OCASIONAL">Ocasional</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
          {EPP_ITEMS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                disabled={readonly}
                checked={Boolean(value[key])}
                onChange={(e) => set(key, e.target.checked)}
                className="rounded border-slate-300"
              />
              {label}
            </label>
          ))}
        </div>
        </BlockSubsection>

        <BlockSubsection
          title="Identificación de actividades (exámenes periódicos o de retiro)"
          hint="Cargo, antigüedad y tipo de actividad según el REG-SO-01."
        >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Cargo" value={value.actividades_cargo ?? ''} onChange={(v) => set('actividades_cargo', v)} readonly={readonly} />
          <Field label="Fecha de ingreso" value={value.fecha_ingreso_actividades ?? ''} onChange={(v) => set('fecha_ingreso_actividades', v)} readonly={readonly} />
          <Field label="Antigüedad" value={value.antiguedad_actividades ?? ''} onChange={(v) => set('antiguedad_actividades', v)} readonly={readonly} />
          <Field
            label="Tipo de actividad"
            value={value.tipo_actividad ?? ''}
            onChange={(v) => set('tipo_actividad', v)}
            readonly={readonly}
            placeholder="Administrativa, mantenimiento, conducción…"
          />
        </div>
        </BlockSubsection>
      </SodexoBlock>

      <SodexoBlock
        blockId="2-3"
        section="§2–3"
        title="Historia ocupacional, matriz de riesgos y consentimiento"
        subtitle="Antecedentes laborales, identificación de factores de riesgo y declaraciones del formato."
      >
        <AmiCaptureNote
          where="Examen Médico → Antecedentes → Historia ocupacional (narrativa)"
          detail="Si no usas la tabla de abajo, el PDF puede volcar esa narrativa."
        />
        <BlockSubsection
          title="Antecedentes laborales (tabla)"
          hint="Una fila para empezar; agrega hasta 4. Al capturar aquí, sustituye el volcado automático desde la narrativa."
        >
          <HoTabla value={value} onChange={onChange} readonly={readonly} />
        </BlockSubsection>

        <BlockSubsection
          title="Matriz de identificación de factores de riesgo"
          hint="Nivel 1–5 o A por factor, en columnas como el impreso."
        >
          <MatrizLikertTable value={value} onChange={onChange} readonly={readonly} />
        </BlockSubsection>

        <BlockSubsection title="Consentimiento informado y declaración bajo protesta">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={readonly}
            checked={Boolean(value.consentimiento_ho?.informacion_verdadera)}
            onChange={(e) =>
              set('consentimiento_ho', {
                ...(value.consentimiento_ho ?? {}),
                informacion_verdadera: e.target.checked,
              })
            }
          />
          Declaro que la información proporcionada es verídica
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={readonly}
            checked={Boolean(value.consentimiento_ho?.acepta_aviso_privacidad)}
            onChange={(e) =>
              set('consentimiento_ho', {
                ...(value.consentimiento_ho ?? {}),
                acepta_aviso_privacidad: e.target.checked,
              })
            }
          />
          Acepto aviso de privacidad
        </label>
        <Field
          label="Declaración bajo protesta — nombre"
          value={value.declaracion_protesta_nombre ?? ''}
          onChange={(v) => set('declaracion_protesta_nombre', v)}
          readonly={readonly}
        />
        </BlockSubsection>
      </SodexoBlock>

      <SodexoBlock
        blockId="4"
        section="§4"
        title="Antecedentes heredo-familiares"
        subtitle="Rejilla Niega / Sí y parentesco del REG-SO-01."
        mode="ami"
      >
        <AmiCaptureNote
          where="Examen Médico → Antecedentes → Heredo-familiares"
          detail="El PDF Sodexo proyecta lo capturado en la papeleta estándar."
        />
      </SodexoBlock>

      <SodexoBlock
        blockId="5"
        section="§5"
        title="Antecedentes personales patológicos"
        subtitle="Listado de enfermedades y aclaraciones del impreso."
      >
        <AmiCaptureNote
          where="Examen Médico → Antecedentes → Patológicos y no patológicos"
          detail="La mayoría de filas del §5 salen de la captura clínica estándar."
        />
        <BlockSubsection
          title="Ajuste exclusivo Sodexo (opcional)"
          hint="Solo si el PDF debe reflejar un estado distinto en filas sin mapeo directo."
        >
          <PatologicosSodexoTable value={value} onChange={onChange} readonly={readonly} />
        </BlockSubsection>
        <BlockSubsection title="Aclaración de historia personal en el impreso (opcional)">
        <textarea
          disabled={readonly}
          rows={3}
          value={value.aclaracion_historia_personal ?? ''}
          onChange={(e) => set('aclaracion_historia_personal', e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          placeholder="Texto adicional en el REG-SO-01…"
        />
        </BlockSubsection>
      </SodexoBlock>

      <SodexoBlock
        blockId="6"
        section="§6"
        title="Inmunizaciones"
        subtitle="Esquema de vacunación en el formato Sodexo."
      >
        <AmiCaptureNote
          where="Examen Médico → Antecedentes → Módulo 1 (vacunas)"
          detail="Vacunas básicas y fechas IMSS/SSA desde la papeleta estándar."
        />
        <BlockSubsection title="Vacunas complementarias (solo extensión Sodexo)">
          <InmunComplementariasTable value={value} onChange={onChange} readonly={readonly} />
        </BlockSubsection>
      </SodexoBlock>

      <SodexoBlock
        blockId="7"
        section="§7"
        title="Antecedentes gineco-obstétricos"
        subtitle="FUM, gesta, MPF y rejillas del REG-SO-01."
      >
        <AmiCaptureNote
          where="Examen Médico → Antecedentes → Ginecológicos y Módulo 1"
          detail="Datos narrativos y de citología desde la papeleta estándar."
        />
        <BlockSubsection title="Rejilla Sodexo (dismenorrea y tóxicos / medicamentos)">
          <GinecoSodexoTable value={value} onChange={onChange} readonly={readonly} />
        </BlockSubsection>
      </SodexoBlock>

      <SodexoBlock
        blockId="8"
        section="§8"
        title="Estilos de vida"
        subtitle="Tabaco, alcohol y drogas en el formato Sodexo."
      >
        <AmiCaptureNote
          where="Examen Médico → Antecedentes → No patológicos (APNP)"
          detail="Niega / Sí e hábitos base desde la papeleta estándar."
        />
        <BlockSubsection title="Casillas finas del impreso (intensidad tabaco, años, alcohol)">
          <EstilosVidaSodexoFields value={value} onChange={onChange} readonly={readonly} />
        </BlockSubsection>
      </SodexoBlock>

      <SodexoBlock
        blockId="9"
        section="§9"
        title="Examen físico"
        subtitle="Exploración por sistemas, somatometría y agudeza visual."
      >
        <AmiCaptureNote
          where="Somatometría, Signos vitales, Agudeza visual y Examen Médico → Exploración física"
          detail="Texto por sistema, medidas y Snellen en la papeleta estándar."
        />
        <BlockSubsection title="Encabezado Sodexo (estado general / mental, mano dominante)">
        <div className="flex flex-wrap gap-4 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readonly}
              checked={Boolean(value.examen_encabezado?.estado_general_normal)}
              onChange={(e) =>
                set('examen_encabezado', {
                  ...(value.examen_encabezado ?? {}),
                  estado_general_normal: e.target.checked,
                })
              }
            />
            Estado general normal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readonly}
              checked={Boolean(value.examen_encabezado?.estado_mental_normal)}
              onChange={(e) =>
                set('examen_encabezado', {
                  ...(value.examen_encabezado ?? {}),
                  estado_mental_normal: e.target.checked,
                })
              }
            />
            Estado mental normal
          </label>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Mano dominante</label>
            <select
              disabled={readonly}
              value={value.examen_encabezado?.mano_dominante ?? ''}
              onChange={(e) =>
                set('examen_encabezado', {
                  ...(value.examen_encabezado ?? {}),
                  mano_dominante: (e.target.value || null) as ManoDominante | null,
                })
              }
              className="border border-slate-200 rounded-lg p-2 text-sm"
            >
              <option value="">—</option>
              <option value="DIESTRA">Diestra</option>
              <option value="ZURDA">Zurda</option>
              <option value="AMBIDIESTRA">Ambidiestra</option>
            </select>
          </div>
        </div>
        </BlockSubsection>

        <BlockSubsection title="Agudeza visual — casillas del REG-SO-01">
        <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2 font-semibold text-slate-600">Medición</th>
              <th className="text-center p-2 font-semibold text-slate-600 w-24">Marcar</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['lejana_od_sin_correccion', 'Lejana OD sin corrección'],
                ['lejana_oi_sin_correccion', 'Lejana OI sin corrección'],
                ['lejana_od_con_correccion', 'Lejana OD con corrección'],
                ['lejana_oi_con_correccion', 'Lejana OI con corrección'],
                ['cercana_od_sin_correccion', 'Cercana OD sin corrección'],
                ['cercana_oi_sin_correccion', 'Cercana OI sin corrección'],
              ] as const
            ).map(([key, label]) => (
              <tr key={key} className="border-t border-slate-100">
                <td className="p-2 text-slate-700">{label}</td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    disabled={readonly}
                    checked={Boolean(value.visiometria_casillas?.[key])}
                    onChange={(e) =>
                      set('visiometria_casillas', {
                        ...(value.visiometria_casillas ?? {}),
                        [key]: e.target.checked,
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </BlockSubsection>

        <BlockSubsection title="Hallazgos anormales — texto «Cuál»">
        <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2 font-semibold text-slate-600 w-24">Campo</th>
              <th className="text-left p-2 font-semibold text-slate-600">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {(['cual_1', 'cual_2', 'cual_3', 'cual_4'] as const).map((k, i) => (
              <tr key={k} className="border-t border-slate-100">
                <td className="p-2 text-slate-600 font-medium">Cuál {i + 1}</td>
                <td className="p-2">
                  <input
                    disabled={readonly}
                    value={value.examen_anormal_cual?.[k] ?? ''}
                    onChange={(e) =>
                      set('examen_anormal_cual', { ...(value.examen_anormal_cual ?? {}), [k]: e.target.value })
                    }
                    className="w-full border border-slate-200 rounded p-1.5 text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </BlockSubsection>
      </SodexoBlock>

      <SodexoBlock
        blockId="10-12"
        section="§10–12"
        title="Diagnóstico, restricciones, observaciones y aptitud"
        subtitle="Impresión diagnóstica, recomendaciones y firma médica del REG-SO-01."
      >
        <AmiCaptureNote
          where="Examen Médico → Impresión / Aptitud y dictamen"
          detail="Aptitud, restricciones, estudios complementarios y firma del médico."
        />
        <BlockSubsection title="Encabezado de cierre en el PDF (opcional)">
          <Field
            label="Título sección"
            value={value.titulo_seccion_sodexo ?? ''}
            onChange={(v) => set('titulo_seccion_sodexo', v)}
            readonly={readonly}
            placeholder="SALUD OCUPACIONAL SODEXO MÉXICO"
          />
        </BlockSubsection>
      </SodexoBlock>
    </div>
  )
}

function MatrizLikertTable({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const setNivel = (id: string, nivel: MatrizNivel | null) => {
    const next = { ...(value.matriz_factores ?? {}) }
    if (!nivel) delete next[id]
    else next[id] = nivel
    onChange({ ...value, matriz_factores: Object.keys(next).length ? next : null })
  }

  return (
    <>
      <div className="max-h-96 overflow-auto border border-slate-200 rounded-lg">
        <table className="w-full text-[11px] border-collapse min-w-[32rem]">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="text-left p-2 border-b border-slate-200 font-semibold text-slate-600">
                Factor
              </th>
              {MATRIZ_LIKERT.map((n) => (
                <th
                  key={n}
                  className="p-1 border-b border-slate-200 font-bold text-slate-600 w-9 text-center"
                >
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SODEXO_MATRIZ_FACTOR_IDS.map((id) => (
              <tr key={id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50">
                <td className="p-2 text-slate-700 align-top">{SODEXO_MATRIZ_FACTOR_LABELS[id] ?? id}</td>
                {MATRIZ_LIKERT.map((n) => (
                  <td key={n} className="p-1 text-center align-middle">
                    <input
                      type="radio"
                      name={`sodexo-matriz-${id}`}
                      disabled={readonly}
                      checked={value.matriz_factores?.[id] === n}
                      onChange={() => setNivel(id, n)}
                      className="accent-emerald-700"
                      aria-label={`${SODEXO_MATRIZ_FACTOR_LABELS[id] ?? id} nivel ${n}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="block text-xs font-bold text-slate-500 mb-1">Observaciones matriz</label>
      <textarea
        disabled={readonly}
        rows={3}
        value={value.matriz_riesgos_observaciones ?? ''}
        onChange={(e) => onChange({ ...value, matriz_riesgos_observaciones: e.target.value })}
        className="w-full border border-slate-200 rounded-lg p-2 text-sm"
        placeholder="Notas libres adicionales…"
      />
    </>
  )
}

function InmunComplementariasTable({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const ic = value.inmunizaciones_complementarias ?? {}
  const patch = (next: Partial<NonNullable<SodexoExtensionData['inmunizaciones_complementarias']>>) => {
    onChange({ ...value, inmunizaciones_complementarias: { ...ic, ...next } })
  }
  const patchVac = (
    key: 'covid' | 'hepatitis_ab' | 'otras',
    field: string,
    val: string,
  ) => {
    const row = { ...(ic[key] ?? {}), [field]: val }
    patch({ [key]: row })
  }
  const vacLabels: Record<'covid' | 'hepatitis_ab', string> = {
    covid: 'COVID-19',
    hepatitis_ab: 'Hepatitis A/B',
  }

  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={readonly}
          checked={Boolean(ic.niega)}
          onChange={(e) => patch({ niega: e.target.checked })}
        />
        Niega complementarias
      </label>
      <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left p-2 font-semibold text-slate-600">Vacuna</th>
            <th className="p-2 font-semibold text-slate-600 w-28">Estado</th>
            <th className="p-2 font-semibold text-slate-600">Fecha</th>
            <th className="p-2 font-semibold text-slate-600">IMSS</th>
            <th className="p-2 font-semibold text-slate-600">SSA</th>
          </tr>
        </thead>
        <tbody>
          {(['covid', 'hepatitis_ab'] as const).map((vac) => (
            <tr key={vac} className="border-t border-slate-100">
              <td className="p-2 text-slate-700 font-medium">{vacLabels[vac]}</td>
              <td className="p-2">
                <select
                  disabled={readonly}
                  value={ic[vac]?.estado ?? ''}
                  onChange={(e) => patchVac(vac, 'estado', e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5"
                >
                  <option value="">—</option>
                  <option value="NEGADO">Negado</option>
                  <option value="SI">Sí</option>
                </select>
              </td>
              <td className="p-2">
                <input
                  disabled={readonly}
                  placeholder="Fecha"
                  value={ic[vac]?.fecha ?? ''}
                  onChange={(e) => patchVac(vac, 'fecha', e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5"
                />
              </td>
              <td className="p-2">
                <input
                  disabled={readonly}
                  placeholder="IMSS"
                  value={ic[vac]?.imss ?? ''}
                  onChange={(e) => patchVac(vac, 'imss', e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5"
                />
              </td>
              <td className="p-2">
                <input
                  disabled={readonly}
                  placeholder="SSA"
                  value={ic[vac]?.ssa ?? ''}
                  onChange={(e) => patchVac(vac, 'ssa', e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function GinecoSodexoTable({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const g = value.gineco_sodexo ?? {}
  const setG = (patch: Partial<NonNullable<SodexoExtensionData['gineco_sodexo']>>) => {
    onChange({ ...value, gineco_sodexo: { ...g, ...patch } })
  }
  const setTox = (id: string, estado: string) => {
    const tox = { ...(g.toxicos_medicamentos ?? {}) }
    if (!estado) delete tox[id]
    else tox[id] = estado as 'NEGADO' | 'SI'
    setG({ toxicos_medicamentos: Object.keys(tox).length ? tox : null })
  }
  return (
    <>
      <div className="flex flex-wrap gap-4 mb-3">
        <div>
          <label className="text-xs text-slate-500">Dismenorrea</label>
          <select
            disabled={readonly}
            value={g.dismenorrea ?? ''}
            onChange={(e) => setG({ dismenorrea: (e.target.value || null) as 'NEGADO' | 'SI' | null })}
            className="border border-slate-200 rounded p-2 text-sm block mt-1"
          >
            <option value="">—</option>
            <option value="NEGADO">Negado</option>
            <option value="SI">Sí</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm mt-5">
          <input
            type="checkbox"
            disabled={readonly}
            checked={Boolean(g.dismenorrea_incapacitante)}
            onChange={(e) => setG({ dismenorrea_incapacitante: e.target.checked })}
          />
          Incapacitante
        </label>
      </div>
      <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left p-2 font-semibold text-slate-600">Concepto</th>
              <th className="p-2 font-semibold text-slate-600 w-32 text-center">Negado / Sí</th>
            </tr>
          </thead>
          <tbody>
            {SODEXO_GINECO_TOXICO_EXTENSION_ROWS.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="p-2 text-slate-700">{row.label}</td>
                <td className="p-2">
                  <NegadoSiRadios
                    name={`gineco-tox-${row.id}`}
                    value={g.toxicos_medicamentos?.[row.id]}
                    readonly={readonly}
                    onChange={(v) => setTox(row.id, v ?? '')}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function PatologicosSodexoTable({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  return (
      <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left p-2 font-semibold text-slate-600">Enfermedad</th>
              <th className="p-2 font-semibold text-slate-600 w-32 text-center">Negado / Sí</th>
              <th className="text-left p-2 font-semibold text-slate-600">Detalle PDF</th>
            </tr>
          </thead>
          <tbody>
            {SODEXO_PATOLOGICOS_EXTRA_KEYS.map((key) => {
              const row = value.patologicos_sodexo?.[key]
              return (
                <tr key={key} className="border-t border-slate-100">
                  <td className="p-2 text-slate-700 capitalize">{key.replace(/_/g, ' ')}</td>
                  <td className="p-2">
                    <NegadoSiRadios
                      name={`pat-sodexo-${key}`}
                      value={row?.estado ?? undefined}
                      readonly={readonly}
                      onChange={(estado) => {
                        const map = { ...(value.patologicos_sodexo ?? {}) }
                        if (!estado) delete map[key]
                        else
                          map[key] = {
                            ...map[key],
                            estado,
                            descripcion: map[key]?.descripcion ?? '',
                          }
                        onChange({
                          ...value,
                          patologicos_sodexo: Object.keys(map).length ? map : null,
                        })
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      disabled={readonly}
                      placeholder="Detalle"
                      value={row?.descripcion ?? ''}
                      onChange={(e) => {
                        const map = { ...(value.patologicos_sodexo ?? {}) }
                        map[key] = { estado: map[key]?.estado ?? null, descripcion: e.target.value }
                        onChange({ ...value, patologicos_sodexo: map })
                      }}
                      className="w-full border border-slate-200 rounded p-1.5"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
  )
}

function EstilosVidaSodexoFields({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const ev = value.estilos_vida_sodexo ?? {}
  const patch = (p: Partial<NonNullable<SodexoExtensionData['estilos_vida_sodexo']>>) => {
    onChange({ ...value, estilos_vida_sodexo: { ...ev, ...p } })
  }
  return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-500">Intensidad tabaco</label>
          <select
            disabled={readonly}
            value={ev.tabaco_intensidad ?? ''}
            onChange={(e) =>
              patch({
                tabaco_intensidad: (e.target.value || null) as TabacoIntensidad | null,
              })
            }
            className="w-full border border-slate-200 rounded p-2 text-sm mt-1"
          >
            <option value="">—</option>
            <option value="EVENTUAL">Eventual</option>
            <option value="HABITUAL">Habitual</option>
            <option value="COMPULSIVO">Compulsivo</option>
            <option value="EXFUMADOR">Exfumador</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Años de hábito</label>
          <select
            disabled={readonly}
            value={ev.tabaco_anios ?? ''}
            onChange={(e) =>
              patch({
                tabaco_anios: (e.target.value || null) as TabacoAnios | null,
              })
            }
            className="w-full border border-slate-200 rounded p-2 text-sm mt-1"
          >
            <option value="">—</option>
            <option value="1_5">1–5</option>
            <option value="6_10">6–10</option>
            <option value="11_20">11–20</option>
            <option value="MAS_20">&gt;20</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Alcohol</label>
          <select
            disabled={readonly}
            value={ev.alcohol_modo ?? ''}
            onChange={(e) =>
              patch({
                alcohol_modo: (e.target.value || null) as AlcoholModo | null,
              })
            }
            className="w-full border border-slate-200 rounded p-2 text-sm mt-1"
          >
            <option value="">—</option>
            <option value="OCASIONAL">Ocasional</option>
            <option value="FRECUENTE">Frecuente</option>
          </select>
        </div>
      </div>
  )
}

function HoTabla({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const filas = hoFilasForUi(value)

  const patchRow = (index: number, patch: Partial<(typeof filas)[0]>) => {
    const next = filas.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange(commitHoFilas(value, next))
  }

  const addRow = () => {
    if (filas.length >= 4) return
    onChange(commitHoFilas(value, [...filas, { ...HO_EMPTY_ROW }]))
  }

  const removeRow = (index: number) => {
    if (filas.length <= 1) return
    const next = filas.filter((_, i) => i !== index)
    onChange(commitHoFilas(value, next))
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left p-2 font-semibold text-slate-600">Empresa / área</th>
            <th className="text-left p-2 font-semibold text-slate-600">Ocupación</th>
            <th className="text-left p-2 font-semibold text-slate-600 w-28">Tiempo</th>
            <th className="text-left p-2 font-semibold text-slate-600">Agentes de riesgo</th>
            <th className="p-2 w-16" />
          </tr>
        </thead>
        <tbody>
          {filas.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="p-2">
                <input
                  disabled={readonly}
                  placeholder="Empresa"
                  value={row.empresa ?? ''}
                  onChange={(e) => patchRow(i, { empresa: e.target.value })}
                  className="w-full border border-slate-200 rounded p-1.5 text-sm"
                />
              </td>
              <td className="p-2">
                <input
                  disabled={readonly}
                  placeholder="Ocupación"
                  value={row.ocupacion ?? ''}
                  onChange={(e) => patchRow(i, { ocupacion: e.target.value })}
                  className="w-full border border-slate-200 rounded p-1.5 text-sm"
                />
              </td>
              <td className="p-2">
                <input
                  disabled={readonly}
                  placeholder="Tiempo"
                  value={row.tiempo ?? ''}
                  onChange={(e) => patchRow(i, { tiempo: e.target.value })}
                  className="w-full border border-slate-200 rounded p-1.5 text-sm"
                />
              </td>
              <td className="p-2">
                <input
                  disabled={readonly}
                  placeholder="Agentes"
                  value={row.agentes_riesgo ?? ''}
                  onChange={(e) => patchRow(i, { agentes_riesgo: e.target.value })}
                  className="w-full border border-slate-200 rounded p-1.5 text-sm"
                />
              </td>
              <td className="p-2 text-center align-middle">
                {filas.length > 1 && !readonly ? (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-[10px] text-red-600 hover:underline"
                    title="Quitar fila"
                  >
                    Quitar
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!readonly && filas.length < 4 ? (
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-semibold text-emerald-800 hover:text-emerald-900"
        >
          + Agregar antecedente laboral ({filas.length}/4)
        </button>
      ) : null}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  readonly,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  readonly?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
      <input
        disabled={readonly}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg p-2 text-sm"
      />
    </div>
  )
}
