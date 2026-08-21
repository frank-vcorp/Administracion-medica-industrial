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
 *
 * @fallback ARCH-20260820-01 Fase 3 (SPEC §9.1, §12.1, AC-3.3)
 *
 * **Esta función es un fallback explícito y trazado.** No es la fuente
 * primaria de routing de IA desde Fase 3 en adelante.
 *
 * Flujo canónico en Events (SPEC §9.1):
 *   1. `event-test.actions.ts` consulta primero `getPublishedCalibrationForEventTest`
 *      (versión V3 `published`). Si hay `canonicalStudyType` published, enruta
 *      por ese valor (AC-3.2). Si `enabled=false`, no dispara IA y marca el
 *      snapshot con `calibration_source="calibration_disabled"` (AC-3.1).
 *   2. **Sólo si el resolver devuelve `null`** (no hay V3 published — incluye
 *      calibraciones V1/V2 no migradas y pruebas sin `aiCalibration`) se invoca
 *      esta heurística, marcando el snapshot con `source="legacy_heuristic"`
 *      (AC-3.3, SPEC §12.1).
 *
 * La función **se conserva** (no se elimina) porque hasta Fase 7 (eliminación
 * de hardcodeos) muchas pruebas del catálogo no tendrán V3 published y
 * caerán legítimamente aquí. Eliminarla antes violaría SPEC §12.3 (regresión
 * silenciosa). La trazabilidad del fallback está en
 * `extraction_snapshot.structuredData.audit.calibration_source`.
 *
 * @deprecated como fuente primaria desde Fase 3 — usar
 *   `getPublishedCalibrationForEventTest` primero. Esta heurística sólo debe
 *   invocarse como fallback trazado (SPEC §9.1 paso 2).
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
