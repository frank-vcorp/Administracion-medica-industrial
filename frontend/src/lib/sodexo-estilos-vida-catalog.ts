/** §8 ESTILOS DE VIDA — opciones alineadas al REG-SO-01. */

export type SodexoTabacoOpcion = 'NO' | 'SI' | 'EVENTUAL' | 'HABITUAL' | 'COMPULSIVO'
export type SodexoTabacoAnios = '1_5' | '6_10' | '11_20' | 'MAS_20'
export type SodexoTabacoDejoHace = 'MENOS_1' | '1_5' | '6_10' | 'MAS_10'

export type SodexoEstilosVidaSodexo = {
  tabaco_opcion?: SodexoTabacoOpcion | null
  /** @deprecated usar `tabaco_opcion` */
  tabaco_intensidad?: 'EVENTUAL' | 'HABITUAL' | 'COMPULSIVO' | 'EXFUMADOR' | null
  tabaco_anios_habito?: SodexoTabacoAnios | null
  /** @deprecated usar `tabaco_anios_habito` */
  tabaco_anios?: SodexoTabacoAnios | null
  tabaco_exfumador?: boolean | null
  tabaco_dejo_hace?: SodexoTabacoDejoHace | null
  alcohol?: 'NO' | 'SI' | null
  alcohol_ocasional?: string | null
  /** @deprecated */
  alcohol_modo?: 'OCASIONAL' | 'FRECUENTE' | null
  drogas?: 'NO' | 'SI' | null
  drogas_tipo?: string | null
}

export const SODEXO_ESTILOS_VIDA_PDF = {
  tabaco: {
    no: 'Check Box545',
    si: 'Check Box546',
    eventual: 'Check Box547',
    habitual: 'Check Box548',
    compulsivo: 'Check Box549',
    anios: {
      '1_5': 'Check Box568',
      '6_10': 'Check Box569',
      '11_20': 'Check Box566',
      MAS_20: 'Check Box563',
    },
    exfumador: 'Check Box567',
    dejo: {
      MENOS_1: 'Check Box564',
      '1_5': 'Check Box565',
      '6_10': 'Check Box552',
      MAS_10: 'Check Box554',
    },
  },
  alcohol: {
    no: 'Check Box550',
    si: 'Check Box551',
    ocasional: 'Check Box559',
    ocasionalText: 'Ocasional',
  },
  drogas: {
    no: 'Check Box556',
    si: 'Check Box557',
    tipoText: 'Tipo de droga',
  },
} as const

export function estilosVidaSodexoIsEmpty(ev: SodexoEstilosVidaSodexo | null | undefined): boolean {
  if (!ev) return true
  if (ev.tabaco_opcion || ev.tabaco_intensidad || ev.tabaco_anios_habito || ev.tabaco_anios) return false
  if (ev.tabaco_exfumador || ev.tabaco_dejo_hace) return false
  if (ev.alcohol || ev.alcohol_modo) return false
  if ((ev.alcohol_ocasional ?? '').trim()) return false
  if (ev.drogas) return false
  if ((ev.drogas_tipo ?? '').trim()) return false
  return true
}
