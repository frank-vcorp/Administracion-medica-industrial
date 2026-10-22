/** §9 Examen físico REG-SO-01 — tipos compartidos (UI + PDF). */

export type SodexoEfSectionId = '9.1' | '9.2' | '9.3' | '9.4' | '9.5' | '9.6' | '9.7' | '9.8'

/** Visibilidad §9.4 Genitourinario según sexo del paciente (impreso Hombre / Mujer). */
export type SodexoEfSexScope = 'all' | 'male' | 'female'

export type SodexoEfResultado = 'NORMAL' | 'ANORMAL'

/** Signo bilateral (-) / (+). */
export type SodexoEfSigno = 'NEG' | 'POS'

export type SodexoEfRowValue = {
  resultado?: SodexoEfResultado | SodexoEfSigno | null
  desc?: string | null
}

export type SodexoEfPdfNormalAnormal = {
  normal: string
  abnormal: string
  desc?: string
}

export type SodexoEfPdfSignoPar = {
  neg: string
  pos: string
}

export type SodexoEfCatalogEntry = {
  key: string
  section: SodexoEfSectionId
  group: string
  label: string
  kind: 'normal_anormal' | 'signo' | 'texto' | 'check_solo'
  sexScope?: SodexoEfSexScope
  pdf?: SodexoEfPdfNormalAnormal
  signo?: SodexoEfPdfSignoPar
  /** Campo texto AcroForm (§9.8 u observaciones). */
  textField?: string
}

export type SodexoEfSectionDef = {
  id: SodexoEfSectionId
  title: string
  groups: string[]
}
