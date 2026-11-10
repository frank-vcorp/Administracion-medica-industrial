/**
 * Antecedentes personales patológicos / no patológicos — formato consulta (Dra. Jacky):
 * seis rubros de texto libre para la nota clínica.
 */

export const CONSULTA_ANTECEDENTES_RUBROS = [
  {
    key: 'cronico_degenerativos',
    label: 'Crónico-degenerativos',
    hint: 'Diabetes, HAS, cardiopatías, EPOC, etc.',
  },
  {
    key: 'traumaticos',
    label: 'Traumáticos',
    hint: 'Fracturas, traumatismos, accidentes con secuela.',
  },
  {
    key: 'quirurgicos',
    label: 'Quirúrgicos',
    hint: 'Cirugías previas relevantes.',
  },
  {
    key: 'transfusionales',
    label: 'Transfusionales',
    hint: 'Transfusiones sanguíneas previas.',
  },
  {
    key: 'alergicos',
    label: 'Alérgicos',
    hint: 'Medicamentos, alimentos, látex, etc.',
  },
  {
    key: 'toxicomanias',
    label: 'Toxicomanías',
    hint: 'Alcohol, tabaco, otras sustancias.',
  },
] as const

export type ConsultaAntecedentesKey = (typeof CONSULTA_ANTECEDENTES_RUBROS)[number]['key']

export type AntecedentesConsultaResumen = Record<ConsultaAntecedentesKey, string>

export function emptyAntecedentesConsultaResumen(): AntecedentesConsultaResumen {
  return {
    cronico_degenerativos: '',
    traumaticos: '',
    quirurgicos: '',
    transfusionales: '',
    alergicos: '',
    toxicomanias: '',
  }
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function patologiaLine(label: string, raw: unknown): string | null {
  if (typeof raw === 'string') {
    const s = raw.trim().toUpperCase()
    if (!s || s === 'NEGADO' || s === 'NO APLICA') return null
    return `${label}: ${raw.trim()}`
  }
  if (raw && typeof raw === 'object' && 'estado' in (raw as object)) {
    const o = raw as { estado?: string; detalle?: Record<string, string> }
    const est = str(o.estado).toUpperCase()
    if (est !== 'SI') return null
    const d = [o.detalle?.desde_cuando, o.detalle?.tratamiento, o.detalle?.observaciones]
      .map(str)
      .filter(Boolean)
      .join('; ')
    return d ? `${label}: ${d}` : `${label}: Sí`
  }
  return null
}

function joinLines(lines: string[]): string {
  return lines.filter(Boolean).join('\n')
}

function readSiNp(
  np: Record<string, unknown>,
  toggle: string,
  especifique: string,
  label: string,
): string | null {
  const est = str(np[toggle]).toUpperCase()
  if (est !== 'SI') return null
  const det = str(np[especifique])
  return det ? `${label}: ${det}` : `${label}: Sí`
}

const CRONICO_FIELDS: { field: string; label: string }[] = [
  { field: 'diabetes', label: 'Diabetes' },
  { field: 'has', label: 'Hipertensión' },
  { field: 'cardiopatias', label: 'Cardiopatías' },
  { field: 'asma', label: 'Asma' },
  { field: 'endocrinopatias', label: 'Endocrinopatías' },
  { field: 'bronquitis', label: 'Bronquitis' },
  { field: 'neumonias', label: 'Neumonías' },
  { field: 'tuberculosis', label: 'Tuberculosis' },
  { field: 'epilepsia', label: 'Epilepsia' },
  { field: 'gastritis', label: 'Gastritis' },
  { field: 'colitis', label: 'Colitis' },
  { field: 'renales', label: 'Renales' },
  { field: 'cancer', label: 'Cáncer' },
  { field: 'psiquiatricas', label: 'Psiquiátricas' },
  { field: 'dermatitis', label: 'Dermatitis' },
  { field: 'ginecologicos', label: 'Ginecológicos' },
]

/**
 * Sugiere texto para los 6 rubros a partir del historial / captura estructurada (sin sobrescribir lo ya editado).
 */
export function suggestAntecedentesConsultaFromProfile(
  antecedentes: Record<string, unknown> | null | undefined,
): AntecedentesConsultaResumen {
  const pat = (antecedentes?.patologicos ?? {}) as Record<string, unknown>
  const np = (antecedentes?.no_patologicos ?? {}) as Record<string, unknown>

  const cronico: string[] = []
  for (const { field, label } of CRONICO_FIELDS) {
    const line = patologiaLine(label, pat[field])
    if (line) cronico.push(line)
  }

  const traumatic: string[] = []
  for (const { field, label } of [
    { field: 'fracturas', label: 'Fracturas' },
    { field: 'traumatismos_craneales', label: 'Traumatismos' },
  ]) {
    const line = patologiaLine(label, pat[field])
    if (line) traumatic.push(line)
  }

  const quir = patologiaLine('Cirugías', pat.cirugias)
  const transf = patologiaLine('Transfusiones', pat.transfusiones)
  const alerg = patologiaLine('Alergias', pat.alergias)

  const tox: string[] = []
  for (const [toggle, esp, label] of [
    ['alcohol', 'alcohol_especifique', 'Alcohol'],
    ['tabaco', 'tabaco_especifique', 'Tabaco'],
    ['drogas_estimulantes', 'drogas_especifique', 'Drogas'],
  ] as const) {
    const line = readSiNp(np, toggle, esp, label)
    if (line) tox.push(line)
  }

  return {
    cronico_degenerativos: joinLines(cronico) || 'Negados.',
    traumaticos: joinLines(traumatic) || 'Negados.',
    quirurgicos: quir ?? 'Negados.',
    transfusionales: transf ?? 'Negados.',
    alergicos: alerg ?? 'Negados.',
    toxicomanias: joinLines(tox) || 'Negados.',
  }
}

export function mergeAntecedentesConsultaResumen(
  saved: unknown,
  fallback: AntecedentesConsultaResumen,
): AntecedentesConsultaResumen {
  const base = emptyAntecedentesConsultaResumen()
  const empty = (v: string) => !v.trim()
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    const o = saved as Record<string, unknown>
    for (const { key } of CONSULTA_ANTECEDENTES_RUBROS) {
      base[key] = str(o[key])
    }
  }
  const allBlank = CONSULTA_ANTECEDENTES_RUBROS.every(({ key }) => empty(base[key]))
  if (allBlank) return { ...fallback }
  return base
}

export function hasAntecedentesConsultaContent(resumen: AntecedentesConsultaResumen): boolean {
  return CONSULTA_ANTECEDENTES_RUBROS.some(({ key }) => resumen[key].trim().length > 0)
}
