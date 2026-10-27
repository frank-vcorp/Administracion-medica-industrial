/**
 * Persistencia segura de variant_extensions.SODEXO (evita borrados por autosave).
 */

export function deepMergeJson(prior: unknown, incoming: unknown): unknown {
  if (incoming === null || incoming === undefined) return prior
  if (prior === null || prior === undefined) return incoming

  if (Array.isArray(incoming)) {
    const priorArr = Array.isArray(prior) ? prior : []
    if (incoming.length === 0 && priorArr.length > 0) return prior
    return incoming
  }

  if (typeof incoming === 'string' || typeof prior === 'string') {
    const inc = typeof incoming === 'string' ? incoming : ''
    const prev = typeof prior === 'string' ? prior : ''
    if (prev.trim() && !inc.trim()) return prior
    return incoming
  }

  if (typeof incoming !== 'object' || typeof prior !== 'object') {
    if ((incoming === null || incoming === '') && prior !== null && prior !== undefined && prior !== '') {
      return prior
    }
    return incoming
  }

  const out: Record<string, unknown> = { ...(prior as Record<string, unknown>) }
  for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
    out[key] = deepMergeJson((prior as Record<string, unknown>)[key], value)
  }
  return out
}

/** Indica si el JSON guardado ya tenía captura clínica (no solo plantilla vacía). */
export function sodexoExtensionLooksPersisted(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const o = raw as Record<string, unknown>
  if (typeof o.tipo_examen === 'string' && o.tipo_examen) return true
  if (typeof o.contacto_emergencia === 'string' && o.contacto_emergencia.trim()) return true
  if (typeof o.telefono_emergencia === 'string' && o.telefono_emergencia.trim()) return true
  if (typeof o.actividades_cargo === 'string' && o.actividades_cargo.trim()) return true
  if (typeof o.matriz_riesgos_observaciones === 'string' && o.matriz_riesgos_observaciones.trim()) {
    return true
  }
  const json = JSON.stringify(raw)
  return json.length > 900
}

export function mergeVariantExtensionsForPersist(
  priorRaw: unknown,
  incomingRaw: unknown,
): Record<string, unknown> | undefined {
  const prior =
    priorRaw && typeof priorRaw === 'object' && !Array.isArray(priorRaw)
      ? (priorRaw as Record<string, unknown>)
      : {}
  const incoming =
    incomingRaw && typeof incomingRaw === 'object' && !Array.isArray(incomingRaw)
      ? (incomingRaw as Record<string, unknown>)
      : {}

  const keys = new Set([...Object.keys(prior), ...Object.keys(incoming)])
  if (keys.size === 0) return undefined

  const out: Record<string, unknown> = { ...prior, ...incoming }

  if ('SODEXO' in prior || 'SODEXO' in incoming) {
    const priorSodexo = prior.SODEXO
    const incomingSodexo = incoming.SODEXO
    const merged = deepMergeJson(priorSodexo, incomingSodexo)
    if (
      sodexoExtensionLooksPersisted(priorSodexo) &&
      !sodexoExtensionLooksPersisted(incomingSodexo)
    ) {
      out.SODEXO = priorSodexo
    } else {
      out.SODEXO = merged
    }
  }

  if ('FLOWSERVE' in prior || 'FLOWSERVE' in incoming) {
    out.FLOWSERVE = deepMergeJson(prior.FLOWSERVE, incoming.FLOWSERVE)
  }

  return out
}
