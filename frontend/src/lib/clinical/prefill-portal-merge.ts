/**
 * Fusiona snapshot del portal de prellenado (Módulo 1) en antecedentes del examen.
 * O9-28 — datos del enlace deben reflejarse en captura clínica/tests.
 */

const PORTAL_SECTIONS = [
  'datos_personales',
  'historia_laboral',
  'heredo_familiares',
  'patologicos',
  'no_patologicos',
] as const

function isEmptySection(value: unknown): boolean {
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) return false
  return !Object.values(value as Record<string, unknown>).some(
    (v) => v !== null && v !== undefined && v !== '' && v !== 'NEGADO',
  )
}

function sectionNeedsFill(existing: unknown, incoming: unknown): boolean {
  if (isEmptySection(existing) && !isEmptySection(incoming)) return true
  return isEmptySection(existing) && isEmptySection(incoming) === false
}

/** Mezcla portal → snapshot solo donde el snapshot aún no tiene datos. */
export function mergePortalPrefillIntoAntecedentes(
  captured: Record<string, unknown> | null | undefined,
  prefilled: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!prefilled) return captured ?? {}
  const out: Record<string, unknown> = { ...(captured ?? {}) }
  for (const sec of PORTAL_SECTIONS) {
    const fromPortal = prefilled[sec]
    if (fromPortal == null) continue
    const current = out[sec]
    if (sectionNeedsFill(current, fromPortal) || isEmptySection(current)) {
      out[sec] = fromPortal
    }
  }
  return out
}

export function antecedentesCapturedIsEmpty(captured: Record<string, unknown> | null | undefined): boolean {
  if (!captured) return true
  return PORTAL_SECTIONS.every((sec) => isEmptySection(captured[sec]))
}
