/**
 * S8-05 — Audiencias del dictamen final: empleador (aptitud ocupacional) vs paciente (salud).
 */

export function readEmployerAptitudLaboral(
  physicalExamData: Record<string, unknown> | null | undefined,
): string {
  const aptitud = physicalExamData?.aptitud
  return typeof aptitud === 'string' ? aptitud.trim() : ''
}

export function readPatientHealthRecommendations(
  physicalExamData: Record<string, unknown> | null | undefined,
): string {
  const raw = physicalExamData?.recomendaciones_clinicas
  return typeof raw === 'string' ? raw.trim() : ''
}

/** El dictamen del paciente no debe incluir aptitud ni condicionantes laborales. */
export function patientDictamenHasRequiredContent(
  physicalExamData: Record<string, unknown> | null | undefined,
): boolean {
  return readPatientHealthRecommendations(physicalExamData).length > 0
}
