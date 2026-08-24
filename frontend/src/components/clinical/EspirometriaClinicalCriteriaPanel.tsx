/**
 * @fileoverview Bloque de criterios clínicos de Espirometría mostrados en Events
 * inmediatamente arriba del panel "Prediagnóstico IA". Sólo presentación: lee
 * los campos ya extraídos del snapshot y los renderiza de forma legible para
 * el médico. NO recalcula, NO reinterpretá, NO clasifica como diagnóstico IA.
 *
 * Fuente de campos: `extractedData.calidad` (payload vigente del extractor
 * Sibelmed W20s, ver `context/lote-nocturno-20260820-01/extraction-espirometria-rd2026.json`).
 *
 * Contrato (FEATURE-20260824-01):
 *   - Pico máximo, Forma triangular, Libre de artefactos, Meseta, Tiempo.
 *   - Repetibilidad FVC < 200, Repetibilidad FEV1 < 200 (booleanos SI/NO).
 *   - #Pruebas aceptables.
 *   - Criterios para Dx.
 *   - Calidad.
 *   - Repetibilidad FVC (ml) y Repetibilidad FEV1 (ml) cuando estén presentes.
 *   - Impresión diagnóstica / Recomendaciones como TEXTO FUENTE del documento
 *     (NO diagnóstico IA) si el payload los expone. Si no están, no se
 *     renderizan y NO se inventan.
 *   - Notas de calidad (texto del extractor) si están presentes.
 *
 * Tolerancia a payload parcial/histórico: cualquier campo ausente se omite
 * sin lanzar excepciones ni mostrar placeholders.
 *
 * @id IMPL-20260824-01
 * @backup context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
 */
import type { CSSProperties, ReactElement } from "react"

export type EspirometriaClinicalCriteria = {
  pico_maximo?: string | null
  forma_triangular?: string | null
  libre_artefactos?: string | null
  meseta?: string | null
  tiempo?: string | null
  repetibilidad_fvc_menor_200?: string | null
  repetibilidad_fev1_menor_200?: string | null
  pruebas_aceptables?: number | string | null
  criterios_para_dx?: string | null
  calidad?: string | null
  repetibilidad_fvc_ml?: number | string | null
  repetibilidad_fev1_ml?: number | string | null
  /** Texto fuente del documento (NO IA). Opcional. */
  impresion_diagnostica_texto?: string | null
  /** Texto fuente del documento (NO IA). Opcional. */
  recomendaciones_texto?: string | null
  /** Notas de calidad del extractor. Puede ser string u objeto. */
  notas_calidad?: string | Record<string, unknown> | null
}

type SiNo = "SI" | "NO" | "SÍ" | "NO "

function normalizeSiNo(value: unknown): "SI" | "NO" | null {
  if (value === null || value === undefined) return null
  const v = String(value).trim().toUpperCase()
  if (!v) return null
  if (v.startsWith("SÍ") || v === "SI" || v === "S") return "SI"
  if (v === "NO" || v === "N") return "NO"
  return null
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isFinite(value)
  return true
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = Number(value.trim())
    if (Number.isFinite(n)) return n
  }
  return null
}

function asNotasCalidadText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value.trim() || null
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    const candidates = [
      obj.descripcion,
      obj.descripción,
      obj.nota,
      obj.texto,
    ]
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim()
    }
    // Fallback: serializar claves visibles sin filtrar
    try {
      return JSON.stringify(obj)
    } catch {
      return null
    }
  }
  return String(value)
}

export interface EspirometriaClinicalCriteriaPanelProps {
  /** Sub-objeto `calidad` del snapshot extraído, o null si no existe. */
  calidad: Record<string, unknown> | null | undefined
  /** Versión del snapshot, opcional, sólo para etiqueta visible. */
  version?: number | null
}

/**
 * Determina si hay al menos un criterio clínico presentable. Útil para que
 * el componente padre decida si debe o no renderizar el bloque. NO renderiza
 * el bloque si el payload está vacío/parcial sin campos útiles.
 */
export function hasRenderableEspirometriaCriteria(
  calidad: Record<string, unknown> | null | undefined
): boolean {
  if (!calidad || typeof calidad !== "object") return false
  // Cualquiera de las claves conocidas implica que el payload tiene criterios
  // del formato clínico. La omisión de un campo individual no rompe nada.
  const knownKeys: (keyof EspirometriaClinicalCriteria)[] = [
    "pico_maximo",
    "forma_triangular",
    "libre_artefactos",
    "meseta",
    "tiempo",
    "repetibilidad_fvc_menor_200",
    "repetibilidad_fev1_menor_200",
    "pruebas_aceptables",
    "criterios_para_dx",
    "calidad",
    "repetibilidad_fvc_ml",
    "repetibilidad_fev1_ml",
    "impresion_diagnostica_texto",
    "recomendaciones_texto",
    "notas_calidad",
  ]
  return knownKeys.some((k) => hasValue(calidad[k]))
}

// --- Helpers de presentación ---

function Badge({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "ok" | "warn" | "neutral"
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-slate-50 text-slate-700 border-slate-200"
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${cls}`}
      data-criteria-key={label}
    >
      <span className="text-slate-500">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}

function SiNoBadge({
  label,
  value,
}: {
  label: string
  value: unknown
}) {
  const normalized = normalizeSiNo(value)
  if (!normalized) return null
  return (
    <Badge
      label={label}
      value={normalized}
      tone={normalized === "SI" ? "ok" : "warn"}
    />
  )
}

function NumberCell({
  label,
  value,
  unit,
}: {
  label: string
  value: unknown
  unit?: string
}) {
  const n = asNumber(value)
  if (n === null) return null
  return (
    <div
      className="flex justify-between items-baseline gap-2 py-1 border-b border-slate-100 last:border-0"
      data-criteria-key={label}
    >
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800 tabular-nums">
        {Number.isInteger(n) ? n.toString() : n.toFixed(2)}
        {unit ? <span className="text-[10px] text-slate-500 ml-1">{unit}</span> : null}
      </span>
    </div>
  )
}

export default function EspirometriaClinicalCriteriaPanel({
  calidad,
  version,
}: EspirometriaClinicalCriteriaPanelProps) {
  if (!calidad || typeof calidad !== "object") return null
  if (!hasRenderableEspirometriaCriteria(calidad)) return null

  const c = calidad as EspirometriaClinicalCriteria

  const calidadText = typeof c.calidad === "string" ? c.calidad.trim() : ""
  const pruebasNum = asNumber(c.pruebas_aceptables)
  const fvcMl = asNumber(c.repetibilidad_fvc_ml)
  const fev1Ml = asNumber(c.repetibilidad_fev1_ml)
  const notasCalidadText = asNotasCalidadText(c.notas_calidad)
  const impresionTexto =
    typeof c.impresion_diagnostica_texto === "string"
      ? c.impresion_diagnostica_texto.trim()
      : ""
  const recomendacionesTexto =
    typeof c.recomendaciones_texto === "string"
      ? c.recomendaciones_texto.trim()
      : ""

  // Sub-bloque A: criterios cualitativos binarios (SI/NO)
  const booleanEntries: Array<{ label: string; value: unknown }> = [
    { label: "Pico máximo", value: c.pico_maximo },
    { label: "Forma triangular", value: c.forma_triangular },
    { label: "Libre de artefactos", value: c.libre_artefactos },
    { label: "Meseta", value: c.meseta },
    { label: "Tiempo", value: c.tiempo },
    { label: "Repetibilidad FVC < 200", value: c.repetibilidad_fvc_menor_200 },
    { label: "Repetibilidad FEV1 < 200", value: c.repetibilidad_fev1_menor_200 },
    { label: "Criterios para Dx", value: c.criterios_para_dx },
  ]
  const booleanBadges = booleanEntries
    .map(({ label, value }) => (
      <SiNoBadge key={label} label={label} value={value} />
    ))
    .filter((node): node is ReactElement => node !== null)

  // Estilo inline mínimo para alinear a Tailwind sin warnings de prod.
  const headerStyle: CSSProperties = { fontSize: "10px" }

  return (
    <div
      className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3"
      data-testid="espirometria-clinical-criteria-panel"
      data-snapshot-version={version ?? undefined}
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sky-600 text-base" aria-hidden="true">🫁</span>
          <p className="text-sm font-bold text-sky-800">
            Criterios clínicos de Espirometría
          </p>
        </div>
        {version != null ? (
          <span
            className="text-[10px] font-mono text-sky-500 bg-sky-100 px-2 py-0.5 rounded"
            style={headerStyle}
          >
            v{version}
          </span>
        ) : null}
      </div>

      {/* Subtítulo */}
      <p className="text-[11px] text-sky-700 italic">
        Criterios extraídos del documento fuente. No sustituyen el criterio médico.
      </p>

      {/* Bloque A: criterios binarios como badges */}
      {booleanBadges.length > 0 ? (
        <div className="flex flex-wrap gap-2" data-criteria-group="boolean">
          {booleanBadges}
        </div>
      ) : null}

      {/* Bloque B: métricas resumidas (#pruebas, calidad, repetibilidad ml) */}
      {(pruebasNum !== null || calidadText || fvcMl !== null || fev1Ml !== null) ? (
        <div className="bg-white border border-sky-100 rounded-lg p-3 space-y-1">
          <p
            className="text-[10px] font-bold text-sky-700 uppercase tracking-wider pb-1"
            style={headerStyle}
          >
            Resumen de calidad
          </p>
          {pruebasNum !== null ? (
            <NumberCell label="#Pruebas aceptables" value={pruebasNum} />
          ) : null}
          {calidadText ? (
            <div
              className="flex justify-between items-baseline gap-2 py-1 border-b border-slate-100 last:border-0"
              data-criteria-key="Calidad"
            >
              <span className="text-xs text-slate-500">Calidad</span>
              <span className="text-sm font-semibold text-slate-800">
                {calidadText}
              </span>
            </div>
          ) : null}
          {fvcMl !== null ? (
            <NumberCell
              label="Repetibilidad FVC"
              value={fvcMl}
              unit="ml"
            />
          ) : null}
          {fev1Ml !== null ? (
            <NumberCell
              label="Repetibilidad FEV1"
              value={fev1Ml}
              unit="ml"
            />
          ) : null}
        </div>
      ) : null}

      {/* Bloque C: notas de calidad (si existen) */}
      {notasCalidadText ? (
        <div className="bg-white border border-sky-100 rounded-lg p-3 space-y-1">
          <p
            className="text-[10px] font-bold text-sky-700 uppercase tracking-wider"
            style={headerStyle}
          >
            Notas de calidad
          </p>
          <p
            className="text-xs text-slate-700 leading-relaxed"
            data-criteria-key="Notas de calidad"
          >
            {notasCalidadText}
          </p>
        </div>
      ) : null}

      {/* Bloque D: texto fuente del documento (impresión diagnóstica y
          recomendaciones) si el payload los expone. NO se renderiza como
          diagnóstico IA — siempre explícito como fuente del documento. */}
      {impresionTexto || recomendacionesTexto ? (
        <div
          className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2"
          data-criteria-group="fuente-texto"
        >
          <p
            className="text-[10px] font-bold text-amber-800 uppercase tracking-wider"
            style={headerStyle}
          >
            Texto fuente del documento (no es diagnóstico IA)
          </p>
          {impresionTexto ? (
            <div data-criteria-key="Impresión diagnóstica (texto fuente)">
              <p
                className="text-[10px] font-semibold text-amber-700 uppercase"
                style={headerStyle}
              >
                Impresión diagnóstica
              </p>
              <p className="text-xs text-amber-900 leading-relaxed">
                {impresionTexto}
              </p>
            </div>
          ) : null}
          {recomendacionesTexto ? (
            <div data-criteria-key="Recomendaciones (texto fuente)">
              <p
                className="text-[10px] font-semibold text-amber-700 uppercase"
                style={headerStyle}
              >
                Recomendaciones
              </p>
              <p className="text-xs text-amber-900 leading-relaxed">
                {recomendacionesTexto}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}