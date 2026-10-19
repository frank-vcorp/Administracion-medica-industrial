/**
 * Mapeo AcroForm REG-SO-01 ↔ datos AMI/Sodexo.
 * Calibrado contra `sodexo-examen-medico-template.pdf` (907 campos).
 */

export type SodexoHfRowMap = {
  /** Campo texto parentesco (columna izq. o der.) */
  text: string
  checkNo: string
  checkSi: string
}

/** Sección 4 — Heredofamiliar (pares No/Si por fila). */
export const SODEXO_AHF_LEFT: SodexoHfRowMap[] = [
  { text: 'Texto530', checkNo: 'Check Box332', checkSi: 'Check Box333' }, // Diabetes
  { text: 'Texto531', checkNo: 'Check Box334', checkSi: 'Check Box335' }, // Cardiovascular
  { text: 'Texto532', checkNo: 'Check Box336', checkSi: 'Check Box337' }, // Cáncer
  { text: 'Texto533', checkNo: 'Check Box338', checkSi: 'Check Box339' }, // Respiratorios
  { text: 'Texto534', checkNo: 'Check Box340', checkSi: 'Check Box341' }, // TBC
]

export const SODEXO_AHF_RIGHT: SodexoHfRowMap[] = [
  { text: 'Texto535', checkNo: 'Check Box342', checkSi: 'Check Box343' }, // Reumatológicos
  { text: 'Texto536', checkNo: 'Check Box344', checkSi: 'Check Box345' }, // Neurológicos
  { text: 'Texto537', checkNo: 'Check Box346', checkSi: 'Check Box347' }, // Mentales
  { text: 'Texto538', checkNo: 'Check Box348', checkSi: 'Check Box349' }, // Digestivos
  { text: 'Texto539', checkNo: 'Check Box350', checkSi: 'Check Box351' }, // Otros
]

/** Claves `ahf` en orden de filas izquierdas / derechas del PDF. */
export const SODEXO_AHF_LEFT_KEYS = [
  'diabetes',
  'hipertension',
  'cancer',
  'asma',
  '_tbc',
] as const

export const SODEXO_AHF_RIGHT_KEYS = [
  '_reuma',
  'epilepsia',
  'mentales',
  '_digestivos',
  'otras',
] as const

/** 1.2 Funciones principales (checkboxes en página 1). */
export const SODEXO_FUNCIONES_CHECKBOXES = {
  administrativa: 'Check Box66',
  ayudante: 'Check Box67',
  mantenimiento: 'Check Box68',
  tecnica: 'Check Box69',
  telefono: 'Check Box70',
  conduccion: 'Check Box71',
} as const

/** §1.2 — especificación cuando la función no es una de las casillas estándar. */
export const SODEXO_FUNCIONES_OTRO_TEXT = 'Cual'

/** Escolaridad (página 1, bloque identificación). */
export const SODEXO_ESCOLARIDAD_CHECKS = {
  basica: 'Check Box14',
  media: 'Check Box15',
  tecnica: 'Check Box16',
  universidad: 'Check Box17',
  postgrado: 'Check Box25',
} as const

/** Exploración 9.x — campos texto (página 3 del PDF). */
export const SODEXO_EXPLORACION_TEXT: Record<string, string> = {
  neurologico: 'Texto880',
  cabeza: 'Texto881',
  piel_y_faneras: 'Texto882',
  genitourinario: 'Texto883',
  ojos: 'Texto884',
  boca_faringe: 'Texto885',
  cuello: 'Texto886',
  torax: 'Texto887',
  corazon_pulmones: 'Texto888',
  abdomen: 'Texto889',
  oidos_cad: 'Texto890',
  oidos_cai: 'Texto891',
  nariz: 'Texto892',
  columna_vertebral: 'Texto913',
  ms_inferiores: 'Claudicación',
  ms_superiores: 'Ayudas',
  salud_bucal: 'Texto648',
}

export const SODEXO_VISIOMETRIA_TEXT = {
  lejanaOD: 'Texto649',
  lejanaOI: 'Texto650',
  lejanaCorregidaOD: 'Texto651',
  lejanaCorregidaOI: 'Texto652',
  cercanaOD: 'Texto653',
  cercanaOI: 'Texto654',
  cercanaCorregidaOD: 'Texto655',
  cercanaCorregidaOI: 'Texto656',
  observaciones: 'Texto657',
} as const

export const SODEXO_DIAGNOSTICOS_TEXT = [
  'Texto35',
  'Texto36',
  'Texto37',
  'Texto38',
  'Texto39',
] as const

export const SODEXO_RESTRICCIONES_TEXT = ['Texto40', 'Texto41', 'Texto42'] as const
