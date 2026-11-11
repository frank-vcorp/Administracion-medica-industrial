/**
 * Campos obligatorios por pestaña del Examen Médico (papeleta).
 * Patrón alineado con `study-required-fields.ts` (PR #20).
 */
import { VISION_SNELLEN_NO_APLICA } from '@/lib/clinical/agudeza-visual'
import {
  formatStudyMissingFieldsSpanish,
  studyValidationToFieldErrors,
  type StudyCaptureValidationResult,
  type StudyRequiredFieldRule,
} from '@/lib/clinical/study-required-fields'
import { validateSodexoExtensionForClinicalClose } from '@/lib/sodexo-extension-validation'
import {
  normalizeQuisteEstado,
  normalizeTestAdamEstado,
  PLANTILLAS_EF,
  type PlantillaEfKey,
} from '@/schemas/clinical/exam.schema'
import type {
  FlowserveExtensionData,
  SodexoExtensionData,
} from '@/schemas/clinical/examen-medico-variant.schema'
import { isDefaultExamenMedicoVariant } from '@/lib/clinical/examen-medico-variant'

export type ExamenMedicoTabId =
  | 'somatometria'
  | 'signos_vitales'
  | 'agudeza_visual'
  | 'antecedentes'
  | 'exploracion'
  | 'extension'
  | 'impresion'

export type ExamenMedicoValidationInput = {
  somaForm: Record<string, string>
  vitalsForm: Record<string, string>
  agudezaForm: Record<string, string>
  form: Record<string, string>
  modulo1: Record<string, string>
  antecedentesCaptured: Record<string, unknown>
  examVariant: string
  flowserveExt?: FlowserveExtensionData
  sodexoExt?: SodexoExtensionData
  recomendaciones?: string
}

export { formatStudyMissingFieldsSpanish, studyValidationToFieldErrors }
export type { StudyCaptureValidationResult, StudyRequiredFieldRule }

const ANTECEDENTES_SECTIONS = [
  'datos_personales',
  'historia_laboral',
  'heredo_familiares',
  'no_patologicos',
  'patologicos',
] as const

const ANTECEDENTES_SECTION_LABELS: Record<(typeof ANTECEDENTES_SECTIONS)[number], string> = {
  datos_personales: 'datos personales',
  historia_laboral: 'historia laboral',
  heredo_familiares: 'heredo-familiares',
  no_patologicos: 'no patológicos',
  patologicos: 'patológicos',
}

const EXPLORACION_SELECT_FIELDS = [
  'boca_estado',
  'circulacion_venosa',
  'arco_de_movilidad',
  'tono_muscular',
  'coordinacion',
  'test_romberg',
  'signo_bragard',
  'prueba_finkelstein',
  'signo_tinel',
  'prueba_phanel',
  'prueba_lasegue',
  'presencia_quiste_sinovial',
  'test_adam',
] as const

const EXPLORACION_PLANTILLA_FIELDS = Object.keys(PLANTILLAS_EF) as PlantillaEfKey[]

const EXPLORACION_TEXT_REQUIRED = [
  'boca_alineacion',
  'fuerza_muscular_daniels_sup',
  'fuerza_muscular_daniels_inf',
] as const

const POSITIVE_EF_FIELDS = [
  'test_adam',
  'test_romberg',
  'signo_bragard',
  'prueba_finkelstein',
  'signo_tinel',
  'prueba_phanel',
  'prueba_lasegue',
] as const

const IMPRESION_COMBO_REQUIRED = [
  { field: 'estado_nutricional', label: 'estado nutricional' },
  { field: 'salud_bucal', label: 'salud bucal' },
  { field: 'agudeza_visual_resumen', label: 'agudeza visual (resumen)' },
  { field: 'presion_arterial_resumen', label: 'presión arterial (resumen)' },
] as const

function hasPositiveNumber(raw: string | undefined): boolean {
  const s = String(raw ?? '').trim()
  if (!s) return false
  const n = Number(s)
  return Number.isFinite(n) && n > 0
}

function hasNonEmpty(raw: string | undefined): boolean {
  return String(raw ?? '').trim().length > 0
}

function isValidAgudezaLejana(value: string | undefined): boolean {
  const v = String(value ?? '').trim()
  return v.length > 0 && v !== VISION_SNELLEN_NO_APLICA
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Sección de antecedentes tocada (incluye NEGADO / negados). */
export function antecedentesSectionAddressed(section: unknown): boolean {
  if (!isRecord(section)) return false
  const walk = (v: unknown): boolean => {
    if (v === null || v === undefined) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (typeof v === 'number' || typeof v === 'boolean') return true
    if (isRecord(v)) {
      if ('estado' in v) {
        const estado = String(v.estado ?? '').trim()
        if (estado.length > 0) return true
        if (isRecord(v.detalle)) {
          return Object.values(v.detalle).some(walk)
        }
        return false
      }
      return Object.values(v).some(walk)
    }
    return false
  }
  return Object.values(section).some(walk)
}

function exploracionHasPositiveFinding(form: Record<string, string>): boolean {
  for (const f of POSITIVE_EF_FIELDS) {
    const v = form[f]
    if (f === 'test_adam') {
      if (normalizeTestAdamEstado(v) === 'SI') return true
      continue
    }
    if (typeof v === 'string' && v.toUpperCase().includes('POSITIVO')) return true
  }
  return normalizeQuisteEstado(form.presencia_quiste_sinovial) === 'POSITIVO'
}

export function validateExamenMedicoTab(
  tab: ExamenMedicoTabId,
  input: ExamenMedicoValidationInput,
): StudyCaptureValidationResult {
  const missing: StudyRequiredFieldRule[] = []

  if (tab === 'somatometria') {
    if (!hasPositiveNumber(input.somaForm.peso_kg)) {
      missing.push({ field: 'peso_kg', label: 'peso (kg)' })
    }
    if (!hasPositiveNumber(input.somaForm.talla_m)) {
      missing.push({ field: 'talla_m', label: 'talla (m)' })
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  if (tab === 'signos_vitales') {
    const hasTa = hasNonEmpty(input.vitalsForm.ta_sistolica)
    const hasFc = hasNonEmpty(input.vitalsForm.fc_min)
    if (!hasTa && !hasFc) {
      missing.push({
        field: '_vitals',
        label: 'tensión arterial sistólica o frecuencia cardiaca',
      })
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  if (tab === 'agudeza_visual') {
    if (!isValidAgudezaLejana(input.agudezaForm.vision_lejana_od)) {
      missing.push({ field: 'vision_lejana_od', label: 'visión lejana OD' })
    }
    if (!isValidAgudezaLejana(input.agudezaForm.vision_lejana_oi)) {
      missing.push({ field: 'vision_lejana_oi', label: 'visión lejana OI' })
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  if (tab === 'antecedentes') {
    if (!hasNonEmpty(input.modulo1.m1_sexo)) {
      missing.push({ field: 'm1_sexo', label: 'sexo' })
    }
    for (const sec of ANTECEDENTES_SECTIONS) {
      if (!antecedentesSectionAddressed(input.antecedentesCaptured[sec])) {
        missing.push({
          field: `antecedentes_captured.${sec}`,
          label: ANTECEDENTES_SECTION_LABELS[sec],
        })
      }
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  if (tab === 'exploracion') {
    for (const field of EXPLORACION_PLANTILLA_FIELDS) {
      if (!hasNonEmpty(input.form[field])) {
        missing.push({ field, label: field.replace(/_/g, ' ') })
      }
    }
    for (const field of EXPLORACION_TEXT_REQUIRED) {
      if (!hasNonEmpty(input.form[field])) {
        missing.push({ field, label: field.replace(/_/g, ' ') })
      }
    }
    for (const field of EXPLORACION_SELECT_FIELDS) {
      if (!hasNonEmpty(input.form[field])) {
        missing.push({ field, label: field.replace(/_/g, ' ') })
      }
    }
    if (normalizeTestAdamEstado(input.form.test_adam) === 'SI' && !hasNonEmpty(input.form.test_adam_lateral)) {
      missing.push({ field: 'test_adam_lateral', label: 'Test Adam — lateralidad' })
    }
    if (normalizeQuisteEstado(input.form.presencia_quiste_sinovial) === 'POSITIVO') {
      if (!hasNonEmpty(input.form.especificar_quiste)) {
        missing.push({ field: 'especificar_quiste', label: 'especificación de quiste sinovial' })
      }
    }
    if (exploracionHasPositiveFinding(input.form) && !hasNonEmpty(input.form.especifique_positivos)) {
      missing.push({ field: 'especifique_positivos', label: 'especifique hallazgos positivos' })
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  if (tab === 'extension') {
    if (isDefaultExamenMedicoVariant(input.examVariant)) {
      return { ok: true }
    }
    const variant = input.examVariant.toUpperCase()
    if (variant === 'SODEXO') {
      const sodexo = validateSodexoExtensionForClinicalClose(input.sodexoExt)
      if (!sodexo.ok) {
        for (const err of sodexo.errors) {
          missing.push({ field: 'variant_extensions.SODEXO', label: err })
        }
      }
    }
    if (variant === 'FLOWSERVE') {
      const ext = input.flowserveExt
      if (!hasNonEmpty(ext?.area)) {
        missing.push({ field: 'variant_extensions.FLOWSERVE.area', label: 'área / puesto Flowserve' })
      }
      if (!hasNonEmpty(ext?.contacto_emergencia)) {
        missing.push({
          field: 'variant_extensions.FLOWSERVE.contacto_emergencia',
          label: 'contacto de emergencia',
        })
      }
      if (!hasNonEmpty(ext?.nivel_salud)) {
        missing.push({ field: 'variant_extensions.FLOWSERVE.nivel_salud', label: 'nivel de salud' })
      }
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  if (tab === 'impresion') {
    for (const rule of IMPRESION_COMBO_REQUIRED) {
      if (!hasNonEmpty(input.form[rule.field])) {
        missing.push({ field: rule.field, label: rule.label })
      }
    }
    const impresion =
      hasNonEmpty(input.form.impresion_diagnostica) ||
      hasNonEmpty(input.form.examen_medico_texto)
    if (!impresion) {
      missing.push({ field: 'impresion_diagnostica', label: 'impresión diagnóstica' })
    }
    if (!hasNonEmpty(input.recomendaciones)) {
      missing.push({ field: 'recomendaciones_clinicas', label: 'recomendaciones clínicas' })
    }
    return missing.length === 0 ? { ok: true } : { ok: false, missing }
  }

  return { ok: true }
}

/** Pestaña activa (outer + inner) → validación de salida. */
export function validateExamenMedicoActiveSection(
  outerTab: 'somatometria' | 'signos_vitales' | 'agudeza_visual' | 'examen_medico',
  innerTab: ExamenMedicoTabId,
  input: ExamenMedicoValidationInput,
): StudyCaptureValidationResult {
  if (outerTab === 'examen_medico') {
    return validateExamenMedicoTab(innerTab, input)
  }
  return validateExamenMedicoTab(outerTab, input)
}

/** Orden canónico de pestañas al cerrar captura (outer 1–3 + inner). */
export const EXAMEN_MEDICO_TABS_FOR_CLOSE: ExamenMedicoTabId[] = [
  'somatometria',
  'signos_vitales',
  'agudeza_visual',
  'antecedentes',
  'exploracion',
  'extension',
  'impresion',
]

export function validateExamenMedicoForClinicalClose(
  input: ExamenMedicoValidationInput,
): StudyCaptureValidationResult {
  for (const tab of EXAMEN_MEDICO_TABS_FOR_CLOSE) {
    if (tab === 'extension' && isDefaultExamenMedicoVariant(input.examVariant)) {
      continue
    }
    const result = validateExamenMedicoTab(tab, input)
    if (!result.ok) return result
  }
  return { ok: true }
}

export function isExamenMedicoRequiredField(
  tab: ExamenMedicoTabId,
  fieldKey: string,
): boolean {
  if (tab === 'somatometria') {
    return fieldKey === 'peso_kg' || fieldKey === 'talla_m'
  }
  if (tab === 'signos_vitales') {
    return fieldKey === 'ta_sistolica' || fieldKey === 'fc_min'
  }
  if (tab === 'agudeza_visual') {
    return fieldKey === 'vision_lejana_od' || fieldKey === 'vision_lejana_oi'
  }
  if (tab === 'antecedentes') {
    return fieldKey === 'm1_sexo' || fieldKey.startsWith('antecedentes_captured.')
  }
  if (tab === 'impresion') {
    return (
      IMPRESION_COMBO_REQUIRED.some((r) => r.field === fieldKey) ||
      fieldKey === 'impresion_diagnostica' ||
      fieldKey === 'recomendaciones_clinicas'
    )
  }
  return false
}
