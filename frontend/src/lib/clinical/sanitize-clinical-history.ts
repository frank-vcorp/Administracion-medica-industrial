const ENUM_EMPTY = new Set(['', 'undefined', 'null'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Quita cadenas vacías que el schema de historial rechaza en enums
 * (`turno: ""` no es un turno). No inventa valores clínicos.
 */
export function sanitizeClinicalHistoryInput(raw: unknown): unknown {
  if (!isRecord(raw)) return undefined
  const clone: Record<string, unknown> = {}
  for (const [sectionKey, sectionValue] of Object.entries(raw)) {
    if (sectionKey === '_provenance') continue
    if (!isRecord(sectionValue)) {
      clone[sectionKey] = sectionValue
      continue
    }
    const section: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(sectionValue)) {
      if (typeof value === 'string' && ENUM_EMPTY.has(value.trim())) continue
      if (isRecord(value)) {
        const nested: Record<string, unknown> = {}
        for (const [innerKey, innerValue] of Object.entries(value)) {
          if (typeof innerValue === 'string' && ENUM_EMPTY.has(innerValue.trim())) continue
          nested[innerKey] = innerValue
        }
        if (Object.keys(nested).length === 0) continue
        section[key] = nested
        continue
      }
      section[key] = value
    }
    clone[sectionKey] = section
  }
  return clone
}
