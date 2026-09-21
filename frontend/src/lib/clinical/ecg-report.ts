/**
 * Texto del informe AMI de electrocardiograma (RD2026 / plantilla reposo).
 */

export type EcgExtracted = {
  ritmo?: string | null
  frecuencia_bpm?: number | null
  intervalo_pr_ms?: number | null
  duracion_p_ms?: number | null
  duracion_qrs_ms?: number | null
  qtc_ms?: number | null
  eje_electrico?: string | null
  hallazgos?: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

/** Lee `ElectrocardiogramaData` desde structuredData del snapshot de extracción. */
export function parseEcgFromExtraction(extractionStructuredData: unknown): EcgExtracted | null {
  const root = asRecord(extractionStructuredData)
  if (!root) return null
  const data = asRecord(root.extracted_data) ?? root

  const hallazgosRaw = data.hallazgos
  const hallazgos = Array.isArray(hallazgosRaw)
    ? hallazgosRaw.map(h => String(h).trim()).filter(Boolean)
    : []

  const parsed: EcgExtracted = {
    ritmo: asString(data.ritmo),
    frecuencia_bpm: asInt(data.frecuencia_bpm),
    intervalo_pr_ms: asInt(data.intervalo_pr_ms),
    duracion_p_ms: asInt(data.duracion_p_ms),
    duracion_qrs_ms: asInt(data.duracion_qrs_ms),
    qtc_ms: asInt(data.qtc_ms),
    eje_electrico: asString(data.eje_electrico),
    hallazgos,
  }

  const hasAny =
    parsed.ritmo ||
    parsed.frecuencia_bpm != null ||
    parsed.intervalo_pr_ms != null ||
    parsed.duracion_qrs_ms != null ||
    parsed.qtc_ms != null ||
    hallazgos.length > 0

  return hasAny ? parsed : null
}

function formatRitmoPhrase(ritmo: string | null | undefined): string {
  if (!ritmo) return 'ritmo no especificado'
  const r = ritmo.trim()
  if (/sinusal/i.test(r)) return `Ritmo ${r.charAt(0).toUpperCase()}${r.slice(1).toLowerCase()}`
  return r
}

function formatEje(eje: string | null | undefined): string {
  if (!eje) return '—'
  const t = eje.trim()
  const deg = t.match(/-?\d+/)
  if (deg) return `${deg[0]}°`
  return t
}

/** Párrafo morfológico/narrativo (RD2026). `morphologicOverride` = notas del médico. */
export function buildEcgNarrativeParagraph(
  ecg: EcgExtracted | null,
  morphologicOverride?: string | null,
): string {
  const override = (morphologicOverride ?? '').trim()
  if (override) return override

  if (!ecg) {
    return 'Electrocardiograma en reposo. Correlacionar con exploración física y antecedentes del paciente.'
  }

  const parts: string[] = []
  parts.push('Electrocardiograma rítmico, en')
  parts.push(formatRitmoPhrase(ecg.ritmo))

  if (ecg.frecuencia_bpm != null) {
    parts.push(`, con Frecuencia Cardiaca de ${ecg.frecuencia_bpm} lpm`)
  }

  if (ecg.duracion_p_ms != null) {
    parts.push(`, Onda P de ${ecg.duracion_p_ms} ms`)
  }

  if (ecg.duracion_qrs_ms != null) {
    const eje = formatEje(ecg.eje_electrico)
    parts.push(
      `, seguidas de QRS de ${ecg.duracion_qrs_ms} ms` +
        (eje !== '—' ? ` con Eje Cardiaco a ${eje}` : ''),
    )
  } else if (ecg.eje_electrico) {
    parts.push(`, con Eje Cardiaco ${ecg.eje_electrico}`)
  }

  if (ecg.intervalo_pr_ms != null) {
    parts.push(`. Intervalo PR de ${ecg.intervalo_pr_ms} ms`)
  }

  if (ecg.qtc_ms != null) {
    parts.push(`. QT corregido de ${ecg.qtc_ms} ms`)
  }

  if (ecg.hallazgos && ecg.hallazgos.length > 0) {
    parts.push(`. Hallazgos del equipo: ${ecg.hallazgos.join('; ')}`)
  } else {
    parts.push(
      '. Segmento ST isoeléctrico, sin alteraciones significativas reportadas por el equipo. Correlacionar morfología en trazado archivado.',
    )
  }

  let text = parts.join('')
  if (!text.endsWith('.')) text += '.'
  return text
}

/** Ítems bajo «DIAGNÓSTICO ELECTROCARDIOGRÁFICO». */
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
    .map(l => l.replace(/^\s*\d+[\).\-\s]+/, '').trim())
    .filter(Boolean)

  const items = lines.length > 0 ? lines : [raw]
  const hasCorroborar = items.some(i => /corroborar con cl[ií]nica/i.test(i))
  if (!hasCorroborar) {
    items.push('Corroborar con clínica.')
  }
  return items
}
