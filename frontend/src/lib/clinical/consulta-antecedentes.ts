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
  return Object.values(section).some((value) => fieldHasClinicalContent(value))
}

function fieldHasClinicalContent(value: unknown): boolean {
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
    if (estado === 'NEGADO' || estado === 'NO APLICA' || estado === '') {
      const detalle = value.detalle
      if (isRecord(detalle)) {
        return Object.values(detalle).some((d) => fieldHasClinicalContent(d))
      }
      return false
    }
    return true
  }
  if (isRecord(value)) {
    return Object.values(value).some((v) => fieldHasClinicalContent(v))
  }
  return false
}

function mergeSectionFieldwise(
  savedSec: unknown,
  profileSec: unknown,
  visitSec: unknown,
): Record<string, unknown> | undefined {
  const saved = isRecord(savedSec) ? savedSec : {}
  const profile = isRecord(profileSec) ? profileSec : {}
  const visit = isRecord(visitSec) ? visitSec : {}
  const keys = new Set([...Object.keys(saved), ...Object.keys(profile), ...Object.keys(visit)])
  if (keys.size === 0) return undefined

  const out: Record<string, unknown> = {}
  for (const key of keys) {
    const s = saved[key]
    const p = profile[key]
    const v = visit[key]
    if (fieldHasClinicalContent(s)) out[key] = s
    else if (fieldHasClinicalContent(p)) out[key] = p
    else if (fieldHasClinicalContent(v)) out[key] = v
    else if (s !== undefined) out[key] = s
    else if (p !== undefined) out[key] = p
    else if (v !== undefined) out[key] = v
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Copia antecedentes del historial longitudinal (y snapshot de examen) a la consulta.
 * Lo ya capturado en la consulta gana **por campo**. Si un campo en consulta está vacío
 * o en NEGADO, entra el del historial maestro y luego el snapshot del examen de la visita.
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
    const merged = mergeSectionFieldwise(
      savedRecord[key],
      profileRecord[key],
      visitRecord[key],
    )
    if (merged) out[key] = merged
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
