/**
 * @file Catálogo y resumen del dictamen general AMI.
 *
 *   Este módulo centraliza la lógica pura del PDF del dictamen general
 *   (`<MedicalDictamenPDF>`) que:
 *     1. Define el catálogo canónico de estudios disponibles en el
 *        sistema AMI (NO se inventa por evento: es una constante
 *        global basada en el dominio).
 *     2. Resume el `extractedData` de cada estudio aplicado sin
 *        volcar JSON crudo al PDF.
 *     3. Clasifica cada estudio del snapshot en "aplicado" vs
 *        "pendiente" para que el PDF cumpla BR-20260825-17:
 *        "el consolidado no inventa resultados faltantes y marca
 *        pendientes cuando aplique".
 *
 * @id IMPL-20260826-04 (FIX dictamen general AMI, Frank 2026-08-26)
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-17
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-18
 *
 * Reglas (defensa):
 *   - Sin inventar datos: el catálogo `AMI_STUDIES_BASELINE` representa
 *     estudios CONOCIDOS del dominio AMI, NO datos del paciente. Las
 *     entradas que aparezcan como "Disponible en el catálogo — no
 *     aplicado a este evento" nunca llevan resultados, hallazgos ni
 *     interpretaciones.
 *   - Pure functions: ningún helper toca FS ni red. El renderer del PDF
 *     sigue siendo Vercel-safe (`renderDictamenInputToMemory`).
 */

export interface DictamenStudyEntry {
  serviceName: string
  extractedData?: unknown | null
}

export type StudyStatus = 'APLICADO' | 'PENDIENTE' | 'NO_APLICADO'

export interface DictamenStudySummary {
  serviceName: string
  status: StudyStatus
  /** Etiqueta legible para mostrar en el PDF ("Aplicado", "Pendiente", "No aplicado"). */
  label: string
  /** Resumen del `extractedData`: claves top-level + count. NUNCA se vuelcan valores inventados. */
  dataSummary: string
}

/**
 * Catálogo canónico de estudios disponibles en el sistema AMI.
 *
 * Representa los estudios que el dominio AMI ofrece como potencialmente
 * aplicables a un Examen Médico laboral (Audiometría para exposición
 * a ruido, Espirometría para exposición a polvos, RX Tórax, etc.).
 *
 * Esta constante NO describe qué se aplicó al paciente — sólo qué
 * servicios existen en el catálogo. Es el mismo conjunto base que el
 * ZIP de cierre clínico (`zip-cierre-clinico.ts`) y las recomendaciones
 * automáticas (`recommendations.ts`) usan para nombrar estudios.
 *
 * Mantener alineado con `backend/prisma/schema.prisma:MedicalTest.name`
 * (catálogo real persistido en BD). No es exhaustivo: añadir aquí un
 * estudio significa "está disponible en AMI", pero NO lo aplicamos
 * automáticamente al dictamen — sólo lo listamos para que el médico
 * tenga visibilidad del catálogo.
 */
export const AMI_STUDIES_BASELINE: readonly string[] = [
  'Somatometría',
  'Agudeza Visual',
  'Audiometría',
  'Espirometría',
  'Radiografía de Tórax',
  'Laboratorio Clínico',
  'Electrocardiograma',
  'Valoración por Medicina del Trabajo',
] as const

/**
 * Normaliza un nombre de estudio para matching tolerante
 * (trim + case-insensitive + colapsa espacios múltiples + strip
 * diacríticos). Esto evita falsos negativos cuando el snapshot trae
 * el nombre con mayúsculas, espacios extra, sin acentos o con
 * variantes como "AUDIOMETRIA" / "Audiometría" / "audiometria".
 *
 * Usa NFD (Canonical Decomposition) + remoción de combining marks
 * (categoría Unicode `Mn`) — equivalente a `unidecode` para los
 * caracteres habituales (á→a, é→e, í→i, ó→o, ú→u, ñ→n).
 */
function normalizeStudyName(s: string | null | undefined): string {
  if (!s || typeof s !== 'string') return ''
  return s
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks (acentos)
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Devuelve `true` si el `serviceName` aparece en el catálogo AMI
 * baseline (match tolerante a mayúsculas / espacios).
 */
export function isAmiBaselineStudy(serviceName: string): boolean {
  const target = normalizeStudyName(serviceName)
  if (!target) return false
  return AMI_STUDIES_BASELINE.some(
    (baseline) => normalizeStudyName(baseline) === target,
  )
}

/**
 * Devuelve los nombres del catálogo AMI baseline que NO aparecen en el
 * snapshot (estudios disponibles pero NO aplicados a este evento).
 *
 * Importante: el orden returned sigue el orden canónico de
 * `AMI_STUDIES_BASELINE` (no el orden del snapshot) para que el PDF
 * tenga una lista estable y predecible.
 *
 * @param snapshotNames Nombres de estudios aplicados (provenientes de
 *   `data.studies` + `data.labs`).
 * @returns Lista de nombres de estudios disponibles en AMI pero no
 *   aplicados. Vacía si el snapshot ya cubre todo el catálogo.
 */
export function amiBaselineStudiesNotApplied(
  snapshotNames: Iterable<string>,
): string[] {
  const applied = new Set<string>()
  for (const n of snapshotNames) {
    const norm = normalizeStudyName(n)
    if (norm) applied.add(norm)
  }
  return AMI_STUDIES_BASELINE.filter(
    (baseline) => !applied.has(normalizeStudyName(baseline)),
  )
}

/**
 * Resumen textual del `extractedData` SIN volcar valores crudos al
 * PDF. Devuelve:
 *   - "<N> campo(s) capturado(s)" si el objeto tiene claves.
 *   - "Sin resultado capturado" si es `null`/`undefined`/vacío.
 *   - "Resultado con tipo no esperado: <tipo>" si no es un objeto.
 *
 * Nunca imprime valores específicos del paciente — sólo el conteo y
 * las claves top-level (que son etiquetas del esquema, no PII).
 */
export function summarizeExtractedData(data: unknown): string {
  if (data === null || data === undefined) {
    return 'Sin resultado capturado'
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return `Resultado con tipo no esperado: ${Array.isArray(data) ? 'array' : typeof data}`
  }
  const obj = data as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length === 0) {
    return 'Sin resultado capturado'
  }
  // Mostrar conteo + lista de claves top-level (etiquetas, no valores).
  // Limita la lista para no saturar el PDF si el esquema tiene muchas claves.
  const preview = keys.slice(0, 8).join(', ')
  const suffix = keys.length > 8 ? ` (+${keys.length - 8} más)` : ''
  return `${keys.length} campo(s) capturado(s): ${preview}${suffix}`
}

/**
 * Clasifica un estudio del snapshot en aplicado/pendiente según si
 * tiene `extractedData` con contenido. Devuelve una etiqueta legible
 * para el PDF.
 *
 * Reglas:
 *   - `extractedData` con al menos una clave → "Aplicado".
 *   - `extractedData` null/undefined/{} → "Pendiente de resultado".
 */
export function classifyStudyStatus(entry: DictamenStudyEntry): {
  status: StudyStatus
  label: string
} {
  const hasData =
    entry.extractedData !== null &&
    entry.extractedData !== undefined &&
    typeof entry.extractedData === 'object' &&
    !Array.isArray(entry.extractedData) &&
    Object.keys(entry.extractedData as Record<string, unknown>).length > 0
  if (hasData) {
    return { status: 'APLICADO', label: 'Aplicado' }
  }
  return { status: 'PENDIENTE', label: 'Pendiente de resultado' }
}

/**
 * Builder del resumen completo de estudios para el PDF:
 * une `data.studies` + `data.labs` del payload del dictamen, marca
 * el estado de cada uno, y devuelve la lista lista para renderizar.
 *
 * NO inventa datos. NO añade estudios que no estén en el snapshot
 * a la lista de "aplicados". Los estudios NO aplicados (disponibles
 * en el catálogo AMI pero no en este evento) se devuelven
 * separadamente vía `amiBaselineStudiesNotApplied`.
 */
export function buildDictamenStudySummary(
  entries: DictamenStudyEntry[],
): DictamenStudySummary[] {
  return entries.map((entry) => {
    const { status, label } = classifyStudyStatus(entry)
    return {
      serviceName: entry.serviceName,
      status,
      label,
      dataSummary: summarizeExtractedData(entry.extractedData),
    }
  })
}
