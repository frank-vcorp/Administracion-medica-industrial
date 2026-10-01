/**
 * Campos de captura ginecológicos / reproductivos / vacunas (ex Módulo 1),
 * ahora embebidos en la sub-pestaña Antecedentes del Examen Médico.
 * Persisten en `physicalExamData.modulo1`.
 */

import {
  AG_ABORTO_VALUES,
  AG_GINE_MPF_VALUES,
  AG_IVS_VALUES,
  AG_NUMERIC_0_11,
  AG_VSA_VALUES,
  AR_MPF_VALUES,
  VAC_SI_NO_VALUES,
} from '@/schemas/clinical/exam.schema'

export const M1_SEX_OPTIONS = ['Femenino', 'Masculino'] as const

export type Modulo1FieldKind = 'select' | 'number' | 'date' | 'text'

export type Modulo1FieldDef = {
  name: string
  label: string
  kind: Modulo1FieldKind
  values?: readonly (string | number)[]
  min?: number
  max?: number
}

export const GINE_FIELDS: Modulo1FieldDef[] = [
  { name: 'm1_gine_menarca', label: 'Menarca', kind: 'number', min: 0, max: 30 },
  { name: 'm1_gine_fum', label: 'FUM', kind: 'date' },
  { name: 'm1_gine_ivs', label: 'I.V.S.', kind: 'select', values: AG_IVS_VALUES },
  { name: 'm1_gine_ritmo', label: 'Ritmo menstrual', kind: 'text' },
  { name: 'm1_gine_vsa', label: 'V.S.A.', kind: 'select', values: AG_VSA_VALUES },
  { name: 'm1_gine_gesta', label: 'Gesta', kind: 'select', values: AG_NUMERIC_0_11 },
  { name: 'm1_gine_aborto', label: 'Aborto', kind: 'select', values: AG_ABORTO_VALUES },
  { name: 'm1_gine_parto', label: 'Parto', kind: 'select', values: AG_NUMERIC_0_11 },
  { name: 'm1_gine_cesarea', label: 'Cesárea', kind: 'select', values: AG_NUMERIC_0_11 },
  { name: 'm1_gine_doc', label: 'D.O.C.', kind: 'select', values: AG_VSA_VALUES },
  { name: 'm1_gine_fup_uc', label: 'FUP/FUC', kind: 'date' },
  { name: 'm1_gine_mpf', label: 'M.P.F.', kind: 'select', values: AG_GINE_MPF_VALUES },
  { name: 'm1_gine_autoexploracion', label: 'Autoexploración mensual', kind: 'select', values: VAC_SI_NO_VALUES },
  { name: 'm1_gine_exp_mamaria', label: 'Exploración mamaria', kind: 'text' },
]

export const REPRO_FIELDS: Modulo1FieldDef[] = [
  { name: 'm1_repro_doc_prostata', label: 'D.O.C. Próstata (Salud prostática)', kind: 'text' },
  { name: 'm1_repro_mpf', label: 'M.P.F.', kind: 'select', values: AR_MPF_VALUES },
]

export const VACUNAS_CAPTURE_LIST: { key: string; label: string }[] = [
  { key: 'm1_vac_rubeola', label: 'Rubéola' },
  { key: 'm1_vac_neumococo', label: 'Neumococo' },
  { key: 'm1_vac_sarampion', label: 'Sarampión' },
  { key: 'm1_vac_influenza', label: 'Influenza' },
  { key: 'm1_vac_toxoide', label: 'Toxoide Tetánico' },
  { key: 'm1_vac_hepatitisb', label: 'Hepatitis B' },
  { key: 'm1_vac_otras', label: 'Otras' },
]

export { VAC_SI_NO_VALUES }
