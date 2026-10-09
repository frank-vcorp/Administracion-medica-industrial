import type { ClinicalHistoryData } from '@/schemas/clinical/history.schema'

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') {
    const t = value.trim()
    return t.length > 0 && t !== 'NEGADO' && t !== 'NO APLICA'
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>
    if ('estado' in o) {
      const est = String(o.estado ?? '').trim()
      if (est === 'SI') return true
      if (est !== 'NEGADO' && est !== 'NO APLICA' && est.length > 0) return true
      return false
    }
    return Object.values(o).some(isMeaningful)
  }
  return false
}

function formatRecordSection(
  record: Record<string, unknown> | undefined,
  labels: Record<string, string>,
): string {
  if (!record) return 'Sin antecedentes de importancia registrados.'
  const parts: string[] = []
  for (const [key, label] of Object.entries(labels)) {
    const raw = record[key]
    if (!isMeaningful(raw)) continue
    if (typeof raw === 'string') {
      parts.push(`${label}: ${raw}.`)
      continue
    }
    if (typeof raw === 'object' && raw && 'estado' in (raw as object)) {
      const o = raw as { estado?: string; detalle?: Record<string, string> }
      if (o.estado === 'SI' && o.detalle) {
        const d = [
          o.detalle.desde_cuando,
          o.detalle.tratamiento,
          o.detalle.observaciones,
        ]
          .filter(Boolean)
          .join('; ')
        parts.push(`${label}: ${d || 'Sí'}.`)
      } else if (o.estado && o.estado !== 'NEGADO') {
        parts.push(`${label}: ${o.estado}.`)
      }
      continue
    }
    parts.push(`${label}: ${String(raw)}.`)
  }
  if (record.otras_especifique && isMeaningful(record.otras_especifique)) {
    parts.push(`Otras: ${String(record.otras_especifique)}.`)
  }
  return parts.length ? parts.join(' ') : 'Sin antecedentes de importancia registrados.'
}

const HF_LABELS: Record<string, string> = {
  diabetes: 'Diabetes',
  hipertension: 'Hipertensión',
  cancer: 'Cáncer',
  cardiopatias: 'Cardiopatías',
  mentales: 'Trastornos mentales',
  epilepsia: 'Epilepsia',
  tuberculosis: 'Tuberculosis',
  alergias: 'Alergias',
}

function formatDynamicPatologicos(record: Record<string, unknown> | undefined): string {
  const fallback =
    'Crónico-degenerativos, traumáticos y quirúrgicos sin datos adicionales registrados.'
  if (!record) return fallback
  const parts: string[] = []
  for (const [key, raw] of Object.entries(record)) {
    if (key.endsWith('_especifique')) continue
    if (!isMeaningful(raw)) continue
    const label = key.replace(/_/g, ' ')
    if (typeof raw === 'string') {
      parts.push(`${label}: ${raw}.`)
      continue
    }
    if (typeof raw === 'object' && raw && 'estado' in (raw as object)) {
      const o = raw as { estado?: string; detalle?: Record<string, string> }
      if (o.estado === 'SI') {
        const d = [o.detalle?.desde_cuando, o.detalle?.tratamiento, o.detalle?.observaciones]
          .filter(Boolean)
          .join('; ')
        parts.push(`${label}: ${d || 'Sí'}.`)
      } else if (o.estado && o.estado !== 'NEGADO' && o.estado !== 'NO APLICA') {
        parts.push(`${label}: ${o.estado}.`)
      }
    }
  }
  return parts.length ? parts.join(' ') : fallback
}

const NP_LABELS: Record<string, string> = {
  alcohol: 'Alcohol',
  tabaco: 'Tabaco',
  drogas: 'Drogas',
  ejercicio: 'Ejercicio',
  alimentacion: 'Alimentación',
  tatuajes: 'Tatuajes',
}

export function buildAntecedentesNarratives(antecedentes: ClinicalHistoryData | undefined): {
  heredoFamiliares: string
  patologicos: string
  noPatologicos: string
} {
  const hf = formatRecordSection(
    antecedentes?.heredo_familiares as Record<string, unknown> | undefined,
    HF_LABELS,
  )
  const pat = formatDynamicPatologicos(
    antecedentes?.patologicos as Record<string, unknown> | undefined,
  )
  const np = formatRecordSection(
    antecedentes?.no_patologicos as Record<string, unknown> | undefined,
    NP_LABELS,
  )
  return {
    heredoFamiliares: hf,
    patologicos: pat,
    noPatologicos: np,
  }
}

export function buildVitalesLine(
  sv: {
    peso_kg?: string
    talla_m?: string
    imc?: string
    complexion?: string
    ta_sistolica?: string
    ta_diastolica?: string
    fc_min?: string
    fr_min?: string
    temperatura?: string
    spo2_pct?: string
    agudeza_vl?: string
    agudeza_vlc?: string
    agudeza_vc?: string
    agudeza_vcc?: string
  },
): string {
  const v = (s?: string) => (s?.trim() ? s.trim() : '—')
  const ta =
    sv.ta_sistolica?.trim() && sv.ta_diastolica?.trim()
      ? `${sv.ta_sistolica}/${sv.ta_diastolica}`
      : v(sv.ta_sistolica) !== '—'
        ? v(sv.ta_sistolica)
        : v(sv.ta_diastolica)
  const imcPart = sv.imc?.trim()
    ? `${sv.imc} kg/m²${sv.complexion?.trim() ? ` (${sv.complexion})` : ''}`
    : '—'
  return [
    `Peso ${v(sv.peso_kg)} kg`,
    `Talla ${v(sv.talla_m)} m`,
    `IMC ${imcPart}`,
    `TA ${ta} mmHg`,
    `FC ${v(sv.fc_min)} lpm`,
    `FR ${v(sv.fr_min)} rpm`,
    `T ${v(sv.temperatura)} °C`,
    `SpO₂ ${v(sv.spo2_pct)}%`,
    `Agudeza visual VL ${v(sv.agudeza_vl)}, VLC ${v(sv.agudeza_vlc)}, VC ${v(sv.agudeza_vc)}, VCC ${v(sv.agudeza_vcc)}.`,
  ].join('. ') + '.'
}
