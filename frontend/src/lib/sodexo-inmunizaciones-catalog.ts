/**
 * §6 INMUNIZACIONES — rejilla REG-SO-01 (captura extensión Sodexo).
 */

export type SodexoInmunizacionKey =
  | 'tetanos'
  | 'hepatitis'
  | 'influenza_estacional'
  | 'covid_19'
  | 'hepatitis_ab'
  | 'neumococica'

export type SodexoInmunizacionFila = {
  estado?: 'NEGADO' | 'SI' | null
  fecha?: string | null
  imss?: string | null
  ssa?: string | null
  otros?: string | null
  marca?: string | null
}

export type SodexoInmunizacionesSodexo = {
  observaciones?: string | null
  filas?: Partial<Record<SodexoInmunizacionKey, SodexoInmunizacionFila>> | null
}

export type SodexoInmunizacionCatalogEntry = {
  key: SodexoInmunizacionKey
  label: string
  section: 'basica' | 'complementaria'
  marca?: boolean
  amiKey?: string
  pdf: {
    checkNo?: string
    checkSi: string
    fecha?: string
    imss?: string
    ssa?: string
    otros?: string
    marca?: string
  }
}

export const SODEXO_INMUNIZACIONES_CATALOG: SodexoInmunizacionCatalogEntry[] = [
  {
    key: 'tetanos',
    label: 'Tétanos',
    section: 'basica',
    amiKey: 'm1_vac_toxoide',
    pdf: {
      checkSi: 'Check Box544',
      fecha: 'Texto578',
      imss: 'Texto579',
      ssa: 'Texto576',
      otros: 'Texto574',
    },
  },
  {
    key: 'hepatitis',
    label: 'Hepatitis',
    section: 'basica',
    amiKey: 'm1_vac_hepatitisb',
    pdf: {
      checkSi: 'Check Box560',
      fecha: 'Texto575',
      imss: 'Texto573',
      ssa: 'Texto571',
      otros: 'Texto572',
    },
  },
  {
    key: 'influenza_estacional',
    label: 'Influenza estacional',
    section: 'basica',
    amiKey: 'm1_vac_influenza',
    pdf: {
      checkSi: 'Check Box559',
      fecha: 'Texto577',
    },
  },
  {
    key: 'covid_19',
    label: 'COVID-19',
    section: 'complementaria',
    marca: true,
    pdf: {
      checkSi: 'Check Box561',
      marca: 'Texto472',
    },
  },
  {
    key: 'hepatitis_ab',
    label: 'Hepatitis A y B',
    section: 'complementaria',
    pdf: {
      checkSi: 'Check Box558',
    },
  },
  {
    key: 'neumococica',
    label: 'Neumocócica',
    section: 'complementaria',
    amiKey: 'm1_vac_neumococo',
    pdf: {
      checkSi: 'Check Box553',
    },
  },
]

export function inmunizacionesSodexoIsEmpty(data: SodexoInmunizacionesSodexo | null | undefined): boolean {
  if (!data) return true
  if ((data.observaciones ?? '').trim()) return false
  const filas = data.filas ?? {}
  return !SODEXO_INMUNIZACIONES_CATALOG.some((row) => {
    const f = filas[row.key]
    return f?.estado === 'NEGADO' || f?.estado === 'SI'
  })
}
