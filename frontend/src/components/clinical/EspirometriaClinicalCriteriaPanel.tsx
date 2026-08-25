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
 * @id IMPL-20260824-05 — Fix precedencia booleanos ≤150 (derivan SIEMPRE del numérico)
 * @id IMPL-20260824-06 — rev. 1.5 invalida repetibilidad cuando el backend marca
 *   `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`/`_FVC` (duplicación M2→M1 o pérdida de M1).
 * @id IMPL-FIX-20260824-04-rev3 — ampliación de la detección de
 *   inconsistencia: reconoce TANTO el código backend (rev. 1.5) COMO la
 *   frase estructurada "Inconsistencia detectada ... Mejor <param> ...
 *   fila estándar <param>" (caso Event v10). Helper exportado:
 *   `detectParamInconsistency(notasCalidad, "FEV1"|"FVC")`. Cuando la
 *   fila es inconsistente y la repetibilidad NO proviene del texto
 *   nativo extraído (`source !== "extracted"`), el panel muestra `—`
 *   para ml, operación y flag ≤150 — nunca 0.
 * @id IMPL-FIX-20260824-04-rev4 — cross-check DIRECTO sobre `parametros[]`
 *   (caso Event v11): el payload trae claves no canónicas (`M*FEV1`/
 *   `M*FVC`) y NO incluye token SOSPECHA. Helpers exportados:
 *   `findMejorRow(parametros, "FEV1"|"FVC")` y
 *   `detectCrossInconsistency(parametros, "FEV1"|"FVC")`. La detección
 *   final es OR lógico: nota inconsistente OR parametros inconsistentes
 *   → invalidar. FVC 30 ml intacto cuando consistente.
 *   para ml, operación y flag ≤150 — nunca 0.
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

/**
 * IMPL-FIX-20260824-04-rev4 (Event v11): localiza la fila "Mejor <param>"
 * en `parametros[]`. Acepta keys canónicas Y no canónicas:
 *   - key exacta: `mejor_fev1`, `mejor_fev1_l`, `mejor_fvc`, `mejor_fvc_l`
 *   - key prefijo: `mejor_<param>` (case-insensitive)
 *   - label: contiene `mejor <param>` (case-insensitive)
 *
 * Devuelve la PRIMERA fila coincidente o `null` si no hay ninguna.
 * Caso Event v11: el payload trae keys no canónicas (`M*FEV1`/`M*FVC`) pero
 * los labels siguen siendo `Mejor FEV1` / `Mejor FVC` — esta helper los
 * encuentra por label cuando la key no encaja con `mejor_*`.
 */
function findMejorRow(
  parametros: EspirometriaParametrosRow[],
  param: "FEV1" | "FVC"
): EspirometriaParametrosRow | null {
  const paramLower = param.toLowerCase()
  for (const row of parametros) {
    if (!row || typeof row !== "object") continue
    const rk =
      typeof (row as { key?: unknown }).key === "string"
        ? ((row as { key?: unknown }).key as string).toLowerCase()
        : ""
    const lbl =
      typeof row.label === "string" ? row.label.trim().toLowerCase() : ""
    // 1) key canónica estricta: mejor_<param> o mejor_<param>_l.
    if (
      rk === `mejor_${paramLower}` ||
      rk === `mejor_${paramLower}_l`
    ) {
      return row
    }
    // 2) key prefijo mejor_<param> (captura variantes como mejor_fev1_pct_ref).
    if (rk.startsWith(`mejor_${paramLower}`)) {
      return row
    }
    // 3) label contiene "mejor <param>" (case-insensitive).
    //    Acepta tanto "Mejor FEV1" como "Mejor de FEV1" / "Mejor valor FEV1".
    if (lbl.includes(`mejor`) && lbl.includes(paramLower)) {
      // Defensa adicional: el label NO debe ser la fila estándar
      // (un label "Mejor FEV1" NO matchea "FEV1" como estándar por nuestro
      // patrón `mejor + param`, pero podría haber un label raro como
      // "FEV1 (mejor)". Aquí exigimos que el label EMPIECE con "mejor"
      // para reducir falsos positivos).
      if (lbl.startsWith("mejor")) {
        return row
      }
    }
  }
  return null
}

/**
 * IMPL-FIX-20260824-04-rev4 (Event v11): detección directa en `parametros[]`
 * de inconsistencia FEV1/FVC entre la fila estándar y la fila "Mejor X".
 *
 * Caso Event v11: el payload trae claves no canónicas (`M*FEV1`/`M*FVC`)
 * y NO incluye el código SOSPECHA_INCONSISTENCIA_MEJOR_FEV1 en
 * `notas_calidad`. Por eso las detecciones rev. 1.5 (código literal) y
 * rev. 3 (frase estructurada) NO disparaban, y el panel seguía mostrando
 * `(2.11−2.11)×1000 = 0 ml`.
 *
 * Esta helper hace el cross-check DIRECTAMENTE sobre la tabla:
 *   1. Localiza la fila estándar FEV1 (excluyendo "Mejor X") por key
 *      canónica o label exacto `FEV1`.
 *   2. Localiza la fila "Mejor FEV1" por key (`mejor_fev1`, `mejor_fev1_l`)
 *      o prefijo, o label que contiene `mejor FEV1`.
 *   3. Lee `m1` de "Mejor FEV1" (consolidada en Sibelmed: m1=m2=m3=mejor
 *      valor) y `max(m1, m2, m3)` de la fila estándar (con aliases
 *      `m1_value`/`m2_value`/`m3_value` ya soportados por
 *      `collectManeuverValues`).
 *   4. Si `mejor.m1 > max(std) + epsilon`, marca INCONSISTENCIA.
 *
 * Devuelve `true` sólo si:
 *   - Ambas filas existen.
 *   - `mejor.m1` es numérico finito.
 *   - La fila estándar tiene al menos un valor de maniobra.
 *
 * No dispara si los datos son insuficientes para una comparación
 * concluyente. No modifica el payload; es sólo lectura.
 *
 * Exportada para tests V1 focales.
 */
export function detectCrossInconsistency(
  parametros: EspirometriaParametrosRow[] | null | undefined,
  param: "FEV1" | "FVC"
): boolean {
  if (!parametros || !Array.isArray(parametros)) return false
  const stdRow = findRowByKey(
    parametros,
    `${param.toLowerCase()}_l`,
    param
  )
  const mejorRow = findMejorRow(parametros, param)
  if (!stdRow || !mejorRow) return false
  // Mejor row: el valor consolidado está en `m1` (Sibelmed consolida m1=m2=m3).
  const mejorM1 =
    asFiniteNumber((mejorRow as { m1?: unknown }).m1) ??
    asFiniteNumber((mejorRow as { m1_value?: unknown }).m1_value)
  if (mejorM1 === null) return false
  // Standard row: max(m1, m2, m3) usando aliases.
  const stdValues = collectManeuverValues(stdRow)
  if (stdValues.length < 1) return false
  const stdMax = Math.max(...stdValues)
  // Epsilon para floats con 2 decimales (1e-9).
  return mejorM1 > stdMax + 1e-9
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
 * Lee los tres valores de maniobra (M1, M2, M3) de una fila `parametros[]`
 * preservando el orden y usando los aliases `m1`/`m1_value`, etc.
 * Devuelve `[number | null, number | null, number | null]` — un null por
 * cada maniobra ausente o no numérica. La función NO inventa ni interpola.
 *
 * IMPL-20260824-XX (Frank): requerido para mostrar las 3 maniobras
 * absolutas en `REPETIBILIDAD NUMÉRICA` junto a la operación top-2, sin
 * cambiar la fórmula de cálculo.
 */
function readManeuverTriple(
  row: EspirometriaParametrosRow | null
): [number | null, number | null, number | null] | null {
  if (!row || typeof row !== "object") return null
  const slotPairs: ReadonlyArray<readonly [string, string]> = [
    ["m1", "m1_value"],
    ["m2", "m2_value"],
    ["m3", "m3_value"],
  ]
  const out: [number | null, number | null, number | null] = [null, null, null]
  for (let i = 0; i < slotPairs.length; i++) {
    const [shortSlot, longSlot] = slotPairs[i]
    const v =
      asFiniteNumber((row as Record<string, unknown>)[shortSlot]) ??
      asFiniteNumber((row as Record<string, unknown>)[longSlot])
    out[i] = v
  }
  // Si las tres son null (fila sin maniobras), devolvemos null para
  // indicar "sin fila" y NO renderizar la línea.
  if (out[0] === null && out[1] === null && out[2] === null) return null
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
  /** Los 2 valores más altos en la unidad nativa, ordenados descendente.
   *  Disponible cuando hay ≥ 2 maniobras válidas y la unidad es 'L'
   *  (es decir, cuando `diffMl` también es computable). Si no, null.
   *  Sirve para que la UI muestre la operación exacta. */
  topTwoNative: [number, number] | null
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
  if (!row) return { diffNative: null, diffMl: null, pruebas: null, topTwoNative: null }
  const values = collectManeuverValues(row)
  if (values.length < 2) {
    return {
      diffNative: null,
      diffMl: null,
      pruebas: values.length > 0 ? values.length : null,
      topTwoNative: null,
    }
  }
  // Top 2 valores más altos
  const sorted = [...values].sort((a, b) => b - a)
  const diff = Math.abs(sorted[0] - sorted[1])
  const unit = readRowUnit(row)
  const diffMl = unit === "l" ? diff * 1000 : null
  // `topTwoNative` sólo es informativo cuando la unidad es 'L' (es decir,
  // cuando la fórmula `(max - secondMax) × 1000 = ml` aplica). En otro
  // caso lo devolvemos null para no inducir a pensar que la operación es
  // representativa.
  const topTwoNative: [number, number] | null =
    unit === "l" ? [sorted[0], sorted[1]] : null
  return {
    diffNative: diff,
    diffMl,
    pruebas: values.length,
    topTwoNative,
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

/**
 * FIX-IMPL-FIX-20260824-04-rev3 — Detector robusto de inconsistencia por
 * parámetro (FEV1 o FVC).
 *
 * Reconoce DOS formas equivalentes de la anotación:
 *
 *  1) Código explícito del normalizador backend (rev. 1.5+):
 *       `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` / `SOSPECHA_INCONSISTENCIA_MEJOR_FVC`
 *       (producido por `_normalize_espirometria_result` en
 *       `backend/app/services/ai/extractor.py:602-702` cuando el máximo
 *       de la fila estándar X es menor que la fila "Mejor X").
 *
 *  2) Frase estructurada (caso Event v10 reportado por Frank):
 *       `Inconsistencia detectada entre fila 'Mejor FEV1' ... y fila
 *        estándar FEV1 ... SOSPECHA_MAPEO`
 *       El backend antiguo (o un proveedor que aún no emite el código)
 *       usa esta prosa como narrativa. Se exige la combinación
 *       EXPLÍCITA de las TRES señales referidas al MISMO parámetro:
 *         - "inconsistencia" (case-insensitive)
 *         - "Mejor <param>"
 *         - "fila estándar <param>" (con o sin acento)
 *       para NO ocultar cualquier nota genérica que sólo mencione una
 *       de las palabras sueltas.
 *
 * Devuelve `true` sólo si alguna de las dos formas detecta el mismo
 * parámetro. `false` en caso contrario (incluyendo string vacío).
 *
 * Esta función es EXPORTADA para tests V1 focales.
 */
export function detectParamInconsistency(
  notasCalidad: string | null | undefined,
  param: "FEV1" | "FVC"
): boolean {
  if (!notasCalidad) return false
  const code = `SOSPECHA_INCONSISTENCIA_MEJOR_${param}`
  // (1) Código explícito.
  if (notasCalidad.includes(code)) return true
  // (2) Frase estructurada. Tres condiciones, todas referidas al MISMO
  //     parámetro. Regex tolerante a acentos y mayúsculas.
  const hasInconsistency = /inconsistencia/i.test(notasCalidad)
  const hasMejor = new RegExp(`\\bmejor\\s+${param}\\b`, "i").test(notasCalidad)
  const hasFilaEstandar = new RegExp(
    `\\bfila\\s+est[aá]ndar\\s+${param}\\b`,
    "i"
  ).test(notasCalidad)
  return hasInconsistency && hasMejor && hasFilaEstandar
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

/**
 * Línea de operación exacta: muestra la fórmula `(max − second) × 1000 = ml`
 * con los valores M1/M2/M3 ya seleccionados por el helper. Si el helper no
 * pudo tomar los dos mayores (fila ausente o unidad distinta de L), se
 * muestra `—` sin inventar números.
 */
function RepetibilidadOperationLine({
  label,
  topTwo,
  diffMl,
}: {
  label: string
  topTwo: [number, number] | null
  diffMl: number | null
}) {
  let body: string
  if (topTwo === null) {
    body = "—"
  } else {
    const [maxVal, secondVal] = topTwo
    const maxStr = Number.isInteger(maxVal) ? maxVal.toString() : maxVal.toFixed(2)
    const secondStr = Number.isInteger(secondVal) ? secondVal.toString() : secondVal.toFixed(2)
    const result =
      diffMl === null
        ? "—"
        : Number.isInteger(diffMl)
        ? diffMl.toString()
        : diffMl.toFixed(2)
    // Operación exacta: usa unicode "−" (U+2212) y "×" (U+00D7) para
    // alinearse con la notación matemática del PDF.
    body = `(${maxStr} − ${secondStr}) × 1000 = ${result} ml`
  }
  return (
    <p
      className="text-[10px] text-slate-500 italic pl-1 -mt-0.5 pb-1"
      data-criteria-key={`${label} operación`}
      data-testid={`repetibilidad-${label.toLowerCase()}-operacion`}
    >
      {label}: {body}
    </p>
  )
}

/**
 * IMPL-20260824-XX (Frank): línea visible con los 3 valores absolutos de
 * maniobra para FVC/FEV1 (`M1`, `M2`, `M3`) tomados del mismo snapshot/filas
 * que usa el cálculo. Aparece ANTES de la operación para que el médico
 * pueda verificarla.
 *
 * Formato esperado:
 *   `FVC — M1: x.xx L · M2: x.xx L · M3: x.xx L`
 *
 * Tolerancias:
 *   - Si una maniobra es null o no numérica → `—` (no se inventa).
 *   - Si el triple entero es null (fila ausente) → no renderiza.
 *   - Soporta aliases `m1`/`m2`/`m3` y `m1_value`/`m2_value`/`m3_value`.
 */
function ManeuverTripleLine({
  label,
  triple,
  unit,
}: {
  label: string
  triple: [number | null, number | null, number | null] | null
  unit: string
}) {
  if (!triple) return null
  const formatVal = (v: number | null): string => {
    if (v === null) return "—"
    return Number.isInteger(v) ? v.toString() : v.toFixed(2)
  }
  return (
    <p
      className="text-[10px] text-slate-600 pl-1"
      data-criteria-key={`${label} maniobras`}
      data-testid={`repetibilidad-${label.toLowerCase()}-maniobras`}
    >
      {label} — M1: {formatVal(triple[0])} {unit} · M2:{" "}
      {formatVal(triple[1])} {unit} · M3: {formatVal(triple[2])} {unit}
    </p>
  )
}

// --- Decisión de qué datos usar: extraído gana sobre calculado ---

export interface ResolvedCriteria {
  repetibilidadFvcMl: number | null
  repetibilidadFev1Ml: number | null
  repetibilidadFvcMenor150: "SI" | "NO" | null
  repetibilidadFev1Menor150: "SI" | "NO" | null
  pruebasAceptables: number | null
  /** Los 2 valores FVC más altos en la unidad nativa (L), o null si no
   *  se pudieron tomar del snapshot. Sirven para mostrar la operación
   *  exacta en la UI (`(max − second) × 1000 = ml`). */
  fvcTopTwoNative: [number, number] | null
  /** Los 2 valores FEV1 más altos en la unidad nativa (L), o null. */
  fev1TopTwoNative: [number, number] | null
  /** Las 3 maniobras absolutas de FVC en la unidad nativa (L),
   *  preservando el orden M1/M2/M3. null por maniobra ausente
   *  (no se inventa). null si la fila no existe. */
  fvcManeuverTripleNative: [number | null, number | null, number | null] | null
  /** Las 3 maniobras absolutas de FEV1 en la unidad nativa (L). */
  fev1ManeuverTripleNative:
    [number | null, number | null, number | null] | null
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
  // IMPL-20260824-XX (Frank): triple M1/M2/M3 de la misma fila que usa el
  // cálculo, para que el médico pueda verificar la operación top-2.
  const fvcManeuverTriple = readManeuverTriple(fvcRow)

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
  const fev1ManeuverTriple = readManeuverTriple(fev1Row)

  // --- Booleanos ≤150 (Sí/No) — BR-20260824-01 ---
  // REGLA DE PRECEDENCIA (IMPL-20260824-05 — fix v6 captura Sibelmed):
  //   Los flags `Repetibilidad FVC/FEV1 ≤ 150 ml` se derivan SIEMPRE del
  //   valor numérico (`repetibilidadFvcMl` / `repetibilidadFev1Ml`) aplicando
  //   el umbral AMI ≤ 150 ml (BR-20260824-01).
  //
  //   `repetibilidadFvcMl`/`repetibilidadFev1Ml` ya respetan la fuente
  //   numérica explícita del documento (`calidad.repetibilidad_fvc_ml` /
  //   `_fev1_ml`) cuando existe; en caso contrario se calculan desde la
  //   tabla `parametros[]` (top-2 sobre m1/m2/m3 × 1000).
  //
  //   NO se consultan como verdad las claves `calidad.repetibilidad_*_menor_150`
  //   ni la legacy `*_menor_200`: el extractor (incluso v4→v5) las puede
  //   poblar copiando "Repetibilidad ATS/ERS: No" de la imagen embebida del
  //   Sibelmed W20s, criterio distinto y a veces contradictorio con la
  //   diferencia numérica real entre M1/M2/M3. Ese flag binario ATS/ERS del
  //   equipo es un criterio aparte (ya visible en "Calidad técnica del
  //   estudio" vía `extraction-presentation-schemas.ts` como
  //   `repetibilidad_ats_ers_fvc`/`_fev1`) y NO debe sobrescribir el
  //   criterio AMI del panel.
  //
  //   Caso Sibelmed RD2026 (defecto v6): el extractor copia
  //   `repetibilidad_fvc_menor_200: "SI"` y la imagen embebida dice
  //   "Repetibilidad ATS/ERS: FVC: No", pero los vectores PDF muestran
  //   "Repetibilidad FVC: 30.00 ml / FEV1: 40.00 ml". Con la regla anterior
  //   el panel mostraba NO/NO por copiar el flag ATS/ERS; con la nueva
  //   muestra SI/SI por derivar del numérico (30/40 ≤ 150).
  const repetibilidadFvcMenor150: "SI" | "NO" | null =
    repetibilidadFvcMl === null
      ? null
      : isWithinAmiThreshold(repetibilidadFvcMl)
      ? "SI"
      : "NO"
  const repetibilidadFev1Menor150: "SI" | "NO" | null =
    repetibilidadFev1Ml === null
      ? null
      : isWithinAmiThreshold(repetibilidadFev1Ml)
      ? "SI"
      : "NO"

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

  // FIX-FEATURE-20260824-01 rev. 1.5: invalidación por inconsistencia
  // tabular. Si el normalizador backend marcó la fila FEV1/FVC como
  // inconsistente frente a su fila "Mejor X" (duplicación de M2 como M1
  // o pérdida de M1), NO presentamos un cálculo de repetibilidad espurio
  // (p.ej. 0 ml de (2.11−2.11)×1000) sobre una fila no confiable.
  //
  //   - Ocultamos la operación visible (topTwoNative → null → la línea
  //     de operación muestra "—").
  //   - Si la repetibilidad provenía del CÁLCULO (source="computed"),
  //     invalidamos también el número y el flag ≤150 (no mostramos 0 ml
  //     como válido). El panel cae al placeholder "—".
  //   - Si la repetibilidad provenía del TEXTO NATIVO extraído del
  //     documento (`calidad.repetibilidad_fev1_ml`, fuente independiente
  //     del layout tabular), la conservamos (es la verdad declarada por
  //     el reporte) pero ocultamos la operación espuria derivada de la
  //     fila duplicada.
  //
  // FIX-IMPL-FIX-20260824-04-rev3: la detección se amplía para reconocer
  // TANTO el código backend (`SOSPECHA_INCONSISTENCIA_MEJOR_FEV1`/`_FVC`)
  // COMO la frase estructurada que aparece en Event v10:
  //   `Inconsistencia detectada entre fila 'Mejor FEV1' ... y fila
  //    estándar FEV1 ... SOSPECHA_MAPEO`
  // Se exige combinación de Mejor + fila estándar + parámetro para el
  // MISMO parámetro (no se oculta cualquier nota genérica). Helper
  // exportado: `detectParamInconsistency`.
  //
  // FIX-IMPL-FIX-20260824-04-rev4 (Event v11): AMPLIACIÓN adicional. El
  // payload de Event v11 trae claves no canónicas (`M*FEV1`/`M*FVC`) y NO
  // incluye el código SOSPECHA ni la frase estructurada — la detección
  // por notas falla. Se añade un cross-check DIRECTO sobre `parametros[]`
  // vía `detectCrossInconsistency`: localiza fila estándar y fila
  // "Mejor <param>" por label/key, lee `m1` y `max(m1,m2,m3)`, y marca
  // inconsistencia si `mejor.m1 > max(std) + epsilon`. Combinación
  // final es OR lógico: nota marca inconsistente OR parametros marcan
  // inconsistente → invalidar. Tests V1 cubren cada canal y el
  // combinado.
  const notasCalidadForInconsistency: string = [
    typeof extractedData?.notas_calidad === "string"
      ? (extractedData.notas_calidad as string)
      : "",
    typeof calidad?.notas_calidad === "string"
      ? (calidad.notas_calidad as string)
      : "",
  ].join(" ")
  const fev1InconsistentByNote = detectParamInconsistency(
    notasCalidadForInconsistency,
    "FEV1"
  )
  const fvcInconsistentByNote = detectParamInconsistency(
    notasCalidadForInconsistency,
    "FVC"
  )
  const fev1InconsistentByCross = detectCrossInconsistency(parametros, "FEV1")
  const fvcInconsistentByCross = detectCrossInconsistency(parametros, "FVC")
  const fev1Inconsistent = fev1InconsistentByNote || fev1InconsistentByCross
  const fvcInconsistent = fvcInconsistentByNote || fvcInconsistentByCross
  const fvcTopTwoFinal: [number, number] | null =
    fvcInconsistent ? null : fvcCalc.topTwoNative
  const fev1TopTwoFinal: [number, number] | null =
    fev1Inconsistent ? null : fev1Calc.topTwoNative
  // FIX-IMPL-FIX-20260824-04-rev3 (snapshot v10 Frank): cuando la fila es
  // inconsistente y NO existe un valor nativo extraído del texto fuente
  // (`source !== "extracted"`), mostramos "—" (null) para el número, la
  // operación y el flag ≤150 — NUNCA 0 ml. Si la repetibilidad provenía
  // del cálculo (`source === "computed"`), se invalida el número. Si
  // provenía de `missing`, ya era null desde el inicio. La única rama
  // que conserva el valor numérico es `source === "extracted"` (texto
  // nativo del reporte, fuente independiente del layout tabular).
  const fvcMlFinal: number | null =
    fvcInconsistent && repetibilidadFvcSource !== "extracted"
      ? null
      : repetibilidadFvcMl
  const fev1MlFinal: number | null =
    fev1Inconsistent && repetibilidadFev1Source !== "extracted"
      ? null
      : repetibilidadFev1Ml
  const fvcMenor150Final: "SI" | "NO" | null =
    fvcInconsistent && repetibilidadFvcSource !== "extracted"
      ? null
      : repetibilidadFvcMenor150
  const fev1Menor150Final: "SI" | "NO" | null =
    fev1Inconsistent && repetibilidadFev1Source !== "extracted"
      ? null
      : repetibilidadFev1Menor150

  return {
    repetibilidadFvcMl: fvcMlFinal,
    repetibilidadFev1Ml: fev1MlFinal,
    repetibilidadFvcMenor150: fvcMenor150Final,
    repetibilidadFev1Menor150: fev1Menor150Final,
    pruebasAceptables,
    // Trazabilidad de la fórmula: top-2 valores tomados del snapshot.
    // Independiente de si `repetibilidadFvcMl` viene extraído o calculado,
    // exponemos los valores de maniobra para que la UI muestre la operación
    // exacta que respaldó el cálculo. Si la fila/valores no están, null.
    // rev. 1.5: null también cuando el backend marcó la fila como
    // inconsistente (no mostrar operación espuria).
    fvcTopTwoNative: fvcTopTwoFinal,
    fev1TopTwoNative: fev1TopTwoFinal,
    // IMPL-20260824-XX (Frank): triple M1/M2/M3 del mismo snapshot/fila
    // que usa el cálculo. Visible en REPETIBILIDAD NUMÉRICA junto a la
    // operación para que el médico verifique. null por maniobra ausente.
    fvcManeuverTripleNative: fvcManeuverTriple,
    fev1ManeuverTripleNative: fev1ManeuverTriple,
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

      {/* === BLOQUE 1 (orden §4 segunda imagen): repetibilidad numérica primero ===
          IMPL-20260824-XX (Frank): muestra también los 3 valores absolutos
          de maniobra (M1/M2/M3) por parámetro, ANTES de la operación top-2,
          para que el médico pueda verificarla. Se renderiza siempre que
          haya triple (incluso si `repetibilidad*Ml` es null por payload
          parcial — la verificación de la maniobra es independiente del
          resultado numérico). */}
      {(c.repetibilidadFvcMl !== null ||
        c.repetibilidadFev1Ml !== null ||
        c.fvcManeuverTripleNative !== null ||
        c.fev1ManeuverTripleNative !== null) ? (
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
          <ManeuverTripleLine
            label="FVC"
            triple={c.fvcManeuverTripleNative}
            unit="L"
          />
          <RepetibilidadOperationLine
            label="FVC"
            topTwo={c.fvcTopTwoNative}
            diffMl={c.repetibilidadFvcMl}
          />
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
          <ManeuverTripleLine
            label="FEV1"
            triple={c.fev1ManeuverTripleNative}
            unit="L"
          />
          <RepetibilidadOperationLine
            label="FEV1"
            topTwo={c.fev1TopTwoNative}
            diffMl={c.repetibilidadFev1Ml}
          />
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

{/* === BLOQUE 4: notas de calidad — FEATURE-20260824-01 mini-corte ===
           OCULTO visualmente del panel: `notas_calidad` se SIGUE leyendo del
           snapshot en `resolveCriteria` (c.notasCalidad) para conservarlo en
           auditoría / payload persistido, pero NO se renderiza aquí para
           evitar duplicación con el resto de criterios cualitativos y
           numéricos (Pico/Forma/Libre/Meseta/Tiempo/Criterios/Calidad).
           Ver `IMPL-REPORT-FEATURE-20260824-01_ESPIROMETRIA-EVENT.md`. */}

      {/* === BLOQUE 5 ELIMINADO (IMPL-FIX-20260824-XX rev. UI) ===
           Anteriormente se renderizaba aquí un bloque amber con el
           "Texto fuente del documento (NO es diagnóstico IA)" mostrando
           `impresionTexto` y `recomendacionesTexto` del snapshot. Frank
           confirmó que ya no debe aparecer en Criterios clínicos — los
           datos del snapshot (`impresion_diagnostica_texto` /
           `recomendaciones_texto`) SE SIGUEN leyendo del payload en
           `resolveCriteria` y se exponen como `c.impresionTexto` /
           `c.recomendacionesTexto` para auditoría (logs, QA, export del
           JSON), pero NO se renderizan aquí. La impresión diagnóstica
           sugerida ahora vive en el BLOQUE del prediagnóstico IA
           (modo sombra, revisión médica), y las recomendaciones
           ocupacionales contextualizadas también. */}
    </div>
  )
}