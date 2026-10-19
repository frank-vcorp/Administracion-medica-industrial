/**
 * Vista espejo: datos ya capturados en la papeleta AMI que el PDF Sodexo proyecta.
 */
import { SODEXO_EXPLORACION_TEXT } from '@/lib/sodexo-pdf-mappings'

export type SodexoAmiMirrorInput = {
  examForm: Record<string, string>
  antecedentesCaptured: Record<string, unknown>
  modulo1: Record<string, string>
  somatometry: Record<string, unknown>
  vitalSigns: Record<string, unknown>
  eyeAcuity: Record<string, unknown>
  prefilledData?: Record<string, unknown> | null
  longitudinalData?: Record<string, unknown> | null
}

export function resolvePatientSexo(
  examForm: Record<string, string>,
  modulo1: Record<string, string>,
  antecedentes: Record<string, unknown>,
): string {
  const dp = antecedentes.datos_personales
  const fromDp =
    dp && typeof dp === 'object' && !Array.isArray(dp)
      ? String((dp as Record<string, unknown>).sexo ?? '')
      : ''
  return (
    modulo1.m1_sexo?.trim() ||
    examForm.sexo?.trim() ||
    fromDp.trim() ||
    ''
  )
}

export function isSodexoFemalePatient(sexo: string | undefined | null): boolean {
  const s = (sexo ?? '').trim()
  if (!s) return false
  return /^(F|FEMENINO|MUJER)/i.test(s)
}

export function sodexoNeedsActividadesBlock(tipo: string | null | undefined): boolean {
  return tipo === 'PERIODICA' || tipo === 'RETIRO' || tipo === 'REINGRESO'
}

/** Subsecciones 9.x alineadas al impreso (texto desde exploración AMI). */
export const SODEXO_EF_SUBSECTIONS: {
  num: string
  title: string
  fieldKeys: (keyof typeof SODEXO_EXPLORACION_TEXT | string)[]
  labels?: Record<string, string>
}[] = [
  { num: '9.1', title: 'Cabeza y cuello', fieldKeys: ['cabeza', 'cuello'] },
  { num: '9.2', title: 'Neurológico', fieldKeys: ['neurologico'] },
  { num: '9.3', title: 'Ojos', fieldKeys: ['ojos'] },
  { num: '9.4', title: 'Oídos', fieldKeys: ['oidos_cad', 'oidos_cai'], labels: { oidos_cad: 'CAD', oidos_cai: 'CAI' } },
  { num: '9.5', title: 'Nariz y boca / faringe', fieldKeys: ['nariz', 'boca_faringe'] },
  { num: '9.6', title: 'Tórax y cardiopulmonar', fieldKeys: ['torax', 'corazon_pulmones'] },
  { num: '9.7', title: 'Abdomen', fieldKeys: ['abdomen'] },
  { num: '9.8', title: 'Piel y faneras', fieldKeys: ['piel_y_faneras'] },
  { num: '9.9', title: 'Genitourinario', fieldKeys: ['genitourinario'] },
  { num: '9.10', title: 'Columna y extremidades', fieldKeys: ['columna_vertebral', 'ms_superiores', 'ms_inferiores'] },
]

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function sectionRecord(
  antecedentes: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const sec = antecedentes[key]
  if (sec && typeof sec === 'object' && !Array.isArray(sec)) {
    return sec as Record<string, unknown>
  }
  return {}
}

export function amiExploracionValue(
  examForm: Record<string, string>,
  key: string,
): string {
  if (key === 'boca_faringe') {
    const parts = [
      examForm.boca_estado,
      examForm.boca_alineacion,
      examForm.faringe,
    ].filter((p) => str(p))
    return parts.join(' · ') || ''
  }
  if (key === 'corazon_pulmones') {
    const parts = [examForm.corazon, examForm.campos_pulmonares].filter((p) => str(p))
    return parts.join(' · ') || ''
  }
  return str(examForm[key])
}

export function flattenAmiSectionForDisplay(
  data: Record<string, unknown>,
  maxRows = 24,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('_')) continue
    if (rows.length >= maxRows) break
    let value = ''
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>
      value = [o.estado, o.descripcion, o.detalle].filter((x) => str(x)).join(' · ')
    } else {
      value = str(v)
    }
    if (!value) continue
    rows.push({ label: k.replace(/_/g, ' '), value })
  }
  return rows
}

export function somatometrySummary(
  soma: Record<string, unknown>,
  vitals: Record<string, unknown>,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  const add = (label: string, v: unknown) => {
    const t = str(v)
    if (t) rows.push({ label, value: t })
  }
  add('Peso', soma.weight ?? soma.peso)
  add('Talla', soma.height ?? soma.talla)
  add('IMC', soma.imc)
  add('Presión arterial', vitals.bloodPressure ?? vitals.presion_arterial)
  add('Frecuencia cardiaca', vitals.heartRate ?? vitals.frecuencia_cardiaca)
  add('Frecuencia respiratoria', vitals.respiratoryRate ?? vitals.frecuencia_respiratoria)
  add('Temperatura', vitals.temperature ?? vitals.temperatura)
  return rows
}

export function eyeAcuitySummary(eye: Record<string, unknown>): { label: string; value: string }[] {
  const keys = [
    ['vision_lejana_od', 'Lejana OD'],
    ['vision_lejana_oi', 'Lejana OI'],
    ['lejana_corregida_od', 'Lejana OD corr.'],
    ['lejana_corregida_oi', 'Lejana OI corr.'],
    ['vision_cercana_od', 'Cercana OD'],
    ['vision_cercana_oi', 'Cercana OI'],
  ] as const
  return keys
    .map(([k, label]) => ({ label, value: str(eye[k]) }))
    .filter((r) => r.value)
}

export function identificacionAmiRows(input: SodexoAmiMirrorInput): { label: string; value: string }[] {
  const dp = sectionRecord(input.antecedentesCaptured, 'datos_personales')
  const rows = flattenAmiSectionForDisplay(dp, 16)
  if (rows.length) return rows
  const pf = input.prefilledData ?? {}
  const add: { label: string; value: string }[] = []
  const tryKeys = [
    ['nombre', 'Nombre'],
    ['m1_nombre', 'Nombre'],
    ['sexo', 'Sexo'],
    ['m1_sexo', 'Sexo'],
    ['edad', 'Edad'],
    ['escolaridad', 'Escolaridad'],
    ['estado_civil', 'Estado civil'],
    ['domicilio', 'Domicilio'],
  ] as const
  for (const [k, label] of tryKeys) {
    const v = str(pf[k] ?? input.modulo1[k])
    if (v) add.push({ label, value: v })
  }
  return add
}

export function historiaOcupacionalAmiNarrative(antecedentes: Record<string, unknown>): string {
  const hl = sectionRecord(antecedentes, 'historia_laboral')
  return str(hl.narrativa ?? hl.historia_ocupacional ?? hl.descripcion)
}

export {
  sectionRecord,
}
