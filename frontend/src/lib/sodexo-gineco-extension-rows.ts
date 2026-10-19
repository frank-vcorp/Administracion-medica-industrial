/** Filas §7 tóxicos/medicamentos — solo extensión Sodexo (no en papeleta AMI). */
export type SodexoGinecoExtensionRow = {
  id: string
  label: string
  no: string
  si: string
}

export const SODEXO_GINECO_TOXICO_EXTENSION_ROWS: SodexoGinecoExtensionRow[] = [
  { id: 'anticonceptivos', label: 'Anticonceptivos', no: 'Check Box422', si: 'Check Box423' },
  { id: 'hormonales', label: 'Hormonales', no: 'Check Box420', si: 'Check Box421' },
  { id: 'otros_medicamentos', label: 'Otros medicamentos', no: 'Check Box418', si: 'Check Box419' },
  { id: 'tabaco', label: 'Tabaco', no: 'Check Box414', si: 'Check Box415' },
  { id: 'alcohol', label: 'Alcohol', no: 'Check Box412', si: 'Check Box413' },
  { id: 'drogas', label: 'Drogas', no: 'Check Box410', si: 'Check Box411' },
  { id: 'cafe', label: 'Cafeína excesiva', no: 'Check Box408', si: 'Check Box409' },
  { id: 'toxico_8', label: 'Exposición tóxica 8', no: 'Check Box406', si: 'Check Box407' },
  { id: 'toxico_9', label: 'Exposición tóxica 9', no: 'Check Box404', si: 'Check Box405' },
  { id: 'toxico_10', label: 'Exposición tóxica 10', no: 'Check Box402', si: 'Check Box403' },
  { id: 'toxico_11', label: 'Exposición tóxica 11', no: 'Check Box400', si: 'Check Box401' },
  { id: 'toxico_12', label: 'Exposición tóxica 12', no: 'Check Box372', si: 'Check Box375' },
  { id: 'toxico_13', label: 'Exposición tóxica 13', no: 'Check Box371', si: 'Check Box374' },
  { id: 'toxico_14', label: 'Exposición tóxica 14', no: 'Check Box370', si: 'Check Box373' },
  { id: 'toxico_15', label: 'Exposición tóxica 15', no: 'Check Box367', si: 'Check Box363' },
  { id: 'toxico_16', label: 'Exposición tóxica 16', no: 'Check Box366', si: 'Check Box361' },
  { id: 'toxico_17', label: 'Exposición tóxica 17', no: 'Check Box365', si: 'Check Box360' },
  { id: 'toxico_18', label: 'Exposición tóxica 18', no: 'Check Box364', si: 'Check Box359' },
  { id: 'toxico_19', label: 'Exposición tóxica 19', no: 'Check Box355', si: 'Check Box358' },
  { id: 'toxico_20', label: 'Exposición tóxica 20', no: 'Check Box354', si: 'Check Box357' },
  { id: 'toxico_21', label: 'Exposición tóxica 21', no: 'Check Box353', si: 'Check Box356' },
]
