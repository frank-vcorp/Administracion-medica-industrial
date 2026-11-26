/**
 * Texto del informe oficial SME de electrocardiograma en reposo.
 */
import {
  mergeEcgExtractionWithSavedParameters,
  parseEcgParametersContext,
} from './ecg-parameters'

export type EcgExtracted = {
  ritmicidad?: string | null
  ritmo?: string | null
  frecuencia_bpm?: number | null
  duracion_p_ms?: number | null
  morfologia_p?: string | null
  intervalo_pr_ms?: number | null
  duracion_qrs_ms?: number | null
  qt_ms?: number | null
  qtc_ms?: number | null
  eje_electrico?: string | null
  eje_grados?: number | null
  segmento_st?: string | null
  onda_t?: string | null
  onda_q_patologica?: string | null
  calibracion_papel?: string | null
  derivaciones_visibles?: string[]
  origen_mediciones?: string | null
  hallazgos?: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asInt(value: unknown, allowNegative = false): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value)
    return allowNegative || n > 0 ? n : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const match = value.trim().match(/-?\d+(?:[.,]\d+)?/)
    if (!match) return null
    const n = Math.round(Number.parseFloat(match[0].replace(',', '.')))
    if (!Number.isFinite(n)) return null
    return allowNegative || n > 0 ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

function asStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    const t = value.trim()
    return t ? [t] : []
  }
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v).trim()).filter(Boolean)
}

/** Lee `ElectrocardiogramaData` desde structuredData del snapshot de extracción. */
export function parseEcgFromExtraction(extractionStructuredData: unknown): EcgExtracted | null {
  const root = asRecord(extractionStructuredData)
  if (!root) return null
  const data = asRecord(root.extracted_data) ?? root

  const hallazgos = asStringList(data.hallazgos)
  const derivaciones = asStringList(data.derivaciones_visibles)
  const ejeTexto = asString(data.eje_electrico)
  const ejeGrados = asInt(data.eje_grados, true) ?? (ejeTexto ? asInt(ejeTexto, true) : null)

  const parsed: EcgExtracted = {
    ritmicidad: asString(data.ritmicidad),
    ritmo: asString(data.ritmo),
    frecuencia_bpm: asInt(data.frecuencia_bpm),
    duracion_p_ms: asInt(data.duracion_p_ms),
    morfologia_p: asString(data.morfologia_p),
    intervalo_pr_ms: asInt(data.intervalo_pr_ms),
    duracion_qrs_ms: asInt(data.duracion_qrs_ms),
    qt_ms: asInt(data.qt_ms),
    qtc_ms: asInt(data.qtc_ms),
    eje_electrico: ejeTexto,
    eje_grados: ejeGrados,
    segmento_st: asString(data.segmento_st),
    onda_t: asString(data.onda_t),
    onda_q_patologica: asString(data.onda_q_patologica),
    calibracion_papel: asString(data.calibracion_papel),
    derivaciones_visibles: derivaciones,
    origen_mediciones: asString(data.origen_mediciones),
    hallazgos,
  }

  const hasAny =
    parsed.ritmo != null ||
    parsed.ritmicidad != null ||
    parsed.frecuencia_bpm != null ||
    parsed.duracion_p_ms != null ||
    parsed.intervalo_pr_ms != null ||
    parsed.duracion_qrs_ms != null ||
    parsed.qtc_ms != null ||
    parsed.eje_electrico != null ||
    parsed.eje_grados != null ||
    parsed.segmento_st != null ||
    parsed.onda_t != null ||
    parsed.onda_q_patologica != null ||
    hallazgos.length > 0

  return hasAny ? parsed : null
}

function formatRitmoPhrase(ritmo: string | null | undefined): string {
  if (!ritmo) return 'ritmo no especificado'
  const r = ritmo.trim()
  if (/^sinusal$/i.test(r)) return 'Ritmo Sinusal'
  if (/^ritmo\b/i.test(r)) return r
  if (/sinusal/i.test(r)) return r.charAt(0).toUpperCase() + r.slice(1)
  return r
}

function stripTrailingPeriod(text: string): string {
  return text.trim().replace(/\.+$/, '')
}

function lcFirst(text: string): string {
  const t = text.trim()
  if (!t) return t
  // Conservar siglas iniciales como ST, QRS, aVR, BAV
  if (/^(ST|QRS|PR|QTc?|BAV|BRD|BRI|aV[RLF])/u.test(t)) return t
  return t.charAt(0).toLowerCase() + t.slice(1)
}

function ucFirst(text: string): string {
  const t = text.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function formatEjeClause(
  ejeTexto: string | null | undefined,
  ejeGrados: number | null | undefined,
): string | null {
  const rawTexto = (ejeTexto ?? '').trim()
  const parsedDegreesFromText = rawTexto ? asInt(rawTexto, true) : null
  const degrees = ejeGrados ?? parsedDegreesFromText

  // Limpiar texto si traía solo un número o grados entre paréntesis
  let label = rawTexto
    .replace(/\([^)]*\)/g, '')
    .replace(/[-+]?\d+\s*°?/g, '')
    .trim()
  if (label && /^(a|en)$/i.test(label)) label = ''
  if (!label && degrees != null) {
    if (degrees >= -30 && degrees <= 90) label = 'normal'
    else if (degrees < -30 && degrees >= -90) label = 'desviado a la izquierda'
    else if (degrees > 90 && degrees <= 180) label = 'desviado a la derecha'
  }

  if (label && degrees != null) {
    return `${lcFirst(label)} a ${degrees}°`
  }
  if (degrees != null) {
    return `a ${degrees}°`
  }
  if (label) {
    return lcFirst(label)
  }
  return null
}

/** Párrafo morfológico oficial SME. `morphologicOverride` = notas escritas manualmente por el médico. */
export function buildEcgNarrativeParagraph(
  ecg: EcgExtracted | null,
  morphologicOverride?: string | null,
  savedContext?: unknown,
): string {
  const override = (morphologicOverride ?? '').trim()
  if (override) return override

  const saved = parseEcgParametersContext(savedContext)
  const merged = mergeEcgExtractionWithSavedParameters(
    (ecg as Record<string, unknown> | null) ?? null,
    saved,
  ) as EcgExtracted | null

  if (!merged) {
    return 'Electrocardiograma en reposo. Correlacionar con exploración física y antecedentes del paciente.'
  }

  const ritmicidad = (merged.ritmicidad ?? 'rítmico').trim().toLowerCase()
  const firstSentenceParts: string[] = [
    `Electrocardiograma ${ritmicidad}, en ${formatRitmoPhrase(merged.ritmo)}`,
  ]

  if (merged.frecuencia_bpm != null) {
    firstSentenceParts.push(`, con Frecuencia Cardiaca de ${merged.frecuencia_bpm} lpm`)
  }

  if (merged.duracion_p_ms != null && merged.morfologia_p) {
    firstSentenceParts.push(
      `, Onda P de ${merged.duracion_p_ms} mseg, ${lcFirst(stripTrailingPeriod(merged.morfologia_p))}`,
    )
  } else if (merged.duracion_p_ms != null) {
    firstSentenceParts.push(`, Onda P de ${merged.duracion_p_ms} mseg`)
  } else if (merged.morfologia_p) {
    firstSentenceParts.push(
      `, Onda P ${lcFirst(stripTrailingPeriod(merged.morfologia_p))}`,
    )
  }

  const axisClause = formatEjeClause(merged.eje_electrico, merged.eje_grados)
  if (merged.duracion_qrs_ms != null) {
    firstSentenceParts.push(
      `, seguidas de QRS de ${merged.duracion_qrs_ms} mseg` +
        (axisClause ? `, con Eje Cardiaco ${axisClause}` : ''),
    )
  } else if (axisClause) {
    firstSentenceParts.push(`, con Eje Cardiaco ${axisClause}`)
  }

  const sentences: string[] = [`${firstSentenceParts.join('')}.`]

  if (merged.intervalo_pr_ms != null) {
    sentences.push(`Intervalo PR de ${merged.intervalo_pr_ms} mseg.`)
  }

  const repolClauses: string[] = []
  if (merged.qtc_ms != null) {
    repolClauses.push(`QT corregido de ${merged.qtc_ms} mseg`)
  } else if (merged.qt_ms != null) {
    repolClauses.push(`QT de ${merged.qt_ms} mseg`)
  }

  if (merged.segmento_st) {
    const stClean = stripTrailingPeriod(merged.segmento_st)
    repolClauses.push(
      /^segmento\s+st\b/i.test(stClean) ? ucFirst(stClean) : `Segmento ST ${lcFirst(stClean)}`,
    )
  }
  if (merged.onda_t) {
    const tClean = stripTrailingPeriod(merged.onda_t)
    repolClauses.push(
      /^onda\s+t\b/i.test(tClean) ? ucFirst(tClean) : `Onda T ${lcFirst(tClean)}`,
    )
  }
  if (repolClauses.length > 0) {
    sentences.push(`${repolClauses.join(', ')}.`)
  }

  if (merged.onda_q_patologica) {
    const qClean = stripTrailingPeriod(merged.onda_q_patologica)
    sentences.push(`${ucFirst(qClean)}.`)
  }

  if (
    merged.hallazgos &&
    merged.hallazgos.length > 0 &&
    (!saved && (!merged.segmento_st || !merged.onda_t))
  ) {
    sentences.push(`Observaciones del trazado: ${stripTrailingPeriod(merged.hallazgos.join('; '))}.`)
  }

  return sentences.join(' ').replace(/\s+/g, ' ').trim()
}

/** Ítems bajo «DIAGNÓSTICO ELECTROCARDIOGRÁFICO:». */
export function parseEcgDiagnosisItems(doctorDiagnosis: string | null | undefined): string[] {
  const raw = (doctorDiagnosis ?? '').trim()
  if (!raw) {
    return [
      'Electrocardiograma en reposo — correlacionar con clínica y trazado archivado.',
      'Corroborar con clínica.',
    ]
  }

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[.)\-:\s]+/, '').trim())
    .filter(Boolean)

  const items = lines.length > 0 ? lines : [raw]
  const hasCorroborar = items.some((i) => /corroborar con cl[ií]nica/i.test(i))
  if (!hasCorroborar) {
    items.push('Corroborar con clínica.')
  }
  return items
}
