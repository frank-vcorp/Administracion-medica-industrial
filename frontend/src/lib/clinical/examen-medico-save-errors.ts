import { ZodError } from 'zod'
import { formatZodIssueMessage } from '@/lib/zod-user-messages'

export type ExamenMedicoSaveNavigation = {
  outerTab?: 'somatometria' | 'signos_vitales' | 'agudeza_visual' | 'examen_medico'
  innerTab?: 'antecedentes' | 'exploracion' | 'extension' | 'impresion'
}

const IMPRESION_FIELDS = new Set([
  'impresion_diagnostica',
  'examen_medico_texto',
  'recomendaciones_clinicas',
  'estado_nutricional',
  'salud_bucal',
  'agudeza_visual_resumen',
  'presion_arterial_resumen',
  'audiometria_texto',
  'espirometria_texto',
  'laboratorios_texto',
  'radiografia_texto',
  'restricciones',
  'observaciones_finales',
  'aptitud',
])

const EXPLORACION_PREFIXES = [
  'neurologico',
  'cabeza',
  'piel_y_faneras',
  'oidos_',
  'ojos',
  'boca_',
  'nariz',
  'faringe',
  'cuello',
  'torax',
  'corazon',
  'campos_pulmonares',
  'abdomen',
  'genitourinario',
  'columna_vertebral',
  'test_adam',
  'ms_',
  'fuerza_muscular',
  'circulacion_venosa',
  'arco_de_movilidad',
  'tono_muscular',
  'coordinacion',
  'test_romberg',
  'signo_',
  'prueba_',
  'presencia_quiste',
  'especificar_quiste',
  'especifique_positivos',
]

export function zodErrorToFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key =
      issue.path.length > 0
        ? issue.path.map(String).join('.')
        : '_form'
    if (!fieldErrors[key]) fieldErrors[key] = []
    fieldErrors[key].push(formatZodIssueMessage(issue))
  }
  return fieldErrors
}

export function resolveExamenMedicoSaveNavigation(
  fieldErrors: Record<string, string[]>,
): ExamenMedicoSaveNavigation {
  const firstKey = Object.keys(fieldErrors)[0]
  if (!firstKey) return {}
  return resolveNavigationForFieldKey(firstKey)
}

export function resolveNavigationForFieldKey(fieldKey: string): ExamenMedicoSaveNavigation {
  if (fieldKey.startsWith('antecedentes_captured') || fieldKey === 'modulo1') {
    return { outerTab: 'examen_medico', innerTab: 'antecedentes' }
  }
  if (fieldKey.startsWith('variant_extensions')) {
    return { outerTab: 'examen_medico', innerTab: 'extension' }
  }
  if (IMPRESION_FIELDS.has(fieldKey) || fieldKey.startsWith('impresion')) {
    return { outerTab: 'examen_medico', innerTab: 'impresion' }
  }
  if (EXPLORACION_PREFIXES.some((p) => fieldKey.startsWith(p) || fieldKey === p.replace('_', ''))) {
    return { outerTab: 'examen_medico', innerTab: 'exploracion' }
  }
  if (fieldKey === 'peso_kg' || fieldKey === 'talla_m' || fieldKey === 'imc' || fieldKey === 'complexion') {
    return { outerTab: 'somatometria' }
  }
  if (
    fieldKey === 'ta_sistolica' ||
    fieldKey === 'ta_diastolica' ||
    fieldKey === 'fc_min' ||
    fieldKey === 'fr_min' ||
    fieldKey === 'saturacion_oxigeno'
  ) {
    return { outerTab: 'signos_vitales' }
  }
  if (fieldKey.startsWith('vision_') || fieldKey.startsWith('lejana_') || fieldKey.startsWith('cercana_') ||
      fieldKey === 'reflejos' || fieldKey === 'test_ishihara' || fieldKey === 'campimetria') {
    return { outerTab: 'agudeza_visual' }
  }
  return { outerTab: 'examen_medico', innerTab: 'exploracion' }
}

/** Mensajes de cierre de captura → pestaña y campo resaltado (F17). */
export function mapExamenMedicoGateError(gateMessage: string): {
  fieldErrors: Record<string, string[]>
  navigation: ExamenMedicoSaveNavigation
} {
  const msg = gateMessage.trim()
  if (/somatometr/i.test(msg)) {
    return {
      fieldErrors: { peso_kg: [msg], talla_m: [msg] },
      navigation: { outerTab: 'somatometria' },
    }
  }
  if (/signos vitales/i.test(msg)) {
    return {
      fieldErrors: { ta_sistolica: [msg], fc_min: [msg] },
      navigation: { outerTab: 'signos_vitales' },
    }
  }
  if (/agudeza visual/i.test(msg)) {
    return {
      fieldErrors: { vision_lejana_od: [msg] },
      navigation: { outerTab: 'agudeza_visual' },
    }
  }
  if (/impresión/i.test(msg)) {
    return {
      fieldErrors: { impresion_diagnostica: [msg] },
      navigation: { outerTab: 'examen_medico', innerTab: 'impresion' },
    }
  }
  if (/recomendaciones/i.test(msg)) {
    return {
      fieldErrors: { recomendaciones_clinicas: [msg] },
      navigation: { outerTab: 'examen_medico', innerTab: 'impresion' },
    }
  }
  if (/Sodexo/i.test(msg)) {
    return {
      fieldErrors: { 'variant_extensions.SODEXO': [msg] },
      navigation: { outerTab: 'examen_medico', innerTab: 'extension' },
    }
  }
  return {
    fieldErrors: { _form: [msg] },
    navigation: { outerTab: 'examen_medico', innerTab: 'impresion' },
  }
}

export function examFieldRingClass(hasError: boolean, base: string): string {
  return hasError
    ? `${base} ring-2 ring-red-500 border-red-400 bg-red-50/40`
    : base
}
