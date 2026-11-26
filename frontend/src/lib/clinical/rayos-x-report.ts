/**
 * Helpers puros para armar el informe PDF de Interpretación de Rayos X (formato SME).
 */

export type RayosXExtracted = {
  hallazgos: string[]
  proyecciones_evaluadas?: string[] | null
  localizacion: string | null
  radiologista: string | null
  fecha_estudio: string | null
  notas_calidad: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function ensureSentence(text: string): string {
  const cleaned = text.trim().replace(/^[\s•●\-–*]+/, '').trim()
  if (!cleaned) return ''
  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`
}

function splitRunOnHallazgos(raw: string): string[] {
  const lineParts = raw
    .split(/\r?\n+|(?:\s*[•●]\s*)/)
    .map((p) => p.trim())
    .filter(Boolean)

  const out: string[] = []
  for (const part of lineParts) {
    // Si viene una sola cadena larga separada por comas sin puntos internos,
    // la dividimos en enunciados cortos legibles para el reporte radiológico.
    if (!part.includes('.') && part.length > 100) {
      const clauses = part
        .split(/\s*,\s*/)
        .map((c) => c.trim())
        .filter((c) => c.length >= 12)
      if (clauses.length >= 3) {
        out.push(...clauses.map(ensureSentence).filter(Boolean))
        continue
      }
    }
    const formatted = ensureSentence(part)
    if (formatted) out.push(formatted)
  }
  return out
}

/** Extrae campos de `RayosXData` desde `structuredData` del snapshot de extracción. */
export function parseRayosXFromExtraction(extractionStructuredData: unknown): RayosXExtracted | null {
  const root = asRecord(extractionStructuredData)
  if (!root) return null
  const data = asRecord(root.extracted_data) ?? root

  const hallazgos: string[] = []
  const rawHallazgos = data.hallazgos
  if (Array.isArray(rawHallazgos)) {
    for (const item of rawHallazgos) {
      if (typeof item === 'string' && item.trim()) {
        hallazgos.push(...splitRunOnHallazgos(item))
      }
    }
  } else if (typeof rawHallazgos === 'string' && rawHallazgos.trim()) {
    hallazgos.push(...splitRunOnHallazgos(rawHallazgos))
  }

  const rawProyecciones = data.proyecciones_evaluadas
  const proyecciones = Array.isArray(rawProyecciones)
    ? rawProyecciones
        .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .map((p) => p.trim())
    : []

  const parsed: RayosXExtracted = {
    hallazgos,
    proyecciones_evaluadas: proyecciones.length > 0 ? proyecciones : null,
    localizacion: asString(data.localizacion),
    radiologista: asString(data.radiologista),
    fecha_estudio: asString(data.fecha_estudio),
    notas_calidad: asString(data.notas_calidad),
  }

  const hasAny =
    parsed.hallazgos.length > 0 ||
    (parsed.proyecciones_evaluadas?.length ?? 0) > 0 ||
    parsed.localizacion != null ||
    parsed.radiologista != null ||
    parsed.fecha_estudio != null ||
    parsed.notas_calidad != null

  return hasAny ? parsed : null
}

function normalizeUpperAscii(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function isProjectionMentionedInTitle(titleUpper: string, projToken: string): boolean {
  const tokenUpper = normalizeUpperAscii(projToken)
  if (!tokenUpper) return true
  const synonyms =
    tokenUpper === 'LAT' || tokenUpper === 'LATERAL'
      ? ['LAT', 'LATERAL']
      : tokenUpper === 'OBL' || tokenUpper === 'OBLICUA' || tokenUpper === 'OBLICUO'
        ? ['OBL', 'OBLICUA', 'OBLICUO']
        : [tokenUpper]
  return synonyms.some((syn) => {
    const escaped = syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`).test(titleUpper)
  })
}

/** Resuelve el rótulo de «TIPO DE RADIOGRAFÍA» en mayúsculas. */
export function resolveRayosXStudyTypeLabel(
  studyName?: string | null,
  extracted?: RayosXExtracted | null,
  projectionsSummary?: string | null,
): string {
  const cleanName = asString(studyName)
  const cleanLoc = asString(extracted?.localizacion)
  const base = cleanName
    ? cleanName.replace(/\s+/g, ' ').toUpperCase()
    : cleanLoc
      ? cleanLoc.replace(/\s+/g, ' ').toUpperCase()
      : 'ESTUDIO RADIOGRÁFICO'

  const effectiveProjections =
    asString(projectionsSummary) ??
    (extracted?.proyecciones_evaluadas?.length
      ? extracted.proyecciones_evaluadas.join(', ')
      : null)

  if (!effectiveProjections) return base

  const projTokens = effectiveProjections
    .split(/\s*,\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (projTokens.length === 0) return base

  const baseNorm = normalizeUpperAscii(base)
  const allAlreadyPresent = projTokens.every((p) =>
    isProjectionMentionedInTitle(baseNorm, p),
  )
  if (allAlreadyPresent) return base

  const suffix = projTokens.map((p) => p.toUpperCase()).join(', ')
  return `${base} (${suffix})`
}

/** Genera los párrafos narrativos del cuerpo del informe radiológico. */
export function buildRayosXFindingsParagraphs(input: {
  extracted: RayosXExtracted | null
  prediagnosisData?: unknown
  doctorNotes?: string | null
  doctorDiagnosis?: string | null
}): string[] {
  const paragraphs: string[] = []
  const seen = new Set<string>()
  const pushUnique = (raw: string) => {
    const formatted = ensureSentence(raw)
    if (!formatted) return
    const key = formatted.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      paragraphs.push(formatted)
    }
  }

  if (input.extracted?.hallazgos.length) {
    for (const h of input.extracted.hallazgos) {
      pushUnique(h)
    }
  } else {
    const predx = asRecord(input.prediagnosisData)
    const just = predx?.justification
    if (Array.isArray(just) && just.length > 0) {
      for (const item of just) {
        if (typeof item === 'string' && item.trim()) {
          pushUnique(item)
        }
      }
    } else if (typeof predx?.summary === 'string' && predx.summary.trim()) {
      pushUnique(predx.summary)
    }
  }

  const notes = asString(input.doctorNotes)
  if (notes) {
    for (const line of notes.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean)) {
      pushUnique(line)
    }
  }

  if (paragraphs.length === 0) {
    const fallback =
      asString(input.doctorDiagnosis) ??
      'Estudio radiográfico evaluado. Correlacionar con antecedentes y exploración física del paciente.'
    pushUnique(fallback)
  }

  return paragraphs.slice(0, 6)
}

/** Convierte el diagnóstico validado en viñetas en mayúsculas para «IMPRESIÓN DIAGNÓSTICA». */
export function parseRayosXImpressionItems(doctorDiagnosis?: string | null): string[] {
  const text = asString(doctorDiagnosis)
  if (!text) return ['SIN IMPRESIÓN DIAGNÓSTICA ESPECIFICADA.']

  const lines = text
    .split(/\r?\n+|;\s+|\s*[•●]\s+/)
    .map((line) => line.replace(/^[\d]+[.)]\s*/, '').replace(/^[\-*]\s+/, '').trim())
    .filter(Boolean)

  const items = lines.length > 0 ? lines : [text]
  return items.map((item) => item.toUpperCase())
}

/** Fecha larga estilo informe SME: «lunes, 15 de diciembre de 2025». */
export function formatRayosXLongDateEsMx(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}
