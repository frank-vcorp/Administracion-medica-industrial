import { z } from 'zod'
import { applyProperNameCase, applySentenceCase } from '@/lib/text/sentence-case'
import { ClinicalHistoryDataSchema } from '@/schemas/clinical/history.schema'

export const CERTIFICADO_MEDICO_SCHEMA_VERSION = 'certificado-medico-v1' as const

export const DICTAMEN_LABORAL_VALUES = [
  'APTO',
  'NO_APTO',
  'CON_OBSERVACIONES',
  'OTRO',
] as const

export type DictamenLaboralValue = (typeof DICTAMEN_LABORAL_VALUES)[number]

export const DICTAMEN_LABORAL_LABELS: Record<DictamenLaboralValue, string> = {
  APTO: 'Apto para actividades laborales',
  NO_APTO: 'No apto para actividades laborales',
  CON_OBSERVACIONES: 'Apto con observaciones',
  OTRO: 'Otro (texto libre)',
}

export const DEFAULT_DICTAMEN_LABORAL_TEXTO: Record<DictamenLaboralValue, string> = {
  APTO: 'Apto para realizar actividades laborales.',
  NO_APTO: 'No apto para realizar actividades laborales en las condiciones evaluadas.',
  CON_OBSERVACIONES:
    'Apto para realizar actividades laborales con las observaciones descritas en la integración diagnóstica.',
  OTRO: '',
}

export const DEFAULT_LUGAR_EXPEDICION = 'Santiago de Querétaro, Querétaro'

const freeText = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? 'Campo obligatorio.' : `Debe tener al menos ${min} caracteres.`)
    .max(max, `Debe tener como máximo ${max} caracteres.`)
    .transform(applySentenceCase)

const draftText = (max: number) =>
  z.string().trim().max(max).transform(applySentenceCase)
const properNameText = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? 'Campo obligatorio.' : `Debe tener al menos ${min} caracteres.`)
    .max(max, `Debe tener como máximo ${max} caracteres.`)
    .transform(applyProperNameCase)
const properNameDraft = (max: number) =>
  z.string().trim().max(max).transform(applyProperNameCase)
const properNameOptional = z
  .union([z.literal(''), z.string().trim().max(1000).transform(applyProperNameCase)])
  .optional()
const plainString = z.string().trim()
const optionalString = z
  .union([z.literal(''), z.string().trim().max(8000).transform(applySentenceCase)])
  .optional()

export const SignosVitalesCertificadoSchema = z.object({
  peso_kg: optionalString,
  talla_m: optionalString,
  imc: optionalString,
  complexion: optionalString,
  ta_sistolica: optionalString,
  ta_diastolica: optionalString,
  fc_min: optionalString,
  fr_min: optionalString,
  temperatura: optionalString,
  spo2_pct: optionalString,
  agudeza_vl: optionalString,
  agudeza_vlc: optionalString,
  agudeza_vc: optionalString,
  agudeza_vcc: optionalString,
})

export const CertificadoMedicoPayloadSchema = z.object({
  schemaVersion: z.literal(CERTIFICADO_MEDICO_SCHEMA_VERSION),
  lugar_expedicion: properNameText(200, 3),
  hora_atencion: optionalString,
  sexo_atencion: optionalString,
  domicilio_atencion: properNameOptional,
  identificacion_tipo: optionalString,
  identificacion_folio: optionalString,
  medico_nombre: properNameText(200, 1),
  medico_cedula: plainString.min(1).max(50),
  medico_titulo: optionalString,
  medico_universidad: properNameOptional,
  signos_vitales: SignosVitalesCertificadoSchema,
  exploracion_fisica: freeText(12000, 10),
  integracion_diagnostica: freeText(4000, 3),
  dictamen_laboral: z.enum(DICTAMEN_LABORAL_VALUES),
  dictamen_laboral_texto: freeText(2000, 3),
  antecedentes: ClinicalHistoryDataSchema.optional(),
  modulo1: z.record(z.string(), z.any()).optional(),
  cerrada_at: z.string().datetime().optional(),
})

export type CertificadoMedicoPayload = z.infer<typeof CertificadoMedicoPayloadSchema>

/**
 * Borrador / autoguardado: solo exige `schemaVersion`.
 * `.partial()` no basta: si el campo viene como "" Zod sigue aplicando `.min()` del schema final.
 */
export const CertificadoMedicoDraftSchema = z.object({
  schemaVersion: z.literal(CERTIFICADO_MEDICO_SCHEMA_VERSION),
  lugar_expedicion: properNameDraft(200).optional(),
  hora_atencion: optionalString,
  sexo_atencion: optionalString,
  domicilio_atencion: properNameOptional,
  identificacion_tipo: optionalString,
  identificacion_folio: optionalString,
  medico_nombre: properNameDraft(200).optional(),
  medico_cedula: plainString.max(50).optional(),
  medico_titulo: optionalString,
  medico_universidad: properNameOptional,
  signos_vitales: SignosVitalesCertificadoSchema.optional(),
  exploracion_fisica: draftText(12000).optional(),
  integracion_diagnostica: draftText(4000).optional(),
  dictamen_laboral: z.enum(DICTAMEN_LABORAL_VALUES).optional(),
  dictamen_laboral_texto: draftText(2000).optional(),
  antecedentes: ClinicalHistoryDataSchema.optional(),
  modulo1: z.record(z.string(), z.any()).optional(),
  cerrada_at: z.string().datetime().optional(),
})

export function emptySignosVitalesCertificado(): z.infer<typeof SignosVitalesCertificadoSchema> {
  return {
    peso_kg: '',
    talla_m: '',
    imc: '',
    complexion: '',
    ta_sistolica: '',
    ta_diastolica: '',
    fc_min: '',
    fr_min: '',
    temperatura: '',
    spo2_pct: '',
    agudeza_vl: '',
    agudeza_vlc: '',
    agudeza_vc: '',
    agudeza_vcc: '',
  }
}

export const PLANTILLA_EXPLORACION_NARRATIVA =
  'Se encuentra paciente consciente, orientado en espacio, tiempo, persona y situación. Con buen estado de hidratación. Cavidad oral hidratada, dentadura completa, sin datos de sarro y caries, faringe sin alteraciones. Ojos con reflejo fotomotor y consensual conservado, pupilas simétricas, conjuntiva, iris, córnea y esclera sin anormalidades. Oídos de características normales, conductos auditivos permeables. Tórax mesomórfico con movimientos de amplexión y amplexación normales sin alteraciones a la auscultación pulmonar y cardiaca. Abdomen globoso, depresible, no doloroso a la palpación, sin anormalidades. Extremidades íntegras, eutróficas, piel y tegumentos sin lesiones aparentes, fuerza muscular en escala de Daniels 5/5, sensibilidad conservada, prueba dedo-nariz y talón-rodilla negativas, llenado capilar inmediato, sin edema, reflejos osteotendinosos normales, prueba de Romberg negativa, marcha talón-punta (Tándem) normal, resto sin alteraciones.'

export const PLANTILLA_EXPLORACION_SISTEMAS = `Neurológico: Consciente, orientado en sus cuatro esferas. Fuerza 5/5 (Daniels), sensibilidad y reflejos osteotendinosos conservados. Coordinación, Romberg y marcha en tándem normales.
Cabeza y cuello: Mucosa oral hidratada, dentadura completa sin caries ni sarro, faringe normal. Pupilas isocóricas normorreflécticas, globos oculares sin alteraciones. Conductos auditivos permeables.
Tórax: Mesomórfico, amplexión y amplexación normales, auscultación cardiopulmonar sin alteraciones.
Abdomen: Globoso, depresible, no doloroso.
Extremidades: Íntegras, eutróficas, llenado capilar inmediato, sin edema.
Piel: Sin lesiones ni alteraciones aparentes.
Romberg: Negativo.
Tándem: Negativo.`

export function buildDefaultExploracionCertificado(antecedentes?: Record<string, unknown> | null): string {
  return buildExploracionPorSistemas(antecedentes)
}

export function buildExploracionNarrativa(antecedentes?: Record<string, unknown> | null): string {
  const np = antecedentes?.no_patologicos as Record<string, unknown> | undefined
  const hasTattoos = String(np?.tatuajes ?? '').toUpperCase() === 'SI'
  const esp = typeof np?.tatuajes_especifique === 'string' && np.tatuajes_especifique.trim()

  if (hasTattoos) {
    const tatText = esp ? `presencia de múltiples tatuajes en ${esp}` : 'presencia de tatuajes'
    return PLANTILLA_EXPLORACION_NARRATIVA.replace('piel y tegumentos sin lesiones aparentes', tatText)
  }
  return PLANTILLA_EXPLORACION_NARRATIVA
}

export function buildExploracionPorSistemas(antecedentes?: Record<string, unknown> | null): string {
  const np = antecedentes?.no_patologicos as Record<string, unknown> | undefined
  const hasTattoos = String(np?.tatuajes ?? '').toUpperCase() === 'SI'
  const esp = typeof np?.tatuajes_especifique === 'string' && np.tatuajes_especifique.trim()

  if (hasTattoos) {
    const tatText = esp ? `Tatuajes en ${esp}.` : 'Presencia de tatuajes.'
    return PLANTILLA_EXPLORACION_SISTEMAS.replace('Piel: Sin lesiones ni alteraciones aparentes.', `Piel: ${tatText}`)
  }
  return PLANTILLA_EXPLORACION_SISTEMAS
}
