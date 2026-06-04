/**
 * @fileoverview Renderer clínico general configurable por tipo de estudio.
 * Reemplaza la lista azul vertical genérica (ExtractedDataRows) por secciones
 * estructuradas y tabla real de parámetros, legibles para médico.
 * @id IMPL-20260518-13
 * @backup context/checkpoints/CHK_IMPL-20260518-13-RENDERER-CLINICO.md
 * @extends IMPL-20260518-14 — Audiometría (BilateralFrequencyTableBlock)
 * @backup context/checkpoints/CHK_IMPL-20260518-14-RENDERER-CLINICO-AUDIOMETRIA.md
 * @intervention IMPL-20260604-01
 * @backup context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md
 */
"use client"

import type { StudyPresentationSchema as PersistedStudyPresentationSchema } from "@/types/calibration"
import {
  getStudySchema,
  type KeyValueSection,
  type TableSection,
  type BadgesSection,
  type NoteSection,
  type BilateralFrequencyTableSection,
  type ClinicalPresentationSection,
} from "./extraction-presentation-schemas"

// --- Helpers de formato ---

function fmtValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Sí" : "No"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value.trim() || "—"
  if (Array.isArray(value)) return value.map(fmtValue).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function fmtLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function getValueAtPath(data: Record<string, unknown>, path?: string): unknown {
  if (!path) return data

  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined
    return (current as Record<string, unknown>)[segment]
  }, data)
}

// --- Resolución de fuente de datos ---

function resolveSource(
  data: Record<string, unknown>,
  sourceKey?: string
): Record<string, unknown> {
  if (!sourceKey) return data
  const sub = getValueAtPath(data, sourceKey)
  if (sub && typeof sub === "object" && !Array.isArray(sub)) {
    return sub as Record<string, unknown>
  }
  // Fallback: buscar en raíz si la ruta no existe como sub-objeto
  return data
}

function hasRenderableValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ""
}

/**
 * Normaliza el payload de Audiometría soportando dos formas históricas:
 * - v2 (nueva): oido_X.via_aerea, oido_X.via_osea, notas_calidad como string[]
 * - v1 (antigua): oido_X.va, oido_X.vo, notas_calidad.descripcion
 * Produce siempre la forma v1 (canónica) que el schema de presentación conoce.
 * Sin efecto sobre claves ya presentes: snapshots v1 pasan intactos.
 * @id IMPL-20260519-03
 */
function normalizeAudiometriaData(data: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...data }

  // Normalizar oídos: via_aerea → va, via_osea → vo (solo si la alias destino no existe)
  for (const earKey of ["oido_derecho", "oido_izquierdo"]) {
    const ear = normalized[earKey]
    if (ear && typeof ear === "object" && !Array.isArray(ear)) {
      const earObj = ear as Record<string, unknown>
      const earNorm: Record<string, unknown> = { ...earObj }
      if (!("va" in earNorm) && "via_aerea" in earNorm) earNorm.va = earNorm.via_aerea
      if (!("vo" in earNorm) && "via_osea" in earNorm) earNorm.vo = earNorm.via_osea
      // IMPL-20260519-04 — normalizar pta → pta_visible
      if (!("pta_visible" in earNorm) && "pta" in earNorm) earNorm.pta_visible = earNorm.pta
      normalized[earKey] = earNorm
    }
  }

  // IMPL-20260519-04 — normalizar notas_calidad: string plano, string[] o estructura ya correcta
  if (typeof normalized.notas_calidad === "string") {
    normalized.notas_calidad = { descripcion: normalized.notas_calidad }
  } else if (Array.isArray(normalized.notas_calidad)) {
    normalized.notas_calidad = {
      descripcion: (normalized.notas_calidad as unknown[]).map(String).join("; "),
    }
  }

  return normalized
}

function buildAudiometriaSummary(data: Record<string, unknown>): Record<string, unknown> {
  const right = resolveSource(data, "oido_derecho")
  const left = resolveSource(data, "oido_izquierdo")

  return {
    pta_d: right.pta_d,
    pta_i: left.pta_i,
  }
}

// --- Bloque keyValue ---

function KeyValueBlock({
  section,
  data,
}: {
  section: KeyValueSection
  data: Record<string, unknown>
}) {
  const source = resolveSource(data, section.sourceKey)
  const entries = section.fields
    .map((f) => ({ key: f, value: source[f] }))
    .filter((e) => hasRenderableValue(e.value))

  if (entries.length === 0) return null

  return (
    <div>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        {section.title}
      </h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {entries.map(({ key, value }) => (
          <div key={key} className="contents">
            <dt className="text-xs text-slate-500 truncate">{fmtLabel(key)}</dt>
            <dd className="text-xs font-medium text-slate-800 text-right break-words">
              {fmtValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// --- Bloque tabla ---

function TableBlock({
  section,
  data,
}: {
  section: TableSection
  data: Record<string, unknown>
}) {
  const rows = getValueAtPath(data, section.source)
  if (!Array.isArray(rows) || rows.length === 0) return null

  // Solo mostrar columnas que tienen al menos un valor no vacío en alguna fila
  const activeColumns = section.columns.filter((col) =>
    rows.some((row) => {
      if (row && typeof row === "object") {
        const val = (row as Record<string, unknown>)[col.key]
        return hasRenderableValue(val)
      }
      return false
    })
  )

  if (activeColumns.length === 0) return null

  return (
    <div>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        {section.title}
      </h4>
      {/* overflow-x-auto para scroll horizontal controlado en móvil */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
              >
                {activeColumns.map((col) => {
                  const val =
                    row && typeof row === "object"
                      ? (row as Record<string, unknown>)[col.key]
                      : undefined
                  return (
                    <td
                      key={col.key}
                      className="px-3 py-1.5 text-slate-700 whitespace-nowrap"
                    >
                      {fmtValue(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Bloque badges ---

function BadgesBlock({
  section,
  data,
}: {
  section: BadgesSection
  data: Record<string, unknown>
}) {
  const source = resolveSource(data, section.sourceKey)
  const entries = section.fields
    .map((f) => ({ key: f, value: source[f] }))
    .filter((e) => hasRenderableValue(e.value))

  if (entries.length === 0) return null

  return (
    <div>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        {section.title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {entries.map(({ key, value }) => (
          <span
            key={key}
            className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200"
          >
            <span className="text-slate-500">{fmtLabel(key)}: </span>
            <span className="font-medium">{fmtValue(value)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// --- Bloque note ---

// --- Bloque nota ---

function NoteBlock({
  section,
  data,
}: {
  section: NoteSection
  data: Record<string, unknown>
}) {
  const value = getValueAtPath(data, section.source)
  if (!value) return null

  return (
    <div>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {section.title}
      </h4>
      <p className="text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
        {fmtValue(value)}
      </p>
    </div>
  )
}

/**
 * Bloque tabla comparativa bilateral por frecuencia.
 * Fusiona oido_derecho y oido_izquierdo en una sola tabla.
 * @id IMPL-20260518-14
 */
function BilateralFrequencyTableBlock({
  section,
  data,
}: {
  section: BilateralFrequencyTableSection
  data: Record<string, unknown>
}) {
  const rightRaw = getValueAtPath(data, section.rightKey)
  const leftRaw = getValueAtPath(data, section.leftKey)

  const right: Record<string, unknown> =
    rightRaw && typeof rightRaw === "object" && !Array.isArray(rightRaw)
      ? (rightRaw as Record<string, unknown>)
      : {}
  const left: Record<string, unknown> =
    leftRaw && typeof leftRaw === "object" && !Array.isArray(leftRaw)
      ? (leftRaw as Record<string, unknown>)
      : {}

  const allPossibleFreqs = new Set<number>([
    ...Object.keys(right)
      .map(Number)
      .filter((n) => !isNaN(n)),
    ...Object.keys(left)
      .map(Number)
      .filter((n) => !isNaN(n)),
  ])

  const allFreqNums = new Set<number>(
    [...allPossibleFreqs].filter((freq) => {
      const rightValue = right[String(freq)]
      const leftValue = left[String(freq)]
      return hasRenderableValue(rightValue) || hasRenderableValue(leftValue)
    })
  )

  if (allFreqNums.size === 0) return null

  const preferred = section.preferredOrder ?? []
  const preferredSet = new Set(preferred)
  const extras = [...allFreqNums]
    .filter((f) => !preferredSet.has(f))
    .sort((a, b) => a - b)
  const orderedFreqs = [...preferred.filter((f) => allFreqNums.has(f)), ...extras]

  return (
    <div>
      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        {section.title}
      </h4>
      {/* overflow-x-auto para scroll horizontal controlado en móvil */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200">
                Frecuencia (Hz)
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200">
                Oído derecho
              </th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200">
                Oído izquierdo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orderedFreqs.map((freq, idx) => (
              <tr key={freq} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td className="px-3 py-1.5 font-medium text-slate-700 whitespace-nowrap">
                  {freq}
                </td>
                <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                  {fmtValue(right[String(freq)])}
                </td>
                <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                  {fmtValue(left[String(freq)])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionBlock({
  section,
  data,
}: {
  section: ClinicalPresentationSection
  data: Record<string, unknown>
}) {
  if (section.kind === "keyValue") {
    const effectiveData =
      section.sourceKey === "resumen_oidos" ? buildAudiometriaSummary(data) : data
    return <KeyValueBlock section={section} data={effectiveData} />
  }
  if (section.kind === "table") return <TableBlock section={section} data={data} />
  if (section.kind === "badges") return <BadgesBlock section={section} data={data} />
  if (section.kind === "note") return <NoteBlock section={section} data={data} />
  if (section.kind === "bilateralFrequency") return <BilateralFrequencyTableBlock section={section} data={data} />
  return null
}

// --- Panel de campos faltantes ---

function MissingFieldsPanel({ missingFields }: { missingFields: string[] }) {
  if (missingFields.length === 0) return null
  return (
    <div className="pt-3 border-t border-slate-200">
      <p className="text-xs font-bold text-amber-700 mb-1.5">Campos no encontrados</p>
      <div className="flex flex-wrap gap-1.5">
        {missingFields.map((field, i) => (
          <span
            key={i}
            className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200"
          >
            {fmtLabel(field)}
          </span>
        ))}
      </div>
    </div>
  )
}

// --- Renderer fallback genérico (estudios sin schema configurado) ---
// Conserva la apariencia actual de lista azul para no romper otros estudios.

function GenericFallbackRenderer({
  extractedData,
  missingFields,
  version,
}: {
  extractedData: Record<string, unknown>
  missingFields: string[] | null
  version: number
}) {
  const hasData = Object.keys(extractedData).length > 0
  const hasMissing = Array.isArray(missingFields) && missingFields.length > 0
  if (!hasData && !hasMissing) return null

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sky-600 text-base">📊</span>
          <p className="text-sm font-bold text-sky-800">Valores capturados</p>
        </div>
        <span className="text-[10px] font-mono text-sky-500 bg-sky-100 px-2 py-0.5 rounded">
          v{version}
        </span>
      </div>

      {hasData && (
        <div>
          {Object.entries(extractedData).map(([key, value]) => (
            <div
              key={key}
              className="flex justify-between items-start gap-4 py-1 border-b border-sky-100 last:border-0"
            >
              <span className="text-xs text-slate-500 shrink-0">{fmtLabel(key)}</span>
              <span className="text-xs text-slate-800 font-medium text-right break-all">
                {fmtValue(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {hasMissing && (
        <MissingFieldsPanel missingFields={missingFields!} />
      )}
    </div>
  )
}

// --- Componente principal exportado ---

interface ClinicalExtractionRendererProps {
  extractedData: Record<string, unknown> | null
  missingFields: string[] | null
  version: number
  /** Tipo canónico del estudio — determina qué schema de presentación usar */
  studyType: string | null | undefined
  presentationSchema?: PersistedStudyPresentationSchema | null
}

/**
 * Prioriza el schema persistido de calibración y conserva el fallback legacy.
 * @id IMPL-20260604-01
 * @backup context/SPECs/SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md
 */
function resolvePresentationSchema(
  studyType: string | null | undefined,
  presentationSchema?: PersistedStudyPresentationSchema | null
) {
  if (presentationSchema && Array.isArray(presentationSchema.sections)) {
    return presentationSchema
  }
  return getStudySchema(studyType)
}

export default function ClinicalExtractionRenderer({
  extractedData,
  missingFields,
  version,
  studyType,
  presentationSchema,
}: ClinicalExtractionRendererProps) {
  // Sin datos y sin campos faltantes: nada que renderizar
  if (
    (!extractedData || Object.keys(extractedData).length === 0) &&
    (!missingFields || missingFields.length === 0)
  ) {
    return null
  }

  const schema = resolvePresentationSchema(studyType, presentationSchema)

  // Sin schema configurado para este studyType: usar renderer genérico de fallback
  if (!schema || !extractedData) {
    return (
      <GenericFallbackRenderer
        extractedData={extractedData ?? {}}
        missingFields={missingFields}
        version={version}
      />
    )
  }

  // Normalizar payload antes de renderizar para soportar variantes históricas
  const renderData =
    studyType === "Audiometria"
      ? normalizeAudiometriaData(extractedData)
      : extractedData

  // Verificar si al menos una sección renderiza contenido útil
  // (se hace en el render mismo — SectionBlock retorna null si no hay datos)

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-base">🩺</span>
          <p className="text-sm font-bold text-slate-800">Extracción clínica</p>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {studyType}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          v{version}
        </span>
      </div>

      {/* Secciones */}
      <div className="space-y-4 divide-y divide-slate-100">
        {schema.sections.map((section, idx) => (
          <div key={idx} className={idx > 0 ? "pt-4" : ""}>
            <SectionBlock section={section} data={renderData} />
          </div>
        ))}
      </div>

      {/* Campos no encontrados */}
      {Array.isArray(missingFields) && missingFields.length > 0 && (
        <MissingFieldsPanel missingFields={missingFields} />
      )}
    </div>
  )
}
