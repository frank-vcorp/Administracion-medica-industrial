import { readHeredoFamiliaresDisplay } from '@/lib/antecedentes-fields'
import type { ExamenMedicoPDFData } from '@/components/pdf/ExamenMedicoValidatedPDF'

/** Claves alineadas a las 10 filas del §4 HEREDOFAMILIAR (REG-SO-01). */
export const SODEXO_HEREDOFAMILIAR_KEYS = [
  'diabetes',
  'cardiovascular',
  'cancer',
  'respiratorios',
  'tbc',
  'reumatologicos',
  'neurologicos',
  'mentales',
  'digestivos',
  'otros',
] as const

export type SodexoHeredofamiliarKey = (typeof SODEXO_HEREDOFAMILIAR_KEYS)[number]

export type SodexoHeredofamiliarRow = {
  respuesta?: 'NO' | 'SI' | null
  parentesco?: string | null
}

export type SodexoHeredofamiliarMap = Partial<Record<SodexoHeredofamiliarKey, SodexoHeredofamiliarRow>>

export const SODEXO_HEREDOFAMILIAR_LEFT: { key: SodexoHeredofamiliarKey; label: string }[] = [
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'cardiovascular', label: 'Cardiovascular' },
  { key: 'cancer', label: 'Cáncer' },
  { key: 'respiratorios', label: 'Respiratorios' },
  { key: 'tbc', label: 'TBC' },
]

export const SODEXO_HEREDOFAMILIAR_RIGHT: { key: SodexoHeredofamiliarKey; label: string }[] = [
  { key: 'reumatologicos', label: 'Reumatológicos' },
  { key: 'neurologicos', label: 'Neurológicos' },
  { key: 'mentales', label: 'Mentales' },
  { key: 'digestivos', label: 'Digestivos' },
  { key: 'otros', label: 'Otros' },
]

function s(v: string | null | undefined): string {
  return (v ?? '').trim()
}

/** Convierte fila Sodexo → texto para `parseHf` / PDF (No/Sí + parentesco). */
export function sodexoHeredofamiliarRowToDisplay(
  row: SodexoHeredofamiliarRow | null | undefined,
): string | null {
  if (!row?.respuesta) return null
  if (row.respuesta === 'NO') return 'NEGADOS'
  const p = s(row.parentesco)
  return p || 'SI'
}

export function heredofamiliarSodexoIsEmpty(map: SodexoHeredofamiliarMap | null | undefined): boolean {
  if (!map) return true
  return SODEXO_HEREDOFAMILIAR_KEYS.every((k) => !map[k]?.respuesta)
}

function amiDisplayToRow(display: string): SodexoHeredofamiliarRow | null {
  const raw = s(display)
  if (!raw) return null
  const u = raw.toUpperCase()
  if (u === 'NEGADOS' || u === 'NEGADO' || u === 'NO APLICA' || u === 'NO') {
    return { respuesta: 'NO', parentesco: '' }
  }
  return { respuesta: 'SI', parentesco: raw }
}

function mergeAmiRows(...displays: string[]): SodexoHeredofamiliarRow | null {
  const rows = displays.map(amiDisplayToRow).filter(Boolean) as SodexoHeredofamiliarRow[]
  const positive = rows.filter((r) => r.respuesta === 'SI')
  if (positive.length === 0) {
    const neg = rows.find((r) => r.respuesta === 'NO')
    return neg ?? null
  }
  const parentesco = positive.map((r) => s(r.parentesco)).filter(Boolean).join('; ')
  return { respuesta: 'SI', parentesco }
}

/** Sugiere filas §4 desde Antecedentes AMI (solo referencia / prellenado). */
export function prefillHeredofamiliarFromAmi(
  antecedentesCaptured: Record<string, unknown> | null | undefined,
): SodexoHeredofamiliarMap {
  const hf = (antecedentesCaptured?.heredo_familiares as Record<string, unknown>) ?? {}
  const read = (field: string) => readHeredoFamiliaresDisplay(hf, field)

  const out: SodexoHeredofamiliarMap = {}
  const put = (key: SodexoHeredofamiliarKey, row: SodexoHeredofamiliarRow | null) => {
    if (row) out[key] = row
  }

  put('diabetes', amiDisplayToRow(read('diabetes')))
  put(
    'cardiovascular',
    mergeAmiRows(read('has'), read('cardiopatia')),
  )
  put('cancer', amiDisplayToRow(read('cancer')))
  put('respiratorios', amiDisplayToRow(read('asma')))
  put('neurologicos', amiDisplayToRow(read('epilepsia')))
  put('mentales', amiDisplayToRow(read('mentales')))
  put('otros', amiDisplayToRow(read('otras')))

  return out
}

/** Respaldo PDF cuando la extensión no tiene respuesta en esa fila. */
export function amiAhfFallbackDisplay(
  data: ExamenMedicoPDFData,
  key: SodexoHeredofamiliarKey,
): string | null | undefined {
  const ahf = data.ahf
  switch (key) {
    case 'diabetes':
      return ahf.diabetes
    case 'cardiovascular': {
      const parts = [ahf.hipertension, ahf.cardiopatia].filter((x) => s(x) && !isNegadoDisplay(x))
      if (parts.length === 0) return ahf.hipertension ?? ahf.cardiopatia
      return parts.join('; ')
    }
    case 'cancer':
      return ahf.cancer
    case 'respiratorios':
      return ahf.asma
    case 'tbc':
      return null
    case 'reumatologicos':
      return null
    case 'neurologicos':
      return ahf.epilepsia
    case 'mentales':
      return ahf.mentales
    case 'digestivos':
      return null
    case 'otros':
      return ahf.otras
    default:
      return null
  }
}

function isNegadoDisplay(display: string | null | undefined): boolean {
  const u = s(display).toUpperCase()
  return !u || u === 'NEGADOS' || u === 'NEGADO' || u === 'NO APLICA' || u === 'NO'
}

export function resolveHeredofamiliarPdfDisplay(
  extRow: SodexoHeredofamiliarRow | null | undefined,
  data: ExamenMedicoPDFData,
  key: SodexoHeredofamiliarKey,
): string | null | undefined {
  const fromExt = sodexoHeredofamiliarRowToDisplay(extRow)
  if (fromExt != null) return fromExt
  const ami = amiAhfFallbackDisplay(data, key)
  if (ami != null && s(ami)) return ami
  return null
}
