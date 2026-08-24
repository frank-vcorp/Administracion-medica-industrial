/**
 * @fileoverview Bloque de criterios clínicos de Espirometría mostrados en Events
 * inmediatamente arriba del panel "Prediagnóstico IA". Sólo presentación: lee
 * los campos ya extraídos del snapshot y, cuando aplique, calcula de forma
 * determinista desde la tabla `parametros[]` la repetibilidad numérica
 * FVC/FEV1, los flags <200 y el número de maniobras válidas.
 *
 * Fuente primaria: `extractedData` completo del snapshot (no sólo `calidad`).
 * Tabla `parametros[]` cuando contiene las filas canónicas FVC y FEV1 con
 * maniobras M1/M2/M3:
 *   - `repetibilidad_fvc_ml` = diff absoluta entre los 2 valores FVC más altos,
 *     en ml (L × 1000 si `unidad === 'L'` o `unit === 'L'`).
 *   - `repetibilidad_fev1_ml` = idem para FEV1.
 *   - Umbral AMI: la repetibilidad CUMPLE cuando la diferencia es
 *     **menor o igual a 150 ml (0.15 L)** — BR-20260824-01, criterio comunicado
 *     por AMI. No usar 200 ml como umbral de cumplimiento.
 *   - `pruebas_aceptables` = # maniobras válidas disponibles en la fila
 *     FVC (3 cuando m1/m2/m3 presentes).
 *
 * Resolución de filas FVC/FEV1 (rev. 1.3): el extractor puede entregar la
 * fila con clave canónica `fvc_l`/`fev1_l` o sólo con `label === "FVC"`/
 * `"FEV1"`; también puede emitir filas "Mejor FVC"/"Mejor FEV1" como
 * resumen (clave `mejor_fvc_l`/`mejor_fev1_l`) que NO deben sustituir la fila
 * estándar para el cálculo de repetibilidad (las maniobras son las mismas
 * pero la fila canónica es la fuente primaria para top-2 entre M1/M2/M3).
 * El renderer/schema real (`extraction-presentation-schemas.ts`) usa aliases
 * de tabla `m1_value`/`m2_value`/`m3_value`/`unit`/`ref_value`/`lln_value`,
 * no `m1`/`m2`/`m3`/`unidad`/`ref`/`lln` que es lo que emite el extractor;
 * por eso aceptamos AMBAS formas para no romper la prueba real ni el caso
 * de presentación clínica.
 *
 * Si `calidad` ya expone alguna de estas claves, gana el valor extraído
 * (sobre el calculado), porque la fuente explícita del documento es
 * preferida sobre la derivación. La derivación sólo aplica cuando el valor
 * extraído no está disponible.
 *
 * Los criterios cualitativos (Pico máximo, Forma triangular, Libre de
 * artefactos, Meseta, Tiempo, Criterios para Dx, Calidad) se muestran como
 * "Sí"/"A" sólo cuando el payload los expone. NO se infieren desde la tabla
 * numérica.
 *
 * Si impresión diagnóstica y/o recomendaciones vienen en el payload como
 * texto fuente, se renderizan con marbete explícito "Texto fuente del
 * documento (no es diagnóstico IA)". Si no están, no se inventan.
 *
 * Tolerancia a payload parcial/histórico: el bloque sólo se renderiza cuando
 * hay al menos un criterio presente (extraído o calculable). Cualquier
 * campo ausente se muestra con placeholder "—" sin lanzar excepciones.
 *
 * @id IMPL-20260824-01
 * @backup context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md (rev. 1.3)
 */
import type { CSSProperties, ReactElement } from "react"

export type EspirometriaParametrosRow = {
  label?: string | null
  key?: string | null
  /** Alias del extractor: `unidad`. Alias del renderer/schema: `unit`. */
  unidad?: string | null
  unit?: string | null
  /** Aliases del extractor para maniobras: `m1`/`m2`/`m3`. */
  m1?: number | string | null
  m2?: number | string | null
  m3?: number | string | null
  /** Aliases del renderer/schema para maniobras: `m1_value`/`m2_value`/`m3_value`. */
  m1_value?: number | string | null
  m2_value?: number | string | null
  m3_value?: number | string | null
  [k: string]: unknown
}

export interface EspirometriaClinicalCriteriaPanelProps {
  /** `extractedData` raíz del snapshot. Si es null/undefined y no hay datos
   *  calculables, el bloque no se renderiza. */
  extractedData: Record<string, unknown> | null | undefined
  /** Versión del snapshot, opcional, sólo para etiqueta visible. */
  version?: number | null
}

// --- Cálculos deterministas desde `parametros[]` (SPEC §2.1) ---

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = Number(value.trim())
    if (Number.isFinite(n)) return n
  }
  return null
}

function findRowByKey(
  parametros: EspirometriaParametrosRow[],
  canonicalKey: string,
  normalizedLabel: string
): EspirometriaParametrosRow | null {
  // 1) Coincidencia exacta por `key` canónico, EXCLUYENDO filas "Mejor X".
  //    Las filas "Mejor FVC"/"Mejor FEV1" resumen la mejor maniobra, pero la
  //    fila canónica FVC/FEV1 es la fuente primaria para el cálculo de
  //    repetibilidad entre M1/M2/M3.
  const lowerCanonical = canonicalKey.toLowerCase()
  for (const row of parametros) {
    if (!row || typeof row !== "object") continue
    const rk = (row as { key?: unknown }).key
    if (typeof rk !== "string") continue
    if (rk.toLowerCase() !== lowerCanonical) continue
    if (isMejorRow(row)) continue
    return row
  }
  // 2) Fallback por `label` normalizado, también excluyendo "Mejor X".
  const lowerLabel = normalizedLabel.toLowerCase()
  for (const row of parametros) {
    if (!row || typeof row !== "object") continue
    if (isMejorRow(row)) continue
    const lbl = row.label
    if (typeof lbl !== "string") continue
    if (lbl.trim().toLowerCase() !== lowerLabel) continue
    return row
  }
  // 3) Último recurso: la fila canónica aunque sea "Mejor X" (caso raro en
  //    que el extractor sólo entregue la fila resumen). Mantiene
  //    comportamiento conservador en lugar de devolver null absoluto.
  for (const row of parametros) {
    if (!row || typeof row !== "object") continue
    const rk = (row as { key?: unknown }).key
    if (typeof rk === "string" && rk.toLowerCase() === lowerCanonical) return row
  }
  return null
}

function isMejorRow(row: EspirometriaParametrosRow): boolean {
  const lbl = typeof row.label === "string" ? row.label.trim().toLowerCase() : ""
  if (lbl.startsWith("mejor")) return true
  // Defensa adicional por clave: `mejor_*_l` también es fila resumen.
  const rk = typeof row.key === "string" ? row.key.trim().toLowerCase() : ""
  if (rk.startsWith("mejor_")) return true
  return false
}

function collectManeuverValues(
  row: EspirometriaParametrosRow
): number[] {
  const out: number[] = []
  // Pares (alias extractor, alias renderer/schema). Para cada maniobra, el
  // alias extractor tiene precedencia si ambos están presentes (consistente
  // con el resto del backend que serializa `m1`/`m2`/`m3`).
  const slotPairs: ReadonlyArray<readonly [string, string]> = [
    ["m1", "m1_value"],
    ["m2", "m2_value"],
    ["m3", "m3_value"],
  ]
  for (const [shortSlot, longSlot] of slotPairs) {
    const v = asFiniteNumber(row[shortSlot]) ?? asFiniteNumber(row[longSlot])
    if (v !== null) out.push(v)
  }
  return out
}

/**
 * Lee la unidad de una fila `parametros[]` desde los aliases `unidad`
 * (extractor) o `unit` (renderer/schema). Devuelve el valor normalizado
 * (`trim().toLowerCase()`) o string vacío si no hay unidad declarada.
 */
function readRowUnit(row: EspirometriaParametrosRow): string {
  const candidates: unknown[] = [row.unidad, row.unit]
  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim().toLowerCase()
      if (trimmed) return trimmed
    }
  }
  return ""
}

export interface RepetibilidadCalc {
  /** Diferencia entre los 2 valores más altos, en la unidad de la fila. */
  diffNative: number | null
  /** Diferencia en mililitros si la unidad es 'L' (case-insensitive), si no null. */
  diffMl: number | null
  /** Maniobras válidas disponibles (cuenta de m1/m2/m3 finitos, considerando aliases). */
  pruebas: number | null
}

/**
 * Calcula repetibilidad y #maniobras a partir de una fila `parametros[]`.
 * Devuelve `diffMl` sólo si la unidad es 'L' (case-insensitive, caso FVC/FEV1).
 * Para filas con otras unidades (l/s, s, %, años) devuelve `diffNative`
 * pero `diffMl = null` para no inventar unidades.
 */
export function computeRepetibilidadFromRow(
  row: EspirometriaParametrosRow | null
): RepetibilidadCalc {
  if (!row) return { diffNative: null, diffMl: null, pruebas: null }
  const values = collectManeuverValues(row)
  if (values.length < 2) {
    return {
      diffNative: null,
      diffMl: null,
      pruebas: values.length > 0 ? values.length : null,
    }
  }
  // Top 2 valores más altos
  const sorted = [...values].sort((a, b) => b - a)
  const diff = Math.abs(sorted[0] - sorted[1])
  const unit = readRowUnit(row)
  const diffMl = unit === "l" ? diff * 1000 : null
  return {
    diffNative: diff,
    diffMl,
    pruebas: values.length,
  }
}

function isWithinAmiThreshold(diffMl: number | null): boolean | null {
  // BR-20260824-01: repetibilidad CUMPLE si diff ≤ 150 ml (0.15 L).
  // El umbral "≤ 150 ml" es inclusivo en el límite.
  if (diffMl === null) return null
  return diffMl <= 150
}

/**
 * Umbral AMI (BR-20260824-01) en mililitros. Expuesto para tests y para
 * mostrarlo junto al label del criterio si se requiere auditoría visible.
 */
export const AMI_REPETIBILIDAD_THRESHOLD_ML = 150

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isFinite(value)
  return true
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
    try {
      return JSON.stringify(obj)
    } catch {
      return null
    }
  }
  return String(value)
}

function normalizeSiNo(value: unknown): "SI" | "NO" | null {
  if (value === null || value === undefined) return null
  const v = String(value).trim().toUpperCase()
  if (!v) return null
  if (v.startsWith("SÍ") || v === "SI" || v === "S") return "SI"
  if (v === "NO" || v === "N") return "NO"
  return null
}

// --- Componentes de presentación ---

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
  // Mostrar label + "—" cuando el payload no expone valor cualitativo
  const displayValue = normalized ?? "—"
  // Tono: SI → ok, NO → warn, ausente → neutral
  const tone: "ok" | "warn" | "neutral" =
    normalized === "SI" ? "ok" : normalized === "NO" ? "warn" : "neutral"
  return (
    <Badge label={label} value={displayValue} tone={tone} />
  )
}

function NumberCell({
  label,
  value,
  unit,
  testId,
}: {
  label: string
  value: number | null
  unit?: string
  testId?: string
}) {
  return (
    <div
      className="flex justify-between items-baseline gap-2 py-1 border-b border-slate-100 last:border-0"
      data-criteria-key={label}
      data-criteria-value={value ?? ""}
      data-testid={testId}
    >
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800 tabular-nums">
        {value === null
          ? "—"
          : Number.isInteger(value)
          ? value.toString()
          : value.toFixed(2)}
        {unit && value !== null ? (
          <span className="text-[10px] text-slate-500 ml-1">{unit}</span>
        ) : null}
      </span>
    </div>
  )
}

// --- Decisión de qué datos usar: extraído gana sobre calculado ---

export interface ResolvedCriteria {
  repetibilidadFvcMl: number | null
  repetibilidadFev1Ml: number | null
  repetibilidadFvcMenor150: "SI" | "NO" | null
  repetibilidadFev1Menor150: "SI" | "NO" | null
  pruebasAceptables: number | null
  picoMaximo: unknown
  formaTriangular: unknown
  libreArtefactos: unknown
  meseta: unknown
  tiempo: unknown
  criteriosParaDx: unknown
  calidad: string | null
  notasCalidad: string | null
  impresionTexto: string
  recomendacionesTexto: string
  /** Cualquier fuente visible en la UI para auditoría/legibilidad. */
  repetibilidadFvcSource: "extracted" | "computed" | "missing"
  repetibilidadFev1Source: "extracted" | "computed" | "missing"
}

export function resolveCriteria(
  extractedData: Record<string, unknown> | null | undefined
): ResolvedCriteria {
  const calidad =
    extractedData && typeof extractedData.calidad === "object" && !Array.isArray(extractedData.calidad)
      ? (extractedData.calidad as Record<string, unknown>)
      : null

  const parametrosRaw = extractedData?.parametros
  const parametros: EspirometriaParametrosRow[] = Array.isArray(parametrosRaw)
    ? (parametrosRaw as EspirometriaParametrosRow[]).filter(
        (r): r is EspirometriaParametrosRow => !!r && typeof r === "object"
      )
    : []

  // --- Repetibilidad FVC ---
  const fvcExtracted = hasValue(calidad?.repetibilidad_fvc_ml)
    ? asFiniteNumber(calidad?.repetibilidad_fvc_ml)
    : null
  // Resolución robusta: clave canónica `fvc_l`, con fallback seguro por label
  // `FVC`. Las filas "Mejor FVC" se excluyen para que la fila estándar sea la
  // fuente del cálculo de repetibilidad entre M1/M2/M3.
  const fvcRow = findRowByKey(parametros, "fvc_l", "FVC")
  const fvcCalc = computeRepetibilidadFromRow(fvcRow)
  const repetibilidadFvcMl =
    fvcExtracted !== null ? fvcExtracted : fvcCalc.diffMl
  const repetibilidadFvcSource: ResolvedCriteria["repetibilidadFvcSource"] =
    fvcExtracted !== null ? "extracted" : fvcCalc.diffMl !== null ? "computed" : "missing"

  // --- Repetibilidad FEV1 ---
  const fev1Extracted = hasValue(calidad?.repetibilidad_fev1_ml)
    ? asFiniteNumber(calidad?.repetibilidad_fev1_ml)
    : null
  const fev1Row = findRowByKey(parametros, "fev1_l", "FEV1")
  const fev1Calc = computeRepetibilidadFromRow(fev1Row)
  const repetibilidadFev1Ml =
    fev1Extracted !== null ? fev1Extracted : fev1Calc.diffMl
  const repetibilidadFev1Source: ResolvedCriteria["repetibilidadFev1Source"] =
    fev1Extracted !== null ? "extracted" : fev1Calc.diffMl !== null ? "computed" : "missing"

  // --- Booleanos ≤150 (Sí/No) — BR-20260824-01 ---
  // Preferir extraído de calidad. Acepta ambas claves históricas para
  // compat con snapshots previos (`..._menor_200` con etiqueta clínica
  // "<200" usada en algunos formatos AMI), pero la regla activa es 150 ml.
  const menor150FvcExtracted =
    normalizeSiNo(calidad?.repetibilidad_fvc_menor_150) ??
    normalizeSiNo(calidad?.repetibilidad_fvc_menor_200)
  const menor150FvcComputed = isWithinAmiThreshold(repetibilidadFvcMl)
  const repetibilidadFvcMenor150: "SI" | "NO" | null =
    menor150FvcExtracted ?? (menor150FvcComputed === null ? null : menor150FvcComputed ? "SI" : "NO")

  const menor150Fev1Extracted =
    normalizeSiNo(calidad?.repetibilidad_fev1_menor_150) ??
    normalizeSiNo(calidad?.repetibilidad_fev1_menor_200)
  const menor150Fev1Computed = isWithinAmiThreshold(repetibilidadFev1Ml)
  const repetibilidadFev1Menor150: "SI" | "NO" | null =
    menor150Fev1Extracted ?? (menor150Fev1Computed === null ? null : menor150Fev1Computed ? "SI" : "NO")

  // --- #Pruebas aceptables ---
  const pruebasExtracted = asFiniteNumber(calidad?.pruebas_aceptables)
  const pruebasAceptables: number | null =
    pruebasExtracted !== null
      ? Math.trunc(pruebasExtracted)
      : fvcCalc.pruebas ?? fev1Calc.pruebas

  // --- Cualitativos: sólo lo que el payload expone ---
  const calidadStr =
    typeof calidad?.calidad === "string" ? calidad.calidad.trim() : ""

  const impresionTexto =
    typeof calidad?.impresion_diagnostica_texto === "string"
      ? calidad.impresion_diagnostica_texto.trim()
      : ""
  const recomendacionesTexto =
    typeof calidad?.recomendaciones_texto === "string"
      ? calidad.recomendaciones_texto.trim()
      : ""

  return {
    repetibilidadFvcMl,
    repetibilidadFev1Ml,
    repetibilidadFvcMenor150,
    repetibilidadFev1Menor150,
    pruebasAceptables,
    picoMaximo: calidad?.pico_maximo ?? null,
    formaTriangular: calidad?.forma_triangular ?? null,
    libreArtefactos: calidad?.libre_artefactos ?? null,
    meseta: calidad?.meseta ?? null,
    tiempo: calidad?.tiempo ?? null,
    criteriosParaDx: calidad?.criterios_para_dx ?? null,
    calidad: calidadStr || null,
    notasCalidad: asNotasCalidadText(calidad?.notas_calidad),
    impresionTexto,
    recomendacionesTexto,
    repetibilidadFvcSource,
    repetibilidadFev1Source,
  }
}

/**
 * ¿Hay al menos un criterio presentable? Considera tanto valores extraídos
 * en `calidad` como derivables desde `parametros[]`.
 */
export function hasRenderableEspirometriaCriteria(
  extractedData: Record<string, unknown> | null | undefined
): boolean {
  if (!extractedData || typeof extractedData !== "object") return false
  const c = resolveCriteria(extractedData)
  if (c.repetibilidadFvcMl !== null) return true
  if (c.repetibilidadFev1Ml !== null) return true
  if (c.pruebasAceptables !== null && c.pruebasAceptables > 0) return true
  if (c.repetibilidadFvcMenor150) return true
  if (c.repetibilidadFev1Menor150) return true
  if (c.picoMaximo !== null || c.formaTriangular !== null || c.libreArtefactos !== null ||
      c.meseta !== null || c.tiempo !== null || c.criteriosParaDx !== null) return true
  if (c.calidad) return true
  if (c.notasCalidad) return true
  if (c.impresionTexto) return true
  if (c.recomendacionesTexto) return true
  return false
}

// --- Componente principal ---

export default function EspirometriaClinicalCriteriaPanel({
  extractedData,
  version,
}: EspirometriaClinicalCriteriaPanelProps) {
  if (!extractedData || typeof extractedData !== "object") return null
  if (!hasRenderableEspirometriaCriteria(extractedData)) return null

  const c = resolveCriteria(extractedData)

  // Bloque A: indicadores SI/NO (orden de la segunda imagen).
  // Labels reflejan BR-20260824-01: umbral AMI ≤ 150 ml.
  const booleanEntries: Array<{ label: string; value: unknown }> = [
    { label: "Repetibilidad FVC ≤ 150 ml", value: c.repetibilidadFvcMenor150 },
    { label: "Repetibilidad FEV1 ≤ 150 ml", value: c.repetibilidadFev1Menor150 },
    { label: "Pico máximo", value: c.picoMaximo },
    { label: "Forma triangular", value: c.formaTriangular },
    { label: "Libre de artefactos", value: c.libreArtefactos },
    { label: "Meseta", value: c.meseta },
    { label: "Tiempo", value: c.tiempo },
    { label: "Criterios para Dx", value: c.criteriosParaDx },
  ]
  const booleanBadges = booleanEntries
    .map(({ label, value }) => (
      <SiNoBadge key={label} label={label} value={value} />
    ))
    .filter((node): node is ReactElement => node !== null)

  const headerStyle: CSSProperties = { fontSize: "10px" }

  // Etiqueta pequeña que indica el origen (extraído vs calculado)
  function sourceLabel(src: "extracted" | "computed" | "missing") {
    if (src === "extracted") return "PDF"
    if (src === "computed") return "calc."
    return ""
  }

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
        Criterios extraídos del documento fuente o derivados de la tabla de maniobras. No sustituyen el criterio médico.
      </p>

      {/* === BLOQUE 1 (orden §4 segunda imagen): repetibilidad numérica primero === */}
      {(c.repetibilidadFvcMl !== null || c.repetibilidadFev1Ml !== null) ? (
        <div className="bg-white border border-sky-100 rounded-lg p-3 space-y-1">
          <p
            className="text-[10px] font-bold text-sky-700 uppercase tracking-wider pb-1"
            style={headerStyle}
          >
            Repetibilidad numérica
          </p>
          {c.repetibilidadFvcMl !== null ? (
            <NumberCell
              label="Repetibilidad FVC"
              value={c.repetibilidadFvcMl}
              unit="ml"
              testId="repetibilidad-fvc-ml"
            />
          ) : (
            <NumberCell
              label="Repetibilidad FVC"
              value={null}
              unit="ml"
              testId="repetibilidad-fvc-ml"
            />
          )}
          {c.repetibilidadFev1Ml !== null ? (
            <NumberCell
              label="Repetibilidad FEV1"
              value={c.repetibilidadFev1Ml}
              unit="ml"
              testId="repetibilidad-fev1-ml"
            />
          ) : (
            <NumberCell
              label="Repetibilidad FEV1"
              value={null}
              unit="ml"
              testId="repetibilidad-fev1-ml"
            />
          )}
          {(c.repetibilidadFvcSource !== "missing" ||
            c.repetibilidadFev1Source !== "missing") ? (
            <p
              className="text-[10px] text-slate-400 italic pt-1"
              data-criteria-key="Repetibilidad fuente"
            >
              {[
                c.repetibilidadFvcSource !== "missing" &&
                  `FVC: ${sourceLabel(c.repetibilidadFvcSource)}`,
                c.repetibilidadFev1Source !== "missing" &&
                  `FEV1: ${sourceLabel(c.repetibilidadFev1Source)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* === BLOQUE 2: indicadores SI/NO (incluye <200, pico, forma, etc.) === */}
      {booleanBadges.length > 0 ? (
        <div
          className="bg-white border border-sky-100 rounded-lg p-3 space-y-1.5"
          data-criteria-group="boolean"
        >
          <p
            className="text-[10px] font-bold text-sky-700 uppercase tracking-wider pb-1"
            style={headerStyle}
          >
            Indicadores de calidad
          </p>
          <div className="flex flex-wrap gap-2">{booleanBadges}</div>
        </div>
      ) : null}

      {/* === BLOQUE 3: pruebas aceptables, criterios, calidad === */}
      <div className="bg-white border border-sky-100 rounded-lg p-3 space-y-1">
        <p
          className="text-[10px] font-bold text-sky-700 uppercase tracking-wider pb-1"
          style={headerStyle}
        >
          Resumen de aceptabilidad
        </p>
        <NumberCell
          label="#Pruebas aceptables"
          value={c.pruebasAceptables}
          testId="pruebas-aceptables"
        />
        <div
          className="flex justify-between items-baseline gap-2 py-1 border-b border-slate-100 last:border-0"
          data-criteria-key="Calidad"
        >
          <span className="text-xs text-slate-500">Calidad</span>
          <span className="text-sm font-semibold text-slate-800">
            {c.calidad ?? "—"}
          </span>
        </div>
      </div>

      {/* === BLOQUE 4: notas de calidad (si están) === */}
      {c.notasCalidad ? (
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
            {c.notasCalidad}
          </p>
        </div>
      ) : null}

      {/* === BLOQUE 5: texto fuente del documento (NO IA) === */}
      {c.impresionTexto || c.recomendacionesTexto ? (
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
          {c.impresionTexto ? (
            <div data-criteria-key="Impresión diagnóstica (texto fuente)">
              <p
                className="text-[10px] font-semibold text-amber-700 uppercase"
                style={headerStyle}
              >
                Impresión diagnóstica
              </p>
              <p className="text-xs text-amber-900 leading-relaxed">
                {c.impresionTexto}
              </p>
            </div>
          ) : null}
          {c.recomendacionesTexto ? (
            <div data-criteria-key="Recomendaciones (texto fuente)">
              <p
                className="text-[10px] font-semibold text-amber-700 uppercase"
                style={headerStyle}
              >
                Recomendaciones
              </p>
              <p className="text-xs text-amber-900 leading-relaxed">
                {c.recomendacionesTexto}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}