/**
 * @fileoverview Matriz documental de IA por EventTest.
 * @id ARCH-20260326-01
 * @backup context/checkpoints/CHK_ARCH-20260324-25.md
 *
 * Regla operativa: todo estudio debe intentar captura estructurada por IA para
 * reutilización posterior, ya provenga de documento externo o formulario interno.
 *
 * Las familias clínicas conocidas se mapean a study_type específico para que el
 * backend use extracción/prediagnóstico especializado. El resto cae en 'Otro'
 * para captura documental genérica y eventual prediagnóstico no concluyente.
 */

/** Types canónicos que acepta el backend V2 */
export type CanonicalAIStudyType =
  | 'Audiometria'
  | 'Laboratorio'
  | 'Espirometria'
  | 'Rayos_X'
  | 'Campimetria'
  | 'Electrocardiograma'
  | 'RiesgoCardiovascular'
  | 'Somatometria'
  | 'AgudezaVisual'
  | 'ExamenMedico'
  | 'Otro'

/** Referencia mínima de EventTest necesaria para determinar elegibilidad */
export interface StudyTestRef {
  testNameSnapshot: string
  test?: {
    code?: string | null
    category?: { name: string } | null
  } | null
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics for matching
}

/**
 * Devuelve el type canónico esperado por el backend V2.
 * La detección se basa en testNameSnapshot + test.category.name.
 * Los códigos de test son opacos y no se usan como criterio primario.
 */
export function getCanonicalAIStudyType(test: StudyTestRef): CanonicalAIStudyType | null {
  const name = normalize(test.testNameSnapshot)
  const catName = normalize(test.test?.category?.name ?? '')

  if (name.includes('somatometr') || name.includes('signos vitales')) return 'Somatometria'

  if (name.includes('agudeza visual')) return 'AgudezaVisual'

  if (name.includes('examen medico')) return 'ExamenMedico'

  // Familia audiometría.
  if (name.includes('audiometr')) return 'Audiometria'

  // Familia espirometría.
  if (name.includes('espirometr')) return 'Espirometria'

  // Familia electrocardiograma.
  if (
    name.includes('electrocardiograma') ||
    name.includes('electrocardio') ||
    name === 'ecg' ||
    name === 'ekg'
  ) {
    return 'Electrocardiograma'
  }

  // Familia campimetría.
  if (name.includes('campimetr')) return 'Campimetria'

  // Familia riesgo cardiovascular.
  if (
    name.includes('riesgo cardiovascular') ||
    name.includes('valoracion cardiovascular') ||
    name.includes('evaluacion cardiovascular')
  ) {
    return 'RiesgoCardiovascular'
  }

  // Imagenología documental.
  if (
    catName.includes('imagen') ||
    catName.includes('rayos x') ||
    name.includes('rayos x') ||
    name.includes('radiografia') ||
    name.includes('mastografia') ||
    name.includes('ultrasonido') ||
    name.includes('tomografia') ||
    name.includes('resonancia') ||
    name.includes('densitometr')
  ) {
    return 'Rayos_X'
  }

  // Laboratorio clínico documental.
  if (
    catName.includes('laboratorio') ||
    catName.includes('lab') ||
    name.includes('biometri') ||
    name.includes('orina') ||
    name.includes('ego ') ||
    name === 'ego' ||
    name.includes('sangre') ||
    name.includes('sanguinea') ||
    name.includes('quimica') ||
    name.includes('quimico') ||
    name.includes('colesterol') ||
    name.includes('glucosa') ||
    name.includes('trigliceri') ||
    name.includes('perfil hepat') ||
    name.includes('perfil lipid') ||
    name.includes('creatinin') ||
    name.includes('acido urico') ||
    name.includes('hormona') ||
    name.includes('hepatitis') ||
    name.includes('toxicolog') ||
    name.includes('copro') ||
    name.includes('antidoping') ||
    name.includes('vdrl') ||
    name.includes('vih') ||
    name.includes('cultivo')
  ) {
    return 'Laboratorio'
  }

  // Cualquier otro estudio documental entra a captura IA genérica.
  return 'Otro'
}

/** True si el estudio debe disparar pipeline IA V2 */
export function isAIEligibleEventTest(test: StudyTestRef): boolean {
  return getCanonicalAIStudyType(test) !== null
}

/** Etiqueta descriptiva para UI de estudios con IA (null si no es elegible) */
export function getAIWorkflowLabel(test: StudyTestRef): string | null {
  const studyType = getCanonicalAIStudyType(test)
  if (!studyType) return null
  const labels: Record<CanonicalAIStudyType, string> = {
    Audiometria: '🎧 Audiometría · IA',
    Laboratorio: '🧪 Laboratorio · IA',
    Espirometria: '💨 Espirometría · IA',
    Rayos_X: '🔬 Imagenología · IA',
    Campimetria: '🗺️ Campimetría · IA',
    Electrocardiograma: '💓 ECG · IA',
    RiesgoCardiovascular: '🫀 Riesgo Cardiovascular · IA',
    Somatometria: '⚖️ Somatometría · IA',
    AgudezaVisual: '👁️ Agudeza Visual · IA',
    ExamenMedico: '📋 Examen Médico · IA',
    Otro: '📄 Captura IA documental',
  }
  return labels[studyType]
}
