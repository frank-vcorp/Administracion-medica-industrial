/**
 * Rejilla REG-SO-01 (9 filas × 4 columnas) — mismo orden que `generate-sodexo-matriz-map.ts`.
 */
const SODEXO_MATRIZ_GRID: readonly (readonly string[])[] = [
  ['calor', 'neblinas', 'incendio', 'atencion_publico'],
  ['frio', 'humos', 'explosion', 'monotonia'],
  ['alta_iluminacion', 'polvos', 'sentado_prolongado', 'sobrecarga'],
  ['baja_iluminacion', 'liquidos', 'de_pie_prolongado', 'psicosocial_laboral'],
  ['presion', 'gases', 'movimientos_repetitivos', 'turnos'],
  ['rad_no_ionizante', 'vapores', 'levantamiento_cargas', 'alto_ritmo_laboral'],
  ['rad_ionizante', 'contacto', 'cont_electrico_directo', 'conflicto_interpersonal'],
  ['ruido', 'producto_quimico', 'cont_electrico_indirecto', 'ergonomico_fq'],
  ['vibracion', 'quimico', 'carga_estatica', 'monotonia_psicosocial'],
]

function columnFactorIds(col: 0 | 1 | 2 | 3): string[] {
  return SODEXO_MATRIZ_GRID.map((row) => row[col])
}

export type SodexoMatrizSectionBlock = {
  label: string
  factorIds: string[]
}

export type SodexoMatrizSection = {
  id: string
  /** Título vertical en el panel (como el impreso). */
  title: string
  factorIds?: string[]
  /** Tercer panel: FQc, Ergonóm., Eléct. */
  blocks?: SodexoMatrizSectionBlock[]
}

/** Cuatro paneles de la matriz §3 (títulos verticales). */
export const SODEXO_MATRIZ_SECTIONS: SodexoMatrizSection[] = [
  { id: 'fisico', title: 'Físico', factorIds: columnFactorIds(0) },
  { id: 'quimico', title: 'Químico', factorIds: columnFactorIds(1) },
  {
    id: 'fq_erg_elec',
    title: 'FQc · Ergonóm. · Eléct.',
    blocks: [
      { label: 'FQc', factorIds: ['incendio', 'explosion'] },
      {
        label: 'Ergonóm.',
        factorIds: [
          'sentado_prolongado',
          'de_pie_prolongado',
          'movimientos_repetitivos',
          'levantamiento_cargas',
        ],
      },
      {
        label: 'Eléct.',
        factorIds: [
          'cont_electrico_directo',
          'cont_electrico_indirecto',
          'carga_estatica',
        ],
      },
    ],
  },
  { id: 'psicosocial', title: 'Psicosocial', factorIds: columnFactorIds(3) },
]

export function matrizSectionFactorIds(section: SodexoMatrizSection): string[] {
  if (section.factorIds?.length) return section.factorIds
  return section.blocks?.flatMap((b) => b.factorIds) ?? []
}

/** Etiquetas UI para los 36 factores de la matriz REG-SO-01 (orden del generador). */
export const SODEXO_MATRIZ_FACTOR_LABELS: Record<string, string> = {
  calor: 'Calor',
  neblinas: 'Neblinas',
  incendio: 'Incendio',
  atencion_publico: 'Atención públ.',
  frio: 'Frío',
  humos: 'Humos',
  explosion: 'Explosión',
  monotonia: 'Monotonía',
  alta_iluminacion: 'Alta iluminac.',
  polvos: 'Polvos',
  sentado_prolongado: 'Sentado prolong.',
  sobrecarga: 'Sobrecarga',
  baja_iluminacion: 'Baja iluminac.',
  liquidos: 'Líquidos',
  de_pie_prolongado: 'De pie prolongado',
  psicosocial_laboral: 'Psicosocial laboral',
  presion: 'Presión',
  gases: 'Gases',
  movimientos_repetitivos: 'Movim. repetitivos',
  turnos: 'Turnos',
  rad_no_ionizante: 'Rad. no ioniz.',
  vapores: 'Vapores',
  levantamiento_cargas: 'Levant. de cargas',
  alto_ritmo_laboral: 'Alto ritmo laboral',
  rad_ionizante: 'Rad. ioniz.',
  contacto: 'Contacto',
  cont_electrico_directo: 'Cont. eléct. directo',
  conflicto_interpersonal: 'Conflicto rel. interpersonal',
  ruido: 'Ruido',
  producto_quimico: 'Contacto prod. químico',
  cont_electrico_indirecto: 'Cont. eléct. indirecto',
  ergonomico_fq: 'Ergonómico FQ',
  vibracion: 'Vibración',
  quimico: 'Químico',
  carga_estatica: 'Carga estática',
  monotonia_psicosocial: 'Monotonía psicosocial',
}

export const SODEXO_MATRIZ_FACTOR_IDS = Object.keys(SODEXO_MATRIZ_FACTOR_LABELS)
