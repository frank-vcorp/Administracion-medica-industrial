const SECTION_KEYS = [
  'datos_personales',
  'historia_laboral',
  'heredo_familiares',
  'no_patologicos',
  'patologicos',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Hay dato clínico real (no el prellenado vacío de NEGADO / cadena vacía). */
export function antecedentesSectionHasContent(section: unknown): boolean {
  if (!isRecord(section)) return false
  return Object.values(section).some((value) => {
    if (value === null || value === undefined || value === '') return false
    if (typeof value === 'number') return Number.isFinite(value)
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const text = value.trim()
      return text.length > 0 && text !== 'NEGADO' && text !== 'NO APLICA' && text !== 'DESCONOCE'
    }
    if (isRecord(value) && 'estado' in value) {
      const estado = String(value.estado ?? '').trim()
      if (estado === 'SI') return true
      if (estado === 'NEGADO' || estado === 'NO APLICA' || estado === '') return false
      return true
    }
    return antecedentesSectionHasContent(value)
  })
}

/**
 * Copia los antecedentes del perfil del paciente a la consulta.
 * Lo ya capturado en la consulta gana. Si esa sección está vacía, entra el
 * historial del perfil y, si tampoco tiene dato, el snapshot del examen de
 * la visita.
 */
export function mergeProfileAntecedentesIntoConsulta(
  saved: unknown,
  profile: unknown,
  visitSnapshot?: unknown,
): Record<string, unknown> {
  const savedRecord = isRecord(saved) ? saved : {}
  const profileRecord = isRecord(profile) ? profile : {}
  const visitRecord = isRecord(visitSnapshot) ? visitSnapshot : {}
  const out: Record<string, unknown> = {}

  for (const key of SECTION_KEYS) {
    if (antecedentesSectionHasContent(savedRecord[key])) {
      out[key] = savedRecord[key]
    } else if (antecedentesSectionHasContent(profileRecord[key])) {
      out[key] = profileRecord[key]
    } else if (antecedentesSectionHasContent(visitRecord[key])) {
      out[key] = visitRecord[key]
    } else if (isRecord(savedRecord[key])) {
      out[key] = savedRecord[key]
    } else if (isRecord(profileRecord[key])) {
      out[key] = profileRecord[key]
    } else if (isRecord(visitRecord[key])) {
      out[key] = visitRecord[key]
    }
  }

  return out
}

export function modulo1Record(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value)
    }
  }
  return out
}
