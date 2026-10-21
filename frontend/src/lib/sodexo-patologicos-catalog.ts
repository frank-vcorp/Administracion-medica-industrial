/**
 * §5 PERSONAL PATOLÓGICO — rejilla REG-SO-01 (captura extensión + AcroForm).
 * Pares Niega/Sí calibrados con `sodexo-field-geometry.json` (página 2).
 */

export type SodexoPatologicoPdfRow = {
  checkNo: string
  checkSi: string
  /** Vacío si la plantilla no trae campo texto en esa fila. */
  descField?: string
}

export type SodexoPatologicoCatalogEntry = {
  key: string
  label: string
  group: string
  column: 'left' | 'right'
  pdf: SodexoPatologicoPdfRow
  /** Respaldo / prellenado desde `antecedentes_captured.patologicos`. */
  amiKey?: string
  /** Encabezado columna describir (p. ej. alérgicos). */
  descHeader?: string
}

const L = (
  key: string,
  label: string,
  group: string,
  pdf: SodexoPatologicoPdfRow,
  amiKey?: string,
  descHeader?: string,
): SodexoPatologicoCatalogEntry => ({
  key,
  label,
  group,
  column: 'left',
  pdf,
  amiKey,
  descHeader,
})

const R = (
  key: string,
  label: string,
  group: string,
  pdf: SodexoPatologicoPdfRow,
  amiKey?: string,
  descHeader?: string,
): SodexoPatologicoCatalogEntry => ({
  key,
  label,
  group,
  column: 'right',
  pdf,
  amiKey,
  descHeader,
})

/** Orden vertical del impreso (arriba → abajo). */
export const SODEXO_PATOLOGICOS_CATALOG: SodexoPatologicoCatalogEntry[] = [
  // —— Izquierda ——
  L('fracturas', 'Fracturas', 'Traumáticos', { checkNo: 'Check Box400', checkSi: 'Check Box401', descField: 'Texto507' }, 'fracturas'),
  L('luxaciones', 'Luxaciones', 'Traumáticos', { checkNo: 'Check Box402', checkSi: 'Check Box403', descField: 'Texto508' }),
  L('esguinces', 'Esguinces', 'Traumáticos', { checkNo: 'Check Box404', checkSi: 'Check Box405', descField: 'Texto509' }),
  L('otros_traumas', 'Otros traumas', 'Traumáticos', {
    checkNo: 'Check Box406',
    checkSi: 'Check Box407',
    descField: 'Texto510',
  }, 'traumatismos_craneales'),
  L('otitis', 'Otitis', 'ORL', { checkNo: 'Check Box408', checkSi: 'Check Box409', descField: 'Texto511' }),
  L('sinusitis', 'Sinusitis', 'ORL', { checkNo: 'Check Box410', checkSi: 'Check Box411', descField: 'Texto512' }),
  L('hipoacusia', 'Hipoacusia', 'ORL', { checkNo: 'Check Box412', checkSi: 'Check Box413', descField: 'Texto513' }),
  L('orl_otras', 'Otras', 'ORL', { checkNo: 'Check Box414', checkSi: 'Check Box415', descField: 'Texto514' }),
  L('trastornos_columna', 'Trastornos columna', 'Osteomuscular', {
    checkNo: 'Check Box416',
    checkSi: 'Check Box417',
    descField: 'Texto515',
  }, 'pat_c_vertebral'),
  L('tendinitis_bursitis', 'Tendinitis / bursitis', 'Osteomuscular', {
    checkNo: 'Check Box418',
    checkSi: 'Check Box419',
    descField: 'Texto516',
  }),
  L('tunel_carpiano', 'S. túnel carpiano', 'Osteomuscular', {
    checkNo: 'Check Box420',
    checkSi: 'Check Box421',
    descField: 'Texto517',
  }),
  L('osteoartritis_otros', 'Osteoartritis / otros', 'Osteomuscular', {
    checkNo: 'Check Box422',
    checkSi: 'Check Box423',
    descField: 'Texto518',
  }),
  L('ets', 'ETS', 'Infecciosas', { checkNo: 'Check Box424', checkSi: 'Check Box425', descField: 'Texto519' }, 'enf_trans_sexual'),
  L('tbc', 'TBC', 'Infecciosas', { checkNo: 'Check Box426', checkSi: 'Check Box427', descField: 'Texto520' }, 'tuberculosis'),
  L('hepatitis', 'Hepatitis', 'Infecciosas', { checkNo: 'Check Box428', checkSi: 'Check Box429', descField: 'Texto521' }, 'hepatitis'),
  L('zoonosis', 'Zoonosis', 'Infecciosas', { checkNo: 'Check Box430', checkSi: 'Check Box431', descField: 'Texto522' }),
  L('amigdalitis_cronica', 'Amigdalitis crónica', 'Infecciosas', {
    checkNo: 'Check Box432',
    checkSi: 'Check Box433',
    descField: 'Texto523',
  }, 'parotiditis'),
  L('infecciosas_otras', 'Otras', 'Infecciosas', {
    checkNo: 'Check Box434',
    checkSi: 'Check Box435',
    descField: 'Texto524',
  }, 'tifoidea'),
  L('epilepsia', 'Epilepsia', 'Neurológica / mental', {
    checkNo: 'Check Box436',
    checkSi: 'Check Box440',
    descField: 'Texto525',
  }, 'epilepsia'),
  L('migrana_cefaleas', 'Migraña / cefaleas', 'Neurológica / mental', {
    checkNo: 'Check Box437',
    checkSi: 'Check Box441',
    descField: 'Texto526',
  }, 'migrana'),
  L('psiquiatricas', 'Psiquiátricas', 'Neurológica / mental', {
    checkNo: 'Check Box438',
    checkSi: 'Check Box442',
    descField: 'Texto527',
  }, 'psiquiatricas'),
  L('vertigo_otras', 'Vértigo / otras', 'Neurológica / mental', {
    checkNo: 'Check Box439',
    checkSi: 'Check Box443',
    descField: 'Texto528',
  }, 'vertigo'),
  L('quirurgicos', 'Quirúrgicos', 'Quirúrgicos', { checkNo: 'Check Box444', checkSi: 'Check Box445' }, 'cirugias'),

  // —— Derecha ——
  R('asma', 'Asma', 'Alérgicos', { checkNo: 'Check Box352', checkSi: 'Check Box356', descField: 'Texto506' }, 'asma', 'Describir (agente)'),
  R('rinitis', 'Rinitis', 'Alérgicos', { checkNo: 'Check Box388', checkSi: 'Check Box389' }, undefined, 'Describir (agente)'),
  R('dermatitis', 'Dermatitis', 'Alérgicos', {
    checkNo: 'Check Box353',
    checkSi: 'Check Box357',
    descField: 'Texto505',
  }, 'dermatitis', 'Describir (agente)'),
  R('urticaria_otros', 'Urticaria / otros', 'Alérgicos', {
    checkNo: 'Check Box354',
    checkSi: 'Check Box358',
    descField: 'Texto504',
  }, 'alergias', 'Describir (agente)'),
  R('dislipidemia', 'Dislipidemia', 'Endocrin. / metaból.', {
    checkNo: 'Check Box355',
    checkSi: 'Check Box359',
    descField: 'Texto503',
  }),
  R('diabetes', 'Diabetes', 'Endocrin. / metaból.', {
    checkNo: 'Check Box364',
    checkSi: 'Check Box360',
    descField: 'Texto502',
  }, 'diabetes'),
  R('enf_tiroideas', 'Enf. tiroideas', 'Endocrin. / metaból.', {
    checkNo: 'Check Box365',
    checkSi: 'Check Box361',
    descField: 'Texto501',
  }, 'endocrinopatias'),
  R('obesidad_otros', 'Obesidad / otros', 'Endocrin. / metaból.', {
    checkNo: 'Check Box366',
    checkSi: 'Check Box362',
    descField: 'Texto500',
  }),
  R('gastritis', 'Gastritis', 'Digestivas', { checkNo: 'Check Box367', checkSi: 'Check Box363', descField: 'Texto499' }, 'gastritis'),
  R('ulceras', 'Úlceras', 'Digestivas', { checkNo: 'Check Box368', checkSi: 'Check Box369', descField: 'Texto498' }),
  R('colitis', 'Colitis', 'Digestivas', { checkNo: 'Check Box370', checkSi: 'Check Box373', descField: 'Texto497' }, 'colitis'),
  R('digestivas_otras', 'Otros', 'Digestivas', {
    checkNo: 'Check Box371',
    checkSi: 'Check Box374',
    descField: 'Texto496',
  }, 'hemorroides'),
  R('hipertension', 'Hipertensión', 'Cardiovascular y respiratorio', {
    checkNo: 'Check Box372',
    checkSi: 'Check Box375',
    descField: 'Texto495',
  }, 'has'),
  R('infarto', 'Infarto', 'Cardiovascular y respiratorio', {
    checkNo: 'Check Box376',
    checkSi: 'Check Box377',
    descField: 'Texto494',
  }, 'cardiopatias'),
  R('angina', 'Angina', 'Cardiovascular y respiratorio', {
    checkNo: 'Check Box378',
    checkSi: 'Check Box379',
    descField: 'Texto493',
  }),
  R('epoc', 'EPOC', 'Cardiovascular y respiratorio', {
    checkNo: 'Check Box380',
    checkSi: 'Check Box381',
    descField: 'Texto492',
  }, 'neumonias'),
  R('bronquitis', 'Bronquitis', 'Cardiovascular y respiratorio', {
    checkNo: 'Check Box382',
    checkSi: 'Check Box383',
    descField: 'Texto491',
  }, 'bronquitis'),
  R('varices_otros', 'Várices / otros', 'Cardiovascular y respiratorio', {
    checkNo: 'Check Box384',
    checkSi: 'Check Box385',
    descField: 'Texto490',
  }, 'varices'),
  R('litiasis_renal', 'Litiasis renal', 'Urológica', {
    checkNo: 'Check Box386',
    checkSi: 'Check Box387',
    descField: 'Texto489',
  }, 'renales'),
  R('infeccion_urinaria', 'Infecc. urinaria', 'Urológica', {
    checkNo: 'Check Box390',
    checkSi: 'Check Box391',
    descField: 'Texto488',
  }),
  R('tumorales', 'Tumorales', 'Tumorales', { checkNo: 'Check Box392', checkSi: 'Check Box393', descField: 'Texto487' }, 'cancer'),
  R('toxicos_patologicos', 'Tóxicos', 'Tóxicos', { checkNo: 'Check Box394', checkSi: 'Check Box397', descField: 'Texto485' }),
  R('medicamentos_patologicos', 'Medicamentos', 'Medicamentos', {
    checkNo: 'Check Box395',
    checkSi: 'Check Box398',
    descField: 'Texto486',
  }),
]

export const SODEXO_PATOLOGICOS_GROUPS_LEFT = [
  'Traumáticos',
  'ORL',
  'Osteomuscular',
  'Infecciosas',
  'Neurológica / mental',
  'Quirúrgicos',
] as const

export const SODEXO_PATOLOGICOS_GROUPS_RIGHT = [
  'Alérgicos',
  'Endocrin. / metaból.',
  'Digestivas',
  'Cardiovascular y respiratorio',
  'Urológica',
  'Tumorales',
  'Tóxicos',
  'Medicamentos',
] as const

export function sodexoPatologicosCatalogByColumn(column: 'left' | 'right') {
  return SODEXO_PATOLOGICOS_CATALOG.filter((r) => r.column === column)
}

export function patologicosSodexoIsEmpty(
  map: Record<string, { estado?: string | null; descripcion?: string | null }> | null | undefined,
): boolean {
  if (!map) return true
  return !Object.values(map).some((r) => r?.estado === 'NEGADO' || r?.estado === 'SI')
}
