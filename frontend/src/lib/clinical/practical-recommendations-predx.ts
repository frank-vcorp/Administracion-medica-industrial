/**
 * AMI-SR F-017 R-06: recomendación práctica para pre-llenar el cuadro del médico.
 * Prioriza `practical_recommendation` del snapshot; fallback determinista para
 * snapshots legacy sin ese campo (espirometría / audiometría).
 */

export interface PredxPracticalInput {
  summary?: string | null
  clinical_state?: string | null
  practical_recommendation?: string | null
  clasificacion_hipoacusia?: Record<string, unknown> | null
  resumen_bilateral?: Record<string, unknown> | null
}

function norm(value: unknown): string {
  if (value == null) return ''
  return String(value).trim().toUpperCase()
}

const ESPIRO = {
  normal:
    'USO ADECUADO DE EQUIPO DE PROTECCIÓN ESPIROMETRÍAS DE SEGUIMIENTO ANUAL',
  restrictivo:
    'INDICAR EJERCICIOS RESPIRATORIOS SE SUGIERE COMPLEMENTAR CON RADIOGRAFÍA DE TÓRAX USO ADECUADO DE EQUIPO DE PROTECCIÓN ESPIROMETRÍAS DE SEGUIMIENTO EN 12 SEMANAS',
  obstructivo:
    'INDICAR EJERCICIOS RESPIRATORIOS USO ADECUADO DE EQUIPO DE PROTECCIÓN RESPIRATORIA ESPIROMETRÍAS DE SEGUIMIENTO EN 12 SEMANAS',
  mixto:
    'INDICAR EJERCICIOS RESPIRATORIOS USO ADECUADO DE EQUIPO DE PROTECCIÓN RESPIRATORIA ESPIROMETRÍAS DE SEGUIMIENTO EN 12 SEMANAS',
  non_conclusive: 'REPETIR ESPIROMETRÍA CON TÉCNICA ADECUADA ANTES DE INTERPRETAR',
} as const

const AUDIO = {
  normal: 'AUDIOMETRÍA DE SEGUIMIENTO ANUAL',
  hipoacusia:
    'USO ADECUADO DE TAPONES AUDITIVOS AUDIOMETRÍA DE SEGUIMIENTO EN 12 SEMANAS POSTERIORMENTE CADA AÑO',
  non_conclusive:
    'REPETIR AUDIOMETRÍA CON CONDICIONES ADECUADAS DE CABINA Y TÉCNICA',
} as const

function detectEspirometriaPattern(summary: string): keyof typeof ESPIRO {
  const text = norm(summary)
  if (text.includes('MIXTO')) return 'mixto'
  if (text.includes('OBSTRUCT')) return 'obstructivo'
  if (text.includes('RESTRIC')) return 'restrictivo'
  return 'normal'
}

function detectAudiometriaPattern(predx: PredxPracticalInput): keyof typeof AUDIO {
  if (norm(predx.clinical_state) === 'AI_NON_CONCLUSIVE') return 'non_conclusive'

  const clas = predx.clasificacion_hipoacusia
  if (clas && typeof clas === 'object') {
    const values = [clas.right, clas.left, clas.bilateral].map(norm)
    if (values.some((v) => v && v !== 'NO_APLICA' && v !== 'NO APLICA' && v !== 'NORMAL')) {
      return 'hipoacusia'
    }
  }

  const bilateral = predx.resumen_bilateral
  if (bilateral && typeof bilateral === 'object') {
    const status = norm(bilateral.status)
    if (status && !status.includes('NORMAL') && !status.includes('LIMITES_NORMALES')) {
      return 'hipoacusia'
    }
  }

  const text = norm(predx.summary)
  if (text.includes('HIPOACUS') || text.includes('PERDIDA') || text.includes('PÉRDIDA')) {
    return 'hipoacusia'
  }
  if (text.includes('NO CONCLUY')) return 'non_conclusive'
  return 'normal'
}

function legacyFallback(studyType: string | null | undefined, predx: PredxPracticalInput): string {
  const summary = predx.summary ?? ''
  if (studyType === 'Espirometria') {
    if (norm(predx.clinical_state) === 'AI_NON_CONCLUSIVE') return ESPIRO.non_conclusive
    return ESPIRO[detectEspirometriaPattern(summary)]
  }
  if (studyType === 'Audiometria') {
    return AUDIO[detectAudiometriaPattern(predx)]
  }
  return ''
}

/** Texto práctico para pre-llenar "Recomendaciones (opcional)". */
export function resolvePracticalRecommendation(
  predx: PredxPracticalInput,
  studyType?: string | null,
): string {
  const explicit = predx.practical_recommendation?.trim()
  if (explicit) return explicit
  return legacyFallback(studyType, predx)
}
