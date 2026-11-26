import type { ClinicalHistoryData } from '@/schemas/clinical/history.schema'
import { formatCatalogEnumListDisplay } from '@/lib/clinical/enum-display-labels'

function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') {
    const t = value.trim().toUpperCase()
    return t.length > 0 && t !== 'NEGADO' && t !== 'NEGADOS' && t !== 'NO APLICA' && t !== 'DESCONOCE'
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>
    if ('estado' in o) {
      const est = String(o.estado ?? '').trim().toUpperCase()
      if (est === 'SI') return true
      if (est !== 'NEGADO' && est !== 'NEGADOS' && est !== 'NO APLICA' && est.length > 0) return true
      return false
    }
    return Object.values(o).some(isMeaningful)
  }
  return false
}

const HF_LABELS: Record<string, string> = {
  diabetes: 'Diabetes',
  has: 'Hipertensión arterial',
  hipertension: 'Hipertensión arterial',
  cardiopatia: 'Cardiopatías',
  cardiopatias: 'Cardiopatías',
  cancer: 'Cáncer',
  mentales: 'Trastornos mentales',
  epilepsia: 'Epilepsia',
  renales: 'Enfermedad renal',
  asma: 'Asma',
  tuberculosis: 'Tuberculosis',
  alergias: 'Alergias',
  otras: 'Otras patologías',
}

function formatHeredoFamiliares(record: Record<string, unknown> | undefined): string {
  if (!record || Object.keys(record).length === 0) {
    return 'Interrogados y negados. Sin antecedentes heredofamiliares de importancia referidos.'
  }
  const parts: string[] = []
  const handledKeys = new Set<string>()

  for (const [key, label] of Object.entries(HF_LABELS)) {
    if (handledKeys.has(label)) continue
    const raw = record[key]
    const especifique = record[`${key}_especifique`] as string | undefined
    const hasEsp = isMeaningful(especifique)
    const hasRaw = isMeaningful(raw)

    if (!hasRaw && !hasEsp) continue

    handledKeys.add(label)
    if (typeof raw === 'string') {
      const displayVal = formatCatalogEnumListDisplay(raw)
      const isGeneric = raw.trim().toUpperCase() === 'OTROS' || raw.trim().toUpperCase() === 'OTRO'
      if (hasEsp && (isGeneric || !hasRaw)) {
        parts.push(`${label}: ${especifique}.`)
      } else if (hasEsp) {
        parts.push(`${label}: ${displayVal} (${especifique}).`)
      } else {
        parts.push(`${label}: ${displayVal}.`)
      }
      continue
    }
    if (hasEsp) {
      parts.push(`${label}: ${especifique}.`)
    }
  }

  if (record.otras_especifique && isMeaningful(record.otras_especifique) && !handledKeys.has('Otras patologías')) {
    parts.push(`Otras patologías: ${String(record.otras_especifique)}.`)
  }

  return parts.length > 0
    ? parts.join(' ')
    : 'Interrogados y negados. Sin antecedentes heredofamiliares de importancia referidos.'
}

const PATOLOGICOS_LABELS: Record<string, string> = {
  diabetes: 'Diabetes',
  has: 'Hipertensión arterial',
  hipertension: 'Hipertensión arterial',
  cardiopatias: 'Cardiopatías',
  bronquitis: 'Bronquitis',
  ginecologicos: 'Padecimientos ginecológicos',
  varices: 'Várices',
  tuberculosis: 'Tuberculosis',
  endocrinopatias: 'Endocrinopatías',
  colitis: 'Colitis',
  tifoidea: 'Fiebre tifoidea',
  hemorroides: 'Hemorroides',
  vertigo: 'Vértigo',
  parotiditis: 'Parotiditis',
  dermatitis: 'Dermatitis',
  pat_c_vertebral: 'Patología de columna vertebral',
  cirugias: 'Quirúrgicos / Cirugías',
  hepatitis: 'Hepatitis',
  exantematicas: 'Enfermedades exantemáticas',
  gastritis: 'Gastritis',
  renales: 'Padecimientos renales',
  asma: 'Asma',
  cancer: 'Cáncer / Neoplasias',
  traumatismos_craneales: 'Traumatismos craneales',
  desmayos: 'Desmayos / Síncopes',
  fracturas: 'Fracturas',
  neumonias: 'Neumonías',
  enf_trans_sexual: 'Infecciones de transmisión sexual',
  transfusiones: 'Transfusiones',
  alergias: 'Alergias',
  psiquiatricas: 'Padecimientos psiquiátricos',
  migrana: 'Migraña',
  otras: 'Otras patologías',
}

function formatDynamicPatologicos(record: Record<string, unknown> | undefined): string {
  const fallback =
    'Crónico-degenerativos, quirúrgicos, traumáticos y alérgicos interrogados y negados.'
  if (!record || Object.keys(record).length === 0) return fallback
  const parts: string[] = []

  for (const [key, raw] of Object.entries(record)) {
    if (key.endsWith('_especifique') || key === 'otras_enfermedades') continue
    if (!isMeaningful(raw)) continue
    const label = PATOLOGICOS_LABELS[key] || key.replace(/_/g, ' ')

    if (typeof raw === 'string') {
      const s = raw.trim()
      if (s.toUpperCase() === 'SI') {
        parts.push(`${label}: Sí.`)
      } else {
        parts.push(`${label}: ${s}.`)
      }
      continue
    }

    if (typeof raw === 'object' && raw && 'estado' in (raw as object)) {
      const o = raw as { estado?: string; detalle?: Record<string, string> }
      if (String(o.estado ?? '').trim().toUpperCase() === 'SI') {
        const d = [
          o.detalle?.especificacion?.trim(),
          o.detalle?.desde_cuando?.trim() ? `desde hace ${o.detalle.desde_cuando.trim()}` : '',
          o.detalle?.tratamiento?.trim() ? `en tratamiento con ${o.detalle.tratamiento.trim()}` : '',
          o.detalle?.observaciones?.trim(),
        ]
          .filter(Boolean)
          .join(', ')
        parts.push(`${label}: ${d ? `Sí (${d})` : 'Sí'}.`)
      } else if (o.estado && !['NEGADO', 'NEGADOS', 'NO APLICA'].includes(String(o.estado).toUpperCase())) {
        parts.push(`${label}: ${o.estado}.`)
      }
    }
  }

  if (Array.isArray(record.otras_enfermedades) && record.otras_enfermedades.length > 0) {
    const listStr = (record.otras_enfermedades as unknown[])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join(', ')
    if (listStr && !parts.some((p) => p.startsWith('Otras patologías'))) {
      parts.push(`Otras patologías: ${listStr}.`)
    }
  }

  return parts.length ? parts.join(' ') : fallback
}

function formatNoPatologicos(record: Record<string, unknown> | undefined): string {
  if (!record || Object.keys(record).length === 0) {
    return 'Hábitos higiénico-dietéticos y toxicomanías interrogados y negados.'
  }
  const parts: string[] = []

  const alcohol = String(record.alcohol ?? '').toUpperCase()
  if (alcohol === 'SI') {
    const frec = typeof record.alcohol_frecuencia === 'string' && record.alcohol_frecuencia.trim()
    const susp = String(record.alcohol_suspendido ?? '').toUpperCase() === 'SI'
    const tsusp =
      typeof record.alcohol_tiempo_suspendido === 'string' && record.alcohol_tiempo_suspendido.trim()
    const extra = susp ? `suspendido hace ${tsusp || 'tiempo'}` : frec || ''
    parts.push(`Alcohol: Sí${extra ? ` (${extra})` : ''}.`)
  }

  const tabaco = String(record.tabaco ?? '').toUpperCase()
  if (tabaco === 'SI') {
    const cigs = record.tabaco_cigarros_dia ? `${record.tabaco_cigarros_dia} cig/día` : ''
    const frec = typeof record.tabaco_frecuencia === 'string' && record.tabaco_frecuencia.trim()
    const susp = String(record.tabaco_suspendido ?? '').toUpperCase() === 'SI'
    const tsusp =
      typeof record.tabaco_tiempo_suspendido === 'string' && record.tabaco_tiempo_suspendido.trim()
    const extra = susp ? `suspendido hace ${tsusp || 'tiempo'}` : [cigs, frec].filter(Boolean).join(', ')
    parts.push(`Tabaco: Sí${extra ? ` (${extra})` : ''}.`)
  }

  const drogas = String(record.drogas_estimulantes ?? record.drogas ?? '').toUpperCase()
  if (drogas === 'SI') {
    const esp = typeof record.drogas_especifique === 'string' && record.drogas_especifique.trim()
    parts.push(`Drogas / Sustancias: Sí${esp ? ` (${esp})` : ''}.`)
  }

  if (alcohol !== 'SI' && tabaco !== 'SI' && drogas !== 'SI') {
    parts.push('Toxicomanías (alcohol, tabaco, drogas) interrogadas y negadas.')
  }

  if (record.alimentacion && typeof record.alimentacion === 'string') {
    const al = record.alimentacion.trim().toUpperCase()
    if (al && al !== 'DESCONOCE') {
      parts.push(`Alimentación: ${formatCatalogEnumListDisplay(record.alimentacion)} en calidad y cantidad.`)
    }
  }

  const ej = String(record.ejercicio ?? '').toUpperCase()
  if (ej === 'SI') {
    const frec = typeof record.ejercicio_frecuencia === 'string' && record.ejercicio_frecuencia.trim()
    parts.push(`Actividad física: Sí${frec ? ` (${frec})` : ''}.`)
  }

  if (record.grupo_y_rh && typeof record.grupo_y_rh === 'string') {
    const gr = record.grupo_y_rh.trim()
    if (gr && gr.toUpperCase() !== 'DESCONOCE') {
      parts.push(`Grupo sanguíneo y Rh: ${gr}.`)
    }
  }

  const tx = String(record.tratamiento_medico_actual ?? '').toUpperCase()
  if (tx === 'SI') {
    const esp =
      typeof record.tratamiento_medico_actual_especifique === 'string' &&
      record.tratamiento_medico_actual_especifique.trim()
    parts.push(`Tratamiento médico actual: Sí${esp ? ` (${esp})` : ''}.`)
  }

  const tat = String(record.tatuajes ?? '').toUpperCase()
  if (tat === 'SI') {
    const esp = typeof record.tatuajes_especifique === 'string' && record.tatuajes_especifique.trim()
    parts.push(`Tatuajes / Perforaciones: Sí${esp ? ` (${esp})` : ''}.`)
  }

  return parts.length
    ? parts.join(' ')
    : 'Hábitos higiénico-dietéticos y toxicomanías interrogados y negados.'
}

export function buildAntecedentesNarratives(antecedentes: ClinicalHistoryData | undefined): {
  heredoFamiliares: string
  patologicos: string
  noPatologicos: string
} {
  return {
    heredoFamiliares: formatHeredoFamiliares(
      antecedentes?.heredo_familiares as Record<string, unknown> | undefined,
    ),
    patologicos: formatDynamicPatologicos(
      antecedentes?.patologicos as Record<string, unknown> | undefined,
    ),
    noPatologicos: formatNoPatologicos(
      antecedentes?.no_patologicos as Record<string, unknown> | undefined,
    ),
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
