'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { type SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import {
  SODEXO_MATRIZ_FACTOR_LABELS,
  SODEXO_MATRIZ_SECTIONS,
  type SodexoMatrizSection,
} from '@/lib/sodexo-matriz-factor-labels'
import { SODEXO_GINECO_TOXICO_EXTENSION_ROWS } from '@/lib/sodexo-gineco-extension-rows'
import {
  SODEXO_PATOLOGICOS_GROUPS_LEFT,
  SODEXO_PATOLOGICOS_GROUPS_RIGHT,
  sodexoPatologicosCatalogByColumn,
} from '@/lib/sodexo-patologicos-catalog'
import { syncSodexoExtensionCapture } from '@/lib/sodexo-extension-capture-defaults'
import {
  SODEXO_INMUNIZACIONES_CATALOG,
  type SodexoInmunizacionKey,
} from '@/lib/sodexo-inmunizaciones-catalog'
import { estilosVidaSodexoIsEmpty } from '@/lib/sodexo-estilos-vida-catalog'
import {
  SODEXO_EXAMEN_FISICO_91_COLUMN_LEFT,
  SODEXO_EXAMEN_FISICO_91_COLUMN_RIGHT,
  SODEXO_91_OROFARINGE_SIN_ACROFORM,
} from '@/lib/sodexo-examen-fisico-91-layout'
import {
  examenFisicoSodexoIsEmpty,
  SODEXO_EXAMEN_FISICO_CATALOG,
  SODEXO_EXAMEN_FISICO_SECTIONS,
  sodexoExamenFisicoCatalogBySection,
} from '@/lib/sodexo-examen-fisico-catalog'
import type { SodexoEfCatalogEntry } from '@/lib/sodexo-examen-fisico-types'
import { sodexoEfEntryVisibleForSex } from '@/lib/sodexo-examen-fisico-visibility'
import { SODEXO_ARCOS_MI, SODEXO_ARCOS_MS } from '@/lib/sodexo-examen-fisico-arcos'
import { SodexoArcosMovimientoGrid } from '@/components/clinical/examen-medico/SodexoArcosMovimientoGrid'
import { SodexoColumnaVertebralSection } from '@/components/clinical/examen-medico/SodexoColumnaVertebralSection'
import {
  historiaOcupacionalAmiNarrative,
  identificacionAmiRows,
  puestoActualFromAntecedentes,
  isSodexoFemalePatient,
  isSodexoMalePatient,
  resolvePatientSexo,
  sodexoNeedsActividadesBlock,
  type SodexoAmiMirrorInput,
} from '@/lib/sodexo-ami-mirror'
import {
  commitHoTable,
  hoTableForUi,
  HO_EMPTY_ROW,
  matrizColumnHeaders,
  matrizFactorColumns,
  toggleMatrizFactorColumn,
  type SodexoHoFila,
  type SodexoMatrizColumn,
} from '@/lib/sodexo-ho-table'
import {
  SODEXO_HEREDOFAMILIAR_LEFT,
  SODEXO_HEREDOFAMILIAR_RIGHT,
  type SodexoHeredofamiliarKey,
} from '@/lib/sodexo-heredofamiliar'
import { AmiMirrorTable, AmiMirrorTextBlock } from '@/components/clinical/examen-medico/SodexoAmiPreview'
import { validateSodexoExtensionForClinicalClose } from '@/lib/sodexo-extension-validation'

type ManoDominante = NonNullable<
  NonNullable<SodexoExtensionData['examen_encabezado']>['mano_dominante']
>
function SodexoBlock({
  blockId,
  title,
  children,
}: {
  blockId: string
  title: string
  children?: ReactNode
}) {
  return (
    <section
      id={`sodexo-block-${blockId}`}
      className="rounded-lg border border-slate-200 bg-white scroll-mt-4"
    >
      <h2 className="text-xs font-bold text-slate-800 px-3 py-2 border-b border-slate-100 bg-slate-50">
        {title}
      </h2>
      {children ? <div className="p-3 space-y-3">{children}</div> : null}
    </section>
  )
}

function BlockSubsection({ title, children }: { title?: string; children: ReactNode }) {
  if (!title) return <>{children}</>
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-slate-600">{title}</p>
      {children}
    </div>
  )
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
type FuncionesCheckboxKey = Exclude<
  keyof NonNullable<SodexoExtensionData['funciones_principales']>,
  'otro'
>

const FUNCIONES_ITEMS: { key: FuncionesCheckboxKey; label: string }[] = [
  { key: 'administrativa', label: 'Administrativa' },
  { key: 'ayudante', label: 'Ayudante general' },
  { key: 'mantenimiento', label: 'Mantenimiento' },
  { key: 'tecnica', label: 'Técnica' },
  { key: 'telefono', label: 'Atención telefónica' },
  { key: 'conduccion', label: 'Conducción de vehículos' },
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

function SodexoPdfGeneratePanel({
  value,
  previewApiUrl,
  officialUrl,
  showOfficial,
}: {
  value: SodexoExtensionData
  previewApiUrl?: string
  officialUrl?: string
  showOfficial?: boolean
}) {
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl)
    }
  }, [pdfObjectUrl])

  if (!previewApiUrl && !officialUrl) return null
  const validation = validateSodexoExtensionForClinicalClose(value)
  const ready = validation.ok

  async function generatePreview() {
    if (!previewApiUrl || !ready) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(previewApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ extension: value }),
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const j = (await res.json()) as { error?: string; details?: string[] }
          setError([j.error, ...(j.details ?? [])].filter(Boolean).join(' · '))
        } else {
          const text = (await res.text()).trim()
          setError(text || 'No se pudo generar el PDF Sodexo.')
        }
        return
      }
      const blob = await res.blob()
      setPdfObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
      setGeneratedAt(Date.now())
    } catch {
      setError('No se pudo generar el PDF. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="bg-white border border-emerald-400 rounded-lg p-3 space-y-2"
      data-testid="sodexo-reg-so01-pdf-generate"
    >
      <div>
        <p className="text-sm font-bold text-emerald-900">Vista previa PDF Sodexo</p>
        <p className="text-xs text-slate-600 mt-1">
          Genera o actualiza el PDF con los datos de esta pantalla. El PDF firmado queda disponible
          tras emitir el dictamen.
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      ) : null}

      {!ready ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <p className="font-bold">Falta completar para generar:</p>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            {validation.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!ready || !previewApiUrl || loading}
          onClick={() => void generatePreview()}
          className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
        >
          {loading
            ? 'Generando…'
            : generatedAt
              ? '↻ Actualizar PDF'
              : '📄 Generar PDF Sodexo'}
        </button>
        {previewApiUrl ? (
          <a
            href={pdfObjectUrl ?? '#'}
            download={pdfObjectUrl ? 'REG-SO-01-vista-previa.pdf' : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!ready || !pdfObjectUrl}
            onClick={(e) => {
              if (!pdfObjectUrl) e.preventDefault()
            }}
            className={`text-sm font-bold px-5 py-2.5 rounded-xl border transition-colors ${
              ready && pdfObjectUrl
                ? 'border-emerald-700 text-emerald-800 hover:bg-emerald-50'
                : 'border-slate-200 text-slate-400 pointer-events-none'
            }`}
          >
            ⬇ Descargar PDF
          </a>
        ) : null}
        {showOfficial && officialUrl ? (
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white transition-colors"
          >
            PDF firmado
          </a>
        ) : null}
      </div>

      {generatedAt && pdfObjectUrl ? (
        <iframe
          key={generatedAt}
          src={pdfObjectUrl}
          title="PDF Sodexo"
          className="w-full h-[720px] border border-slate-200 rounded-lg bg-slate-50"
        />
      ) : null}
    </div>
  )
}

type Props = {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
  sodexoPdfUrl?: string
  sodexoPreviewApiUrl?: string
  showSodexoPdfDownload?: boolean
  sodexoPdfPending?: boolean
  validatingViewHref?: string
  /** Datos AMI ya capturados (se muestran en espejo en cada bloque). */
  ami?: SodexoAmiMirrorInput
}

export function SodexoExtension({
  value,
  onChange,
  readonly = false,
  sodexoPdfUrl,
  sodexoPreviewApiUrl,
  showSodexoPdfDownload = false,
  sodexoPdfPending = false,
  validatingViewHref,
  ami,
}: Props) {
  const set = <K extends keyof SodexoExtensionData>(key: K, v: SodexoExtensionData[K]) => {
    onChange({ ...value, [key]: v })
  }

  const amiCtx: SodexoAmiMirrorInput = ami ?? {
    examForm: {},
    antecedentesCaptured: {},
    modulo1: {},
    somatometry: {},
    vitalSigns: {},
    eyeAcuity: {},
  }
  const patientSexo = resolvePatientSexo(
    amiCtx.examForm,
    amiCtx.modulo1,
    amiCtx.antecedentesCaptured,
    amiCtx.prefilledData,
  )
  const showGineco = isSodexoFemalePatient(patientSexo)
  const showActividades = sodexoNeedsActividadesBlock(value.tipo_examen)

  useEffect(() => {
    if (readonly) return
    const fromAmi = puestoActualFromAntecedentes(amiCtx.antecedentesCaptured)
    if (!fromAmi || value.actividades_cargo?.trim()) return
    onChange({ ...value, actividades_cargo: fromAmi })
  }, [amiCtx.antecedentesCaptured, value.actividades_cargo, readonly, onChange, value])

  const sodexoValueRef = useRef(value)
  sodexoValueRef.current = value

  useEffect(() => {
    if (readonly) return
    const current = sodexoValueRef.current
    const synced = syncSodexoExtensionCapture(current, {
      patientSexo,
      showGineco,
      antecedentesCaptured: amiCtx.antecedentesCaptured,
      modulo1: amiCtx.modulo1 as Record<string, unknown>,
      inmunizacionesComplementariasLegacy: current.inmunizaciones_complementarias,
    })
    if (JSON.stringify(synced) !== JSON.stringify(current)) {
      onChange(synced)
    }
  }, [
    readonly,
    patientSexo,
    showGineco,
    amiCtx.antecedentesCaptured,
    amiCtx.modulo1,
    onChange,
  ])

  return (
    <div className="space-y-3">
      {showSodexoPdfDownload && sodexoPdfUrl ? (
        <div
          className="bg-white border-2 border-emerald-400 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3"
          data-testid="sodexo-reg-so01-pdf-download"
        >
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-900">PDF Sodexo firmado</p>
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
            Vista previa al final de esta pestaña. PDF firmado tras{' '}
            <strong>Firmar y Emitir Dictamen</strong>.
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

      <SodexoBlock blockId="1" title="Identificación">
        <AmiMirrorTable rows={identificacionAmiRows(amiCtx)} emptyHint="" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          label="Lugar de nacimiento"
          value={value.lugar_nacimiento ?? ''}
          onChange={(v) => set('lugar_nacimiento', v)}
          readonly={readonly}
        />
        <Field
          label="Teléfono casa"
          value={value.telefono_casa ?? ''}
          onChange={(v) => set('telefono_casa', v)}
          readonly={readonly}
        />
        <Field
          label="Teléfono móvil"
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
          label="Profesión"
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
      </SodexoBlock>

      <SodexoBlock blockId="1.2" title="Identificación de actividades">
        <div className="space-y-3">
          <div className="max-w-md">
            <label className="block text-xs font-bold text-slate-500 mb-1">Tipo de examen Sodexo</label>
            <select
              disabled={readonly}
              value={value.tipo_examen ?? ''}
              onChange={(e) =>
                set('tipo_examen', (e.target.value || null) as SodexoExtensionData['tipo_examen'])
              }
              className="w-full border border-slate-200 rounded-lg p-2 text-sm bg-white"
            >
              <option value="">—</option>
              {TIPO_EXAMEN_OPTS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {showActividades ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field
                label="Cargo"
                value={value.actividades_cargo ?? ''}
                onChange={(v) => set('actividades_cargo', v)}
                readonly={readonly}
                placeholder="Se llena desde Antecedentes → Puesto actual si está vacío"
              />
              <Field
                label="Fecha de ingreso"
                value={value.fecha_ingreso_actividades ?? ''}
                onChange={(v) => set('fecha_ingreso_actividades', v)}
                readonly={readonly}
              />
              <Field
                label="Antigüedad (años)"
                value={value.antiguedad_actividades ?? ''}
                onChange={(v) => set('antiguedad_actividades', v)}
                readonly={readonly}
              />
            </div>
          ) : null}

          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-600 mb-2">Funciones principales</p>
            <div className="flex flex-wrap gap-3">
              {FUNCIONES_ITEMS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700 bg-white rounded-lg px-2 py-1 border border-slate-100">
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
            <div className="mt-3">
              <Field
                label="Otro (¿Cuál?)"
                value={value.tipo_actividad ?? ''}
                onChange={(v) => set('tipo_actividad', v)}
                readonly={readonly}
                placeholder="Función no listada en las casillas"
              />
            </div>
          </div>
        </div>
      </SodexoBlock>

      <SodexoBlock blockId="3" title="Historia ocupacional">
        <AmiMirrorTextBlock
          title=""
          text={historiaOcupacionalAmiNarrative(amiCtx.antecedentesCaptured)}
          emptyHint=""
        />
        <BlockSubsection title="Historial de empleos">
          <HoTabla value={value} onChange={onChange} readonly={readonly} />
        </BlockSubsection>
        <BlockSubsection title="Matriz de factores de riesgo">
          <MatrizFactoresTable value={value} onChange={onChange} readonly={readonly} />
        </BlockSubsection>
        <BlockSubsection title="EPP">
          <div className="mb-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">Uso de EPP</label>
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
      </SodexoBlock>

      <SodexoBlock blockId="4" title="Antecedentes heredo-familiares">
        <HeredofamiliarSodexoTable value={value} onChange={onChange} readonly={readonly} />
      </SodexoBlock>

      <SodexoBlock blockId="5" title="Antecedentes personales patológicos">
        <PatologicosSodexoTable value={value} onChange={onChange} readonly={readonly} />
        <textarea
          disabled={readonly}
          rows={2}
          value={value.aclaracion_historia_personal ?? ''}
          onChange={(e) => set('aclaracion_historia_personal', e.target.value)}
          className="w-full border border-slate-200 rounded-lg p-2 text-sm mt-2"
          placeholder="Aclaración de historia personal (opcional)"
        />
      </SodexoBlock>

      <SodexoBlock blockId="6" title="Inmunizaciones">
        <InmunizacionesSodexoTable value={value} onChange={onChange} readonly={readonly} />
      </SodexoBlock>

      {showGineco ? (
        <SodexoBlock blockId="7" title="Historia gineco-obstétrica">
          <GinecoSodexoTable value={value} onChange={onChange} readonly={readonly} />
        </SodexoBlock>
      ) : null}

      <SodexoBlock blockId="8" title="Estilos de vida">
        <EstilosVidaSodexoTable value={value} onChange={onChange} readonly={readonly} />
      </SodexoBlock>

      <SodexoBlock blockId="9" title="Examen físico">
        <ExamenFisicoSodexoTable
          value={value}
          onChange={onChange}
          readonly={readonly}
          patientSexo={patientSexo}
        />
      </SodexoBlock>

      <SodexoPdfGeneratePanel
        value={value}
        previewApiUrl={sodexoPreviewApiUrl}
        officialUrl={sodexoPdfUrl}
        showOfficial={showSodexoPdfDownload}
      />
    </div>
  )
}

function MatrizVerticalLabel({
  children,
  tone = 'main',
}: {
  children: string
  tone?: 'main' | 'sub'
}) {
  const skin =
    tone === 'main'
      ? 'w-9 bg-slate-800 text-white'
      : 'w-7 bg-slate-200 text-slate-700 border-r border-slate-300'
  return (
    <div className={`flex items-center justify-center px-0.5 shrink-0 self-stretch ${skin}`}>
      <span className="text-[9px] font-bold uppercase [writing-mode:vertical-rl] rotate-180 leading-tight text-center">
        {children}
      </span>
    </div>
  )
}

function matrizFactorRowCells(
  factorIds: string[],
  columns: ReturnType<typeof matrizColumnHeaders>,
  matriz: SodexoExtensionData['matriz_factores'],
  readonly: boolean | undefined,
  toggle: (factorId: string, col: SodexoMatrizColumn, checked: boolean) => void,
) {
  return factorIds.map((id) => (
    <tr key={id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/40">
      <td className="p-1 pl-1.5 text-slate-700 align-middle text-[10px] leading-tight">
        {SODEXO_MATRIZ_FACTOR_LABELS[id] ?? id}
      </td>
      {columns.map((col) => {
        const selected = matrizFactorColumns(matriz, id).includes(col.key)
        return (
          <td key={col.key} className="p-0.5 text-center align-middle">
            <input
              type="checkbox"
              disabled={readonly || !col.active}
              checked={selected}
              onChange={(e) => toggle(id, col.key, e.target.checked)}
              className="accent-emerald-700 scale-90"
              aria-label={`${SODEXO_MATRIZ_FACTOR_LABELS[id] ?? id} empleo ${col.title}`}
            />
          </td>
        )
      })}
    </tr>
  ))
}

function MatrizEmpresaHead({
  columns,
}: {
  columns: ReturnType<typeof matrizColumnHeaders>
}) {
  return (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="text-left p-1 pl-1.5 text-[9px] font-semibold text-slate-500 w-[38%]">
          Factor
        </th>
        {columns.map((col) => (
          <th
            key={col.key}
            className={`p-0.5 text-center align-bottom ${col.active ? 'text-slate-800' : 'text-slate-400'}`}
            title={col.active ? col.subtitle : `Empleo ${col.title} (sin capturar en historial)`}
          >
            <div className="text-[11px] font-bold leading-none">{col.title}</div>
            {col.active ? (
              <div className="text-[7px] font-normal leading-tight truncate max-w-[2.75rem] mx-auto mt-0.5">
                {col.subtitle}
              </div>
            ) : null}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function MatrizSectionPanel({
  section,
  columns,
  matriz,
  readonly,
  toggle,
}: {
  section: SodexoMatrizSection
  columns: ReturnType<typeof matrizColumnHeaders>
  matriz: SodexoExtensionData['matriz_factores']
  readonly?: boolean
  toggle: (factorId: string, col: SodexoMatrizColumn, checked: boolean) => void
}) {
  const groups: { label?: string; factorIds: string[] }[] = section.blocks?.length
    ? section.blocks.map((b) => ({ label: b.label, factorIds: b.factorIds }))
    : [{ factorIds: section.factorIds ?? [] }]

  const colSpan = columns.length + 1

  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white min-h-[10rem]">
      <MatrizVerticalLabel>{section.title}</MatrizVerticalLabel>
      <table className="w-full min-w-[11rem] text-[10px] border-collapse flex-1">
        <MatrizEmpresaHead columns={columns} />
        <tbody>
          {groups.flatMap((group, gi) => {
            const rows = matrizFactorRowCells(group.factorIds, columns, matriz, readonly, toggle)
            if (!group.label) return rows
            return [
              <tr key={`${section.id}-sep-${gi}`} className="bg-slate-100/90">
                <td colSpan={colSpan} className="px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                  {group.label}
                </td>
              </tr>,
              ...rows,
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

function MatrizFactoresTable({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const ho = hoTableForUi(value)
  const columns = matrizColumnHeaders(ho)

  const toggle = (factorId: string, col: SodexoMatrizColumn, checked: boolean) => {
    onChange({
      ...value,
      matriz_factores: toggleMatrizFactorColumn(value.matriz_factores, factorId, col, checked),
    })
  }

  return (
    <>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-3 min-w-0 max-h-[32rem] overflow-y-auto pr-1">
          {SODEXO_MATRIZ_SECTIONS.map((section) => (
            <MatrizSectionPanel
              key={section.id}
              section={section}
              columns={columns}
              matriz={value.matriz_factores}
              readonly={readonly}
              toggle={toggle}
            />
          ))}
        </div>
      </div>
      <label className="block text-xs font-bold text-slate-500 mb-1 mt-3">Observaciones matriz</label>
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

function InmunizacionesSodexoTable({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const data = value.inmunizaciones_sodexo ?? { filas: {}, observaciones: '' }
  const filas = data.filas ?? {}

  const setRoot = (patch: Partial<NonNullable<SodexoExtensionData['inmunizaciones_sodexo']>>) => {
    const next = { ...data, ...patch }
    const empty =
      !(next.observaciones ?? '').trim() &&
      !SODEXO_INMUNIZACIONES_CATALOG.some((r) => {
        const f = next.filas?.[r.key]
        return f?.estado === 'NEGADO' || f?.estado === 'SI'
      })
    onChange({ ...value, inmunizaciones_sodexo: empty ? null : next })
  }

  const patchFila = (key: SodexoInmunizacionKey, patch: Record<string, string | null | undefined>) => {
    const prev = filas[key] ?? {}
    const merged = { ...prev, ...patch }
    const map = { ...filas, [key]: merged }
    if (!merged.estado && !Object.values(merged).some((v) => typeof v === 'string' && v.trim())) {
      delete map[key]
    }
    setRoot({ filas: map })
  }

  const renderSection = (section: 'basica' | 'complementaria', title: string) => {
    const rows = SODEXO_INMUNIZACIONES_CATALOG.filter((r) => r.section === section)
    const descHeader = section === 'basica' ? 'Describir' : 'Describir'
    return (
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 px-2 py-1 border-b border-slate-100">
          {title}
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left p-1.5 font-semibold text-slate-600 italic">Vacuna</th>
              <th className="p-1.5 w-10 text-center font-semibold text-slate-600 italic">Niega</th>
              <th className="p-1.5 w-10 text-center font-semibold text-slate-600 italic">Sí</th>
              <th className="p-1.5 font-semibold text-slate-600 italic">Fecha</th>
              <th className="p-1.5 font-semibold text-slate-600 italic">IMSS</th>
              <th className="p-1.5 font-semibold text-slate-600 italic">SSA</th>
              <th className="p-1.5 font-semibold text-slate-600 italic">Otros</th>
              {section === 'complementaria' ? (
                <th className="p-1.5 font-semibold text-slate-600 italic">Marca</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => {
              const row = filas[entry.key]
              const isSi = row?.estado === 'SI'
              const isNeg = row?.estado === 'NEGADO'
              return (
                <tr key={entry.key} className="border-t border-slate-50">
                  <td className="p-1.5 text-slate-800 font-medium">{entry.label}</td>
                  <td className="p-1.5 text-center">
                    <input
                      type="radio"
                      name={`inmun-${entry.key}`}
                      disabled={readonly}
                      checked={isNeg}
                      onChange={() => patchFila(entry.key, { estado: 'NEGADO', fecha: '', imss: '', ssa: '', otros: '', marca: '' })}
                      aria-label={`${entry.label} — Niega`}
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="radio"
                      name={`inmun-${entry.key}`}
                      disabled={readonly}
                      checked={isSi}
                      onChange={() => patchFila(entry.key, { estado: 'SI' })}
                      aria-label={`${entry.label} — Sí`}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      disabled={readonly || !isSi}
                      value={row?.fecha ?? ''}
                      onChange={(e) => patchFila(entry.key, { fecha: e.target.value })}
                      className="w-full min-w-[4.5rem] border border-slate-200 rounded p-1 text-[11px] disabled:bg-slate-50"
                      placeholder="—"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      disabled={readonly || !isSi}
                      value={row?.imss ?? ''}
                      onChange={(e) => patchFila(entry.key, { imss: e.target.value })}
                      className="w-full min-w-[3rem] border border-slate-200 rounded p-1 text-[11px] disabled:bg-slate-50"
                      placeholder="—"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      disabled={readonly || !isSi}
                      value={row?.ssa ?? ''}
                      onChange={(e) => patchFila(entry.key, { ssa: e.target.value })}
                      className="w-full min-w-[3rem] border border-slate-200 rounded p-1 text-[11px] disabled:bg-slate-50"
                      placeholder="—"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      disabled={readonly || !isSi}
                      value={row?.otros ?? ''}
                      onChange={(e) => patchFila(entry.key, { otros: e.target.value })}
                      className="w-full min-w-[3rem] border border-slate-200 rounded p-1 text-[11px] disabled:bg-slate-50"
                      placeholder={descHeader}
                    />
                  </td>
                  {section === 'complementaria' ? (
                    <td className="p-1.5">
                      {entry.marca ? (
                        <input
                          disabled={readonly || !isSi}
                          value={row?.marca ?? ''}
                          onChange={(e) => patchFila(entry.key, { marca: e.target.value })}
                          className="w-full min-w-[4rem] border border-slate-200 rounded p-1 text-[11px] disabled:bg-slate-50"
                          placeholder="Marca"
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {renderSection('basica', 'Básica')}
        {renderSection('complementaria', 'Complementaria')}
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Observaciones</label>
        <textarea
          disabled={readonly}
          rows={2}
          value={data.observaciones ?? ''}
          onChange={(e) => setRoot({ observaciones: e.target.value })}
          className="w-full border border-slate-200 rounded-lg p-2 text-sm"
          placeholder="Aclaraciones de inmunizaciones…"
        />
      </div>
    </div>
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

  const dismValue =
    g.dismenorrea === 'NEGADO'
      ? 'NO'
      : g.dismenorrea === 'SI' && g.dismenorrea_incapacitante
        ? 'INCAPACITANTE'
        : g.dismenorrea ?? ''

  const obstetricFields: { key: keyof NonNullable<SodexoExtensionData['gineco_sodexo']>; label: string; placeholder?: string }[] = [
    { key: 'ciclos', label: 'Ciclos', placeholder: 'ej. 28 / 30' },
    { key: 'fum', label: 'FUM' },
    { key: 'gesta', label: 'G' },
    { key: 'parto', label: 'P' },
    { key: 'cesarea', label: 'C' },
    { key: 'aborto', label: 'A' },
    { key: 'vivos', label: 'Vivos' },
    { key: 'fup', label: 'FUP' },
  ]

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
        {obstetricFields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-[10px] font-semibold text-slate-600">{label}</label>
            <input
              disabled={readonly}
              value={String(g[key] ?? '')}
              onChange={(e) => setG({ [key]: e.target.value })}
              placeholder={placeholder}
              className="mt-0.5 w-full border border-slate-200 rounded p-1.5 text-xs"
            />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4 border border-slate-100 rounded-lg p-3 bg-slate-50/50">
        <div>
          <p className="text-[10px] font-bold text-slate-600 mb-1">Dismenorrea</p>
          <div className="flex flex-wrap gap-3 text-xs">
            {(['NO', 'SI', 'INCAPACITANTE'] as const).map((opt) => (
              <label key={opt} className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="gineco-dismenorrea"
                  disabled={readonly}
                  checked={dismValue === opt}
                  onChange={() =>
                    setG({
                      dismenorrea: opt,
                      dismenorrea_incapacitante: opt === 'INCAPACITANTE' ? true : false,
                    })
                  }
                />
                {opt === 'NO' ? 'No' : opt === 'SI' ? 'Sí' : 'Incapacitante'}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-600">Método de planificación</label>
          <input
            disabled={readonly}
            value={g.metodo_planificacion ?? ''}
            onChange={(e) => setG({ metodo_planificacion: e.target.value })}
            className="mt-0.5 w-full border border-slate-200 rounded p-1.5 text-xs bg-white"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-600">Última citología</label>
          <input
            disabled={readonly}
            value={g.ultima_citologia ?? ''}
            onChange={(e) => setG({ ultima_citologia: e.target.value })}
            className="mt-0.5 w-full border border-slate-200 rounded p-1.5 text-xs bg-white"
          />
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Tóxicos / medicamentos (rejilla impreso)</p>
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

function HeredofamiliarSodexoTable({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const patchRow = (key: SodexoHeredofamiliarKey, patch: Partial<{ respuesta: 'NO' | 'SI' | null; parentesco: string }>) => {
    const map = { ...(value.heredofamiliar_sodexo ?? {}) }
    const prev = map[key] ?? {}
    const next = { ...prev, ...patch }
    if (!next.respuesta && !next.parentesco?.trim()) delete map[key]
    else map[key] = next
    onChange({
      ...value,
      heredofamiliar_sodexo: Object.keys(map).length ? map : null,
    })
  }

  const renderColumn = (rows: { key: SodexoHeredofamiliarKey; label: string }[]) => (
    <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
      <thead className="bg-slate-50">
        <tr>
          <th className="text-left p-2 font-semibold text-slate-600 italic">Patología</th>
          <th className="p-2 font-semibold text-slate-600 w-14 text-center italic">No</th>
          <th className="p-2 font-semibold text-slate-600 w-14 text-center italic">Sí</th>
          <th className="text-left p-2 font-semibold text-slate-600 italic">Parentesco</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, label }) => {
          const row = value.heredofamiliar_sodexo?.[key]
          const isSi = row?.respuesta === 'SI'
          const isNo = row?.respuesta === 'NO'
          return (
            <tr key={key} className="border-t border-slate-100">
              <td className="p-2 text-slate-800 font-medium">{label}</td>
              <td className="p-2 text-center">
                <input
                  type="radio"
                  name={`hf-sodexo-${key}`}
                  disabled={readonly}
                  checked={isNo}
                  onChange={() => patchRow(key, { respuesta: 'NO', parentesco: '' })}
                  className="border-slate-300"
                  aria-label={`${label} — No`}
                />
              </td>
              <td className="p-2 text-center">
                <input
                  type="radio"
                  name={`hf-sodexo-${key}`}
                  disabled={readonly}
                  checked={isSi}
                  onChange={() => patchRow(key, { respuesta: 'SI', parentesco: row?.parentesco ?? '' })}
                  className="border-slate-300"
                  aria-label={`${label} — Sí`}
                />
              </td>
              <td className="p-2">
                <input
                  type="text"
                  disabled={readonly || !isSi}
                  value={row?.parentesco ?? ''}
                  onChange={(e) => patchRow(key, { parentesco: e.target.value })}
                  placeholder={isSi ? 'Ej. padre, hermana…' : '—'}
                  className="w-full border border-slate-200 rounded p-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {renderColumn(SODEXO_HEREDOFAMILIAR_LEFT)}
      {renderColumn(SODEXO_HEREDOFAMILIAR_RIGHT)}
    </div>
  )
}

function PatologicosSodexoColumn({
  column,
  groups,
  value,
  onChange,
  readonly,
}: {
  column: 'left' | 'right'
  groups: readonly string[]
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const rows = sodexoPatologicosCatalogByColumn(column)
  const descHeader =
    rows.find((r) => r.descHeader)?.descHeader ?? 'Describir'

  const patchRow = (key: string, patch: { estado?: 'NEGADO' | 'SI' | null; descripcion?: string }) => {
    const map = { ...(value.patologicos_sodexo ?? {}) }
    const prev = map[key] ?? {}
    const next = { ...prev, ...patch }
    if (!next.estado && !next.descripcion?.trim()) delete map[key]
    else map[key] = next
    onChange({
      ...value,
      patologicos_sodexo: Object.keys(map).length ? map : null,
    })
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const groupRows = rows.filter((r) => r.group === group)
        if (groupRows.length === 0) return null
        return (
          <div key={group} className="border border-slate-200 rounded-lg overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 px-2 py-1 border-b border-slate-100">
              {group}
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  <th className="text-left p-1.5 font-semibold text-slate-600 italic">Patología</th>
                  <th className="p-1.5 w-10 text-center font-semibold text-slate-600 italic">Niega</th>
                  <th className="p-1.5 w-10 text-center font-semibold text-slate-600 italic">Sí</th>
                  <th className="text-left p-1.5 font-semibold text-slate-600 italic">{descHeader}</th>
                </tr>
              </thead>
              <tbody>
                {groupRows.map((entry) => {
                  const row = value.patologicos_sodexo?.[entry.key]
                  const isSi = row?.estado === 'SI'
                  const isNeg = row?.estado === 'NEGADO'
                  return (
                    <tr key={entry.key} className="border-t border-slate-50">
                      <td className="p-1.5 text-slate-800">{entry.label}</td>
                      <td className="p-1.5 text-center">
                        <input
                          type="radio"
                          name={`pat-sodexo-${entry.key}`}
                          disabled={readonly}
                          checked={isNeg}
                          onChange={() => patchRow(entry.key, { estado: 'NEGADO', descripcion: '' })}
                          aria-label={`${entry.label} — Niega`}
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <input
                          type="radio"
                          name={`pat-sodexo-${entry.key}`}
                          disabled={readonly}
                          checked={isSi}
                          onChange={() =>
                            patchRow(entry.key, { estado: 'SI', descripcion: row?.descripcion ?? '' })
                          }
                          aria-label={`${entry.label} — Sí`}
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          disabled={readonly || !isSi}
                          value={row?.descripcion ?? ''}
                          onChange={(e) => patchRow(entry.key, { descripcion: e.target.value })}
                          placeholder={isSi ? 'Detalle…' : '—'}
                          className="w-full border border-slate-200 rounded p-1 disabled:bg-slate-50 text-[11px]"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
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
    <div className="grid gap-4 lg:grid-cols-2">
      <PatologicosSodexoColumn
        column="left"
        groups={SODEXO_PATOLOGICOS_GROUPS_LEFT}
        value={value}
        onChange={onChange}
        readonly={readonly}
      />
      <PatologicosSodexoColumn
        column="right"
        groups={SODEXO_PATOLOGICOS_GROUPS_RIGHT}
        value={value}
        onChange={onChange}
        readonly={readonly}
      />
    </div>
  )
}

type SodexoEfExtensionRow = NonNullable<
  NonNullable<SodexoExtensionData['examen_fisico_sodexo']>[string]
>

const SODEXO_VISIOMETRIA_CASILLAS: {
  key: keyof NonNullable<SodexoExtensionData['visiometria_casillas']>
  label: string
}[] = [
  { key: 'lejana_od_sin_correccion', label: 'Lejana OD sin corrección' },
  { key: 'lejana_oi_sin_correccion', label: 'Lejana OI sin corrección' },
  { key: 'lejana_od_con_correccion', label: 'Lejana OD con corrección' },
  { key: 'lejana_oi_con_correccion', label: 'Lejana OI con corrección' },
  { key: 'cercana_od_sin_correccion', label: 'Cercana OD sin corrección' },
  { key: 'cercana_oi_sin_correccion', label: 'Cercana OI sin corrección' },
]

function SodexoExamenEncabezadoCapture({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  const patchEnc = (p: Partial<NonNullable<SodexoExtensionData['examen_encabezado']>>) => {
    const next = { ...(value.examen_encabezado ?? {}), ...p }
    const empty =
      !next.estado_general_normal && !next.estado_mental_normal && !next.mano_dominante
    onChange({ ...value, examen_encabezado: empty ? null : next })
  }
  return (
    <div className="flex flex-wrap gap-4 items-center px-1 pb-3 mb-1 border-b border-slate-100 text-xs">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={readonly}
          checked={Boolean(value.examen_encabezado?.estado_general_normal)}
          onChange={(e) => patchEnc({ estado_general_normal: e.target.checked })}
        />
        Estado general normal
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={readonly}
          checked={Boolean(value.examen_encabezado?.estado_mental_normal)}
          onChange={(e) => patchEnc({ estado_mental_normal: e.target.checked })}
        />
        Estado mental normal
      </label>
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">Mano dominante</label>
        <select
          disabled={readonly}
          value={value.examen_encabezado?.mano_dominante ?? ''}
          onChange={(e) =>
            patchEnc({ mano_dominante: (e.target.value || null) as ManoDominante | null })
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
  )
}

function SodexoVisiometriaCasillasCapture({
  value,
  onChange,
  readonly,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
}) {
  return (
    <div className="border border-slate-100 rounded-md overflow-hidden">
      <p className="text-[11px] font-semibold text-slate-600 bg-slate-50 px-2 py-1 border-b border-slate-100">
        Visiometría (casillas)
      </p>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left p-1.5 font-semibold text-slate-600">Medición</th>
            <th className="text-center p-1.5 font-semibold text-slate-600 w-20">Marcar</th>
          </tr>
        </thead>
        <tbody>
          {SODEXO_VISIOMETRIA_CASILLAS.map(({ key, label }) => (
            <tr key={key} className="border-t border-slate-50">
              <td className="p-1.5 text-slate-800">{label}</td>
              <td className="p-1.5 text-center">
                <input
                  type="checkbox"
                  disabled={readonly}
                  checked={Boolean(value.visiometria_casillas?.[key])}
                  onChange={(e) => {
                    const next = { ...(value.visiometria_casillas ?? {}), [key]: e.target.checked }
                    const any = Object.values(next).some(Boolean)
                    onChange({ ...value, visiometria_casillas: any ? next : null })
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Sodexo91OrganCell({
  organCell,
}: {
  organCell?: { label: string; rowSpan: number }
}) {
  if (!organCell) return null
  return (
    <td
      rowSpan={organCell.rowSpan}
      className="p-2 font-semibold text-slate-800 align-top border-r border-slate-100 bg-slate-50/80"
    >
      {organCell.label}
    </td>
  )
}

function ExamenFisicoSodexoRow({
  entry,
  row,
  readonly,
  onPatch,
  organCell,
}: {
  entry: SodexoEfCatalogEntry
  row?: SodexoEfExtensionRow
  readonly?: boolean
  onPatch: (patch: Partial<SodexoEfExtensionRow>) => void
  organCell?: { label: string; rowSpan: number }
}) {
  if (entry.kind === 'check_solo') {
    const marked = row?.resultado === 'NORMAL'
    return (
      <tr className="border-t border-slate-50">
        <Sodexo91OrganCell organCell={organCell} />
        <td className="p-1.5 text-slate-800">{entry.label}</td>
        <td className="p-1.5 text-center" colSpan={3}>
          <label className="inline-flex items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              disabled={readonly}
              checked={marked}
              onChange={(e) => onPatch({ resultado: e.target.checked ? 'NORMAL' : null })}
            />
            Marcar
          </label>
        </td>
      </tr>
    )
  }
  if (entry.kind === 'texto') {
    return (
      <tr className="border-t border-slate-50">
        <Sodexo91OrganCell organCell={organCell} />
        <td className="p-1.5 text-slate-800" colSpan={4}>
          <span className="font-medium">{entry.label}</span>
          <input
            type="text"
            disabled={readonly}
            value={row?.desc ?? ''}
            onChange={(e) => onPatch({ desc: e.target.value })}
            className="mt-1 w-full border border-slate-200 rounded p-1 text-[11px]"
            placeholder="Describir…"
          />
        </td>
      </tr>
    )
  }
  if (entry.kind === 'signo') {
    const neg = row?.resultado === 'NEG'
    const pos = row?.resultado === 'POS'
    return (
      <tr className="border-t border-slate-50">
        <Sodexo91OrganCell organCell={organCell} />
        <td className="p-1.5 text-slate-800">{entry.label}</td>
        <td className="p-1.5 text-center">
          <input
            type="radio"
            name={`ef-${entry.key}`}
            disabled={readonly}
            checked={neg}
            onChange={() => onPatch({ resultado: 'NEG' })}
            aria-label={`${entry.label} — negativo`}
          />
        </td>
        <td className="p-1.5 text-center">
          <input
            type="radio"
            name={`ef-${entry.key}`}
            disabled={readonly}
            checked={pos}
            onChange={() => onPatch({ resultado: 'POS' })}
            aria-label={`${entry.label} — positivo`}
          />
        </td>
        <td className="p-1.5 text-slate-400 text-[10px]">(−) / (+)</td>
      </tr>
    )
  }
  const isNormal = row?.resultado === 'NORMAL'
  const isAnormal = row?.resultado === 'ANORMAL'
  return (
    <tr className="border-t border-slate-50">
      <Sodexo91OrganCell organCell={organCell} />
      <td className="p-1.5 text-slate-800">{entry.label}</td>
      <td className="p-1.5 text-center">
        <input
          type="radio"
          name={`ef-${entry.key}`}
          disabled={readonly}
          checked={isNormal}
          onChange={() => onPatch({ resultado: 'NORMAL', desc: '' })}
          aria-label={`${entry.label} — normal`}
        />
      </td>
      <td className="p-1.5 text-center">
        <input
          type="radio"
          name={`ef-${entry.key}`}
          disabled={readonly}
          checked={isAnormal}
          onChange={() => onPatch({ resultado: 'ANORMAL', desc: row?.desc ?? '' })}
          aria-label={`${entry.label} — anormal`}
        />
      </td>
      <td className="p-1.5">
        <input
          type="text"
          disabled={readonly || !isAnormal}
          value={row?.desc ?? ''}
          onChange={(e) => onPatch({ desc: e.target.value })}
          placeholder={
            isAnormal
              ? /atrofia|hipertrofia/i.test(entry.label)
                ? '¿Cuál?…'
                : 'Describir…'
              : '—'
          }
          className="w-full border border-slate-200 rounded p-1 disabled:bg-slate-50 text-[11px]"
        />
      </td>
    </tr>
  )
}

function ExamenFisicoSodexoEntriesTable({
  entries,
  map,
  readonly,
  patchRow,
}: {
  entries: SodexoEfCatalogEntry[]
  map: Record<string, SodexoEfExtensionRow>
  readonly?: boolean
  patchRow: (key: string, patch: Partial<SodexoEfExtensionRow>) => void
}) {
  if (entries.length === 0) return null
  const signEntries = entries.filter((e) => e.kind === 'signo')
  const otherEntries = entries.filter((e) => e.kind !== 'signo' && e.kind !== 'check_solo')
  const checkEntries = entries.filter((e) => e.kind === 'check_solo')
  const renderBlock = (block: SodexoEfCatalogEntry[], headerSigno: boolean) => (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-white border-b border-slate-100">
          <th className="text-left p-1.5 font-semibold text-slate-600 italic">Hallazgo</th>
          <th className="p-1.5 w-12 text-center font-semibold text-slate-600 italic">
            {headerSigno ? '(−)' : 'Normal'}
          </th>
          <th className="p-1.5 w-12 text-center font-semibold text-slate-600 italic">
            {headerSigno ? '(+)' : 'Anormal'}
          </th>
          <th className="text-left p-1.5 font-semibold text-slate-600 italic">Describir</th>
        </tr>
      </thead>
      <tbody>
        {block.map((entry) => (
          <ExamenFisicoSodexoRow
            key={entry.key}
            entry={entry}
            row={map[entry.key]}
            readonly={readonly}
            onPatch={(p) => patchRow(entry.key, p)}
          />
        ))}
      </tbody>
    </table>
  )
  return (
    <div className="space-y-2">
      {signEntries.length > 0 ? renderBlock(signEntries, true) : null}
      {otherEntries.length > 0 ? renderBlock(otherEntries, false) : null}
      {checkEntries.length > 0 ? renderBlock(checkEntries, false) : null}
    </div>
  )
}

function ExamenFisicoSodexo91OrganBlock({
  organ,
  entries,
  map,
  readonly,
  patchRow,
}: {
  organ: string
  entries: SodexoEfCatalogEntry[]
  map: Record<string, SodexoEfExtensionRow>
  readonly?: boolean
  patchRow: (key: string, patch: Partial<SodexoEfExtensionRow>) => void
}) {
  const orofaringeExtra = organ === 'Orofaringe' && SODEXO_91_OROFARINGE_SIN_ACROFORM
  const rowSpan = entries.length + (orofaringeExtra ? 1 : 0)
  if (rowSpan === 0) return null

  return (
    <table className="w-full text-xs border border-slate-200 rounded-md overflow-hidden">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className="text-left p-1.5 font-semibold text-slate-600 italic w-[22%]">Órgano</th>
          <th className="text-left p-1.5 font-semibold text-slate-600 italic">Hallazgo</th>
          <th className="p-1.5 w-12 text-center font-semibold text-slate-600 italic">Normal</th>
          <th className="p-1.5 w-12 text-center font-semibold text-slate-600 italic">Anormal</th>
          <th className="text-left p-1.5 font-semibold text-slate-600 italic">Describir</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => {
          const organCell =
            i === 0 ? { label: organ, rowSpan } : undefined
          return (
            <ExamenFisicoSodexoRow
              key={entry.key}
              entry={entry}
              row={map[entry.key]}
              readonly={readonly}
              onPatch={(p) => patchRow(entry.key, p)}
              organCell={organCell}
            />
          )
        })}
        {orofaringeExtra ? (
          <tr className="border-t border-slate-50">
            <td className="p-1.5 text-slate-800">Orofaringe</td>
            <td className="p-1.5 text-[10px] text-slate-400 italic" colSpan={3}>
              Sin casilla en PDF
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  )
}

function ExamenFisicoSodexo91Section({
  patientSexo,
  map,
  readonly,
  patchRow,
}: {
  patientSexo?: string | null
  map: Record<string, SodexoEfExtensionRow>
  readonly?: boolean
  patchRow: (key: string, patch: Partial<SodexoEfExtensionRow>) => void
}) {
  const entriesForOrgan = (organ: string) =>
    sodexoExamenFisicoCatalogBySection('9.1')
      .filter((e) => e.group === organ)
      .filter((e) => sodexoEfEntryVisibleForSex(e, patientSexo))

  const column = (organs: string[]) => (
    <div className="space-y-3 min-w-0">
      {organs.map((organ) => (
        <ExamenFisicoSodexo91OrganBlock
          key={organ}
          organ={organ}
          entries={entriesForOrgan(organ)}
          map={map}
          readonly={readonly}
          patchRow={patchRow}
        />
      ))}
    </div>
  )

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {column([...SODEXO_EXAMEN_FISICO_91_COLUMN_LEFT])}
      {column([...SODEXO_EXAMEN_FISICO_91_COLUMN_RIGHT])}
    </div>
  )
}

function ExamenFisicoOsteoLimbSection({
  title,
  arcosDef,
  catalogEntries,
  arcosValue,
  onArcosChange,
  map,
  readonly,
  patchRow,
}: {
  title: string
  arcosDef: typeof SODEXO_ARCOS_MS
  catalogEntries: SodexoEfCatalogEntry[]
  arcosValue: SodexoExtensionData['examen_fisico_arcos_sodexo']
  onArcosChange: (next: SodexoExtensionData['examen_fisico_arcos_sodexo']) => void
  map: Record<string, SodexoEfExtensionRow>
  readonly?: boolean
  patchRow: (key: string, patch: Partial<SodexoEfExtensionRow>) => void
}) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <p className="text-[11px] font-bold text-slate-800 bg-slate-100 px-3 py-2 border-b border-slate-200">
        {title}
      </p>
      <div className="p-2 space-y-3">
        <SodexoArcosMovimientoGrid
          def={arcosDef}
          value={arcosValue}
          readonly={readonly}
          onChange={onArcosChange}
        />
        <ExamenFisicoSodexoEntriesTable
          entries={catalogEntries}
          map={map}
          readonly={readonly}
          patchRow={patchRow}
        />
      </div>
    </div>
  )
}

function ExamenFisicoSodexoTable({
  value,
  onChange,
  readonly,
  patientSexo,
}: {
  value: SodexoExtensionData
  onChange: (next: SodexoExtensionData) => void
  readonly?: boolean
  patientSexo: string
}) {
  const map = value.examen_fisico_sodexo ?? {}

  useEffect(() => {
    if (readonly || !value.examen_fisico_sodexo) return
    const cleaned = { ...value.examen_fisico_sodexo }
    let touched = false
    if (cleaned['93_ruidos'] && !cleaned['93_auscultacion']) {
      cleaned['93_auscultacion'] = cleaned['93_ruidos']
      delete cleaned['93_ruidos']
      touched = true
    }
    for (const legacy of [
      '95_hombro_d',
      '95_hombro_i',
      '95_codo_d',
      '95_codo_i',
      '95_muneca_d',
      '95_muneca_i',
      '95_dedos_d',
      '95_dedos_i',
      '96_curva_cervical',
      '96_curva_dorsal',
      '96_curva_lumbar',
      '96_escoliosis',
      '96_cifosis',
      '96_lordosis',
      '96_arco_cervical',
      '96_arco_dorsal',
      '96_arco_lumbar',
      '96_dolor',
      '96_espasmo',
      '96_observaciones',
    ]) {
      if (legacy in cleaned) {
        delete cleaned[legacy]
        touched = true
      }
    }
    for (const key of Object.keys(cleaned)) {
      const entry = SODEXO_EXAMEN_FISICO_CATALOG.find((e) => e.key === key)
      if (entry && !sodexoEfEntryVisibleForSex(entry, patientSexo)) {
        delete cleaned[key]
        touched = true
      }
    }
    if (!touched) return
    onChange({
      ...value,
      examen_fisico_sodexo: examenFisicoSodexoIsEmpty(cleaned) ? null : cleaned,
    })
  }, [patientSexo, readonly, onChange, value])

  const patchRow = (key: string, patch: Partial<SodexoEfExtensionRow>) => {
    const prev = map[key] ?? {}
    const next: SodexoEfExtensionRow = { ...prev, ...patch }
    const cleaned = { ...map }
    const empty =
      !next.resultado && !(next.desc ?? '').trim()
    if (empty) delete cleaned[key]
    else cleaned[key] = next
    onChange({
      ...value,
      examen_fisico_sodexo: examenFisicoSodexoIsEmpty(cleaned) ? null : cleaned,
    })
  }

  return (
    <div className="space-y-6">
      <SodexoExamenEncabezadoCapture value={value} onChange={onChange} readonly={readonly} />
      {SODEXO_EXAMEN_FISICO_SECTIONS.map((sec) => {
        const sectionVisible = sodexoExamenFisicoCatalogBySection(sec.id).filter((e) =>
          sodexoEfEntryVisibleForSex(e, patientSexo),
        )
        if (sectionVisible.length === 0 && sec.id !== '9.6') return null
        const genitoSexHint =
          sec.id === '9.4' && !isSodexoMalePatient(patientSexo) && !isSodexoFemalePatient(patientSexo)
        return (
        <div key={sec.id} className="border border-slate-200 rounded-lg overflow-hidden">
          <p className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-2 border-b border-slate-200">
            {sec.id} {sec.title}
          </p>
          {genitoSexHint ? (
            <p className="text-[10px] text-amber-800 bg-amber-50 px-3 py-1.5 border-b border-amber-100">
              Captura el sexo del paciente en Examen Médico → Antecedentes (bloque Sexo) para mostrar Testículos o Mujer; TR y anamnesis aplican a todos.
            </p>
          ) : null}
          <div className="p-2 space-y-3">
            {sec.id === '9.5' ? (
              <>
                <ExamenFisicoOsteoLimbSection
                  title="Miembros superiores"
                  arcosDef={SODEXO_ARCOS_MS}
                  catalogEntries={sodexoExamenFisicoCatalogBySection('9.5')
                    .filter((e) => e.group === 'Miembros superiores')
                    .filter((e) => sodexoEfEntryVisibleForSex(e, patientSexo))}
                  arcosValue={value.examen_fisico_arcos_sodexo}
                  onArcosChange={(next) =>
                    onChange({ ...value, examen_fisico_arcos_sodexo: next })
                  }
                  map={map}
                  readonly={readonly}
                  patchRow={patchRow}
                />
                <ExamenFisicoOsteoLimbSection
                  title="Miembros inferiores"
                  arcosDef={SODEXO_ARCOS_MI}
                  catalogEntries={sodexoExamenFisicoCatalogBySection('9.5')
                    .filter((e) => e.group === 'Miembros inferiores')
                    .filter((e) => sodexoEfEntryVisibleForSex(e, patientSexo))}
                  arcosValue={value.examen_fisico_arcos_sodexo}
                  onArcosChange={(next) =>
                    onChange({ ...value, examen_fisico_arcos_sodexo: next })
                  }
                  map={map}
                  readonly={readonly}
                  patchRow={patchRow}
                />
                {(() => {
                  const lesiones = sodexoExamenFisicoCatalogBySection('9.5').filter(
                    (e) => e.group === 'Lesiones repetitivas',
                  )
                  if (lesiones.length === 0) return null
                  return (
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <p className="text-[11px] font-bold text-slate-800 bg-slate-100 px-3 py-2 border-b border-slate-200">
                        Lesiones repetitivas
                      </p>
                      <div className="p-2">
                        <ExamenFisicoSodexoEntriesTable
                          entries={lesiones}
                          map={map}
                          readonly={readonly}
                          patchRow={patchRow}
                        />
                      </div>
                    </div>
                  )
                })()}
              </>
            ) : sec.id === '9.6' ? (
              <SodexoColumnaVertebralSection
                value={value.examen_fisico_columna_sodexo}
                readonly={readonly}
                onChange={(next) =>
                  onChange({ ...value, examen_fisico_columna_sodexo: next })
                }
              />
            ) : sec.id === '9.1' ? (
              <>
                <ExamenFisicoSodexo91Section
                  patientSexo={patientSexo}
                  map={map}
                  readonly={readonly}
                  patchRow={patchRow}
                />
                <SodexoVisiometriaCasillasCapture
                  value={value}
                  onChange={onChange}
                  readonly={readonly}
                />
              </>
            ) : (
              <>
                {sec.groups.map((group) => {
                  const entries = sodexoExamenFisicoCatalogBySection(sec.id)
                    .filter((e) => e.group === group)
                    .filter((e) => sodexoEfEntryVisibleForSex(e, patientSexo))
                  if (entries.length === 0) return null
                  const showGroupTitle =
                    sec.id === '9.1' || (sec.groups.length > 1 && group !== sec.title)
                  return (
                    <div key={group} className="border border-slate-100 rounded-md overflow-hidden">
                      {showGroupTitle ? (
                        <p
                          className={
                            sec.id === '9.1'
                              ? 'text-[11px] font-bold text-slate-800 bg-slate-100 px-3 py-2 border-b border-slate-200'
                              : 'text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 px-2 py-1 border-b border-slate-100'
                          }
                        >
                          {group}
                        </p>
                      ) : null}
                      <div className="p-1">
                        <ExamenFisicoSodexoEntriesTable
                          entries={entries}
                          map={map}
                          readonly={readonly}
                          patchRow={patchRow}
                        />
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
        )
      })}
    </div>
  )
}

function EstilosVidaSodexoTable({
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
    const next = { ...ev, ...p }
    onChange({
      ...value,
      estilos_vida_sodexo: estilosVidaSodexoIsEmpty(next) ? null : next,
    })
  }

  const tabacoOpciones = [
    { v: 'NO', label: 'No' },
    { v: 'SI', label: 'Sí' },
    { v: 'EVENTUAL', label: 'Eventual a <5' },
    { v: 'HABITUAL', label: 'Habitual (6–10)' },
    { v: 'COMPULSIVO', label: 'Compulsivo (11 o más)' },
  ] as const

  return (
    <div className="space-y-4 text-xs">
      <div className="border border-slate-200 rounded-lg p-3 space-y-3">
        <p className="text-[10px] font-bold uppercase text-slate-600">8.1 Tabaquismo</p>
        <div className="flex flex-wrap gap-3">
          {tabacoOpciones.map(({ v, label }) => (
            <label key={v} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="ev-tabaco-opcion"
                disabled={readonly}
                checked={ev.tabaco_opcion === v}
                onChange={() => patch({ tabaco_opcion: v })}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 mb-1">Años de hábito</p>
            <div className="flex flex-wrap gap-2">
              {(['1_5', '6_10', '11_20', 'MAS_20'] as const).map((k) => (
                <label key={k} className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="ev-tabaco-anios"
                    disabled={readonly}
                    checked={(ev.tabaco_anios_habito ?? ev.tabaco_anios) === k}
                    onChange={() => patch({ tabaco_anios_habito: k, tabaco_anios: k })}
                  />
                  {k === 'MAS_20' ? '>20' : k.replace('_', '–')}
                </label>
              ))}
            </div>
          </div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              disabled={readonly}
              checked={Boolean(ev.tabaco_exfumador)}
              onChange={(e) => patch({ tabaco_exfumador: e.target.checked })}
            />
            Exfumador
          </label>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 mb-1">Dejó de fumar (hace)</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['MENOS_1', '<1 año'],
                  ['1_5', '1–5'],
                  ['6_10', '6–10'],
                  ['MAS_10', '>10 años'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="ev-tabaco-dejo"
                    disabled={readonly}
                    checked={ev.tabaco_dejo_hace === k}
                    onChange={() => patch({ tabaco_dejo_hace: k })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-slate-200 rounded-lg p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase text-slate-600">8.2 Licor</p>
          <div className="flex gap-4">
            {(['NO', 'SI'] as const).map((v) => (
              <label key={v} className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="ev-alcohol"
                  disabled={readonly}
                  checked={ev.alcohol === v}
                  onChange={() => patch({ alcohol: v })}
                />
                {v === 'NO' ? 'No' : 'Sí'}
              </label>
            ))}
          </div>
          <input
            disabled={readonly || ev.alcohol !== 'SI'}
            placeholder="Ocasional (detalle)"
            value={ev.alcohol_ocasional ?? ''}
            onChange={(e) => patch({ alcohol_ocasional: e.target.value, alcohol_modo: 'OCASIONAL' })}
            className="w-full border border-slate-200 rounded p-2 text-sm disabled:bg-slate-50"
          />
        </div>
        <div className="border border-slate-200 rounded-lg p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase text-slate-600">8.3 Drogadicción</p>
          <div className="flex gap-4">
            {(['NO', 'SI'] as const).map((v) => (
              <label key={v} className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="ev-drogas"
                  disabled={readonly}
                  checked={ev.drogas === v}
                  onChange={() => patch({ drogas: v })}
                />
                {v === 'NO' ? 'No' : 'Sí'}
              </label>
            ))}
          </div>
          <input
            disabled={readonly || ev.drogas !== 'SI'}
            placeholder="Tipo de droga"
            value={ev.drogas_tipo ?? ''}
            onChange={(e) => patch({ drogas_tipo: e.target.value })}
            className="w-full border border-slate-200 rounded p-2 text-sm disabled:bg-slate-50"
          />
        </div>
      </div>
    </div>
  )
}

function HoExamenChecks({
  row,
  readonly,
  onPatch,
}: {
  row: SodexoHoFila
  readonly?: boolean
  onPatch: (patch: Partial<SodexoHoFila>) => void
}) {
  const items = [
    { key: 'examen_ingreso' as const, label: 'Ing.' },
    { key: 'examen_periodico' as const, label: 'Peri.' },
    { key: 'examen_retiro' as const, label: 'Ret.' },
    { key: 'examen_no' as const, label: 'No' },
  ]
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {items.map(({ key, label }) => (
        <label key={key} className="inline-flex items-center gap-1 text-[10px] text-slate-600">
          <input
            type="checkbox"
            disabled={readonly}
            checked={Boolean(row[key])}
            onChange={(e) => onPatch({ [key]: e.target.checked })}
            className="rounded border-slate-300"
          />
          {label}
        </label>
      ))}
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
  const ui = hoTableForUi(value)

  const patchHistorico = (index: number, patch: Partial<SodexoHoFila>) => {
    const historico = ui.historico.map((r, i) => (i === index ? { ...r, ...patch, es_actual: false } : r))
    onChange(commitHoTable(value, { ...ui, historico }))
  }

  const patchActual = (patch: Partial<SodexoHoFila>) => {
    onChange(commitHoTable(value, { ...ui, actual: { ...ui.actual, ...patch, es_actual: true } }))
  }

  const addHistorico = () => {
    if (ui.historico.length >= 5) return
    onChange(commitHoTable(value, { ...ui, historico: [...ui.historico, { ...HO_EMPTY_ROW }] }))
  }

  const removeHistorico = (index: number) => {
    if (ui.historico.length <= 1) return
    onChange(
      commitHoTable(value, {
        ...ui,
        historico: ui.historico.filter((_, i) => i !== index),
      }),
    )
  }

  const renderRow = (
    rowLabel: string,
    row: SodexoHoFila,
    onPatch: (patch: Partial<SodexoHoFila>) => void,
    onRemove?: () => void,
  ) => (
    <tr className="border-t border-slate-100 align-top">
      <td className="p-2 font-semibold text-slate-500 whitespace-nowrap">{rowLabel}</td>
      <td className="p-2">
        <input
          disabled={readonly}
          placeholder="Empresa / área"
          value={row.empresa_area ?? row.empresa ?? ''}
          onChange={(e) => onPatch({ empresa_area: e.target.value, empresa: e.target.value })}
          className="w-full min-w-[8rem] border border-slate-200 rounded p-1.5 text-sm"
        />
      </td>
      <td className="p-2">
        <input
          disabled={readonly}
          placeholder="Ocupación / oficio"
          value={row.ocupacion ?? ''}
          onChange={(e) => onPatch({ ocupacion: e.target.value })}
          className="w-full min-w-[8rem] border border-slate-200 rounded p-1.5 text-sm"
        />
      </td>
      <td className="p-2">
        <div className="flex gap-1">
          <input
            disabled={readonly}
            placeholder="Años"
            value={row.anios ?? ''}
            onChange={(e) => onPatch({ anios: e.target.value })}
            className="w-14 border border-slate-200 rounded p-1.5 text-sm"
          />
          <input
            disabled={readonly}
            placeholder="Meses"
            value={row.meses ?? ''}
            onChange={(e) => onPatch({ meses: e.target.value })}
            className="w-14 border border-slate-200 rounded p-1.5 text-sm"
          />
        </div>
      </td>
      <td className="p-2">
        <HoExamenChecks row={row} readonly={readonly} onPatch={onPatch} />
      </td>
      <td className="p-2">
        <NegadoSiRadios
          name={`ho-rt-${rowLabel}`}
          value={row.rt}
          readonly={readonly}
          onChange={(v) => onPatch({ rt: v })}
        />
        <p className="text-[9px] text-slate-400 text-center mt-0.5">RT*</p>
      </td>
      <td className="p-2">
        <NegadoSiRadios
          name={`ho-sec-${rowLabel}`}
          value={row.secuelas}
          readonly={readonly}
          onChange={(v) => onPatch({ secuelas: v })}
        />
      </td>
      <td className="p-2">
        <NegadoSiRadios
          name={`ho-ind-${rowLabel}`}
          value={row.indemnizado}
          readonly={readonly}
          onChange={(v) => onPatch({ indemnizado: v })}
        />
        <input
          disabled={readonly}
          placeholder="Fecha"
          value={row.indemnizado_fecha ?? ''}
          onChange={(e) => onPatch({ indemnizado_fecha: e.target.value })}
          className="mt-1 w-full border border-slate-200 rounded p-1 text-[10px]"
        />
      </td>
      <td className="p-2 text-center">
        {onRemove && !readonly ? (
          <button type="button" onClick={onRemove} className="text-[10px] text-red-600 hover:underline">
            Quitar
          </button>
        ) : null}
      </td>
    </tr>
  )

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs border-collapse min-w-[56rem]">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2" />
              <th className="text-left p-2 font-semibold text-slate-600">Empresa / área</th>
              <th className="text-left p-2 font-semibold text-slate-600">Ocupación</th>
              <th className="p-2 font-semibold text-slate-600">Tiempo</th>
              <th className="p-2 font-semibold text-slate-600">Exámenes</th>
              <th className="p-2 font-semibold text-slate-600">RT</th>
              <th className="p-2 font-semibold text-slate-600">Secuelas</th>
              <th className="p-2 font-semibold text-slate-600">Indemnizado</th>
              <th className="p-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {ui.historico.map((row, i) =>
              renderRow(String(i + 1), row, (p) => patchHistorico(i, p), () => removeHistorico(i)),
            )}
            {renderRow('Actual', ui.actual, patchActual)}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-500">
        * RT = Riesgo de trabajo o enfermedad de trabajo calificada.
      </p>
      {!readonly && ui.historico.length < 5 ? (
        <button
          type="button"
          onClick={addHistorico}
          className="text-sm font-semibold text-emerald-800 hover:text-emerald-900"
        >
          + Agregar empleo histórico ({ui.historico.length}/5)
        </button>
      ) : null}
      <label className="block text-xs font-bold text-slate-500 mb-1">
        Accidentes, lesiones y/o secuelas
      </label>
      <textarea
        disabled={readonly}
        rows={3}
        value={value.historia_ocupacional_accidentes ?? ''}
        onChange={(e) => onChange({ ...value, historia_ocupacional_accidentes: e.target.value })}
        className="w-full border border-slate-200 rounded-lg p-2 text-sm"
        placeholder="Describir tipo de accidente, lesiones y/o secuelas…"
      />
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
