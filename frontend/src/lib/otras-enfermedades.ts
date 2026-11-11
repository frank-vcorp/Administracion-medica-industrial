/**
 * Múltiples entradas de texto libre bajo APP → Patológicos → «Otras enfermedades».
 * Persistido en `patologicos.otras_enfermedades` (string[]); compat con
 * `otras.detalle.especificacion` (string único legacy).
 */

export const OTRAS_ENFERMEDADES_KEY = 'otras_enfermedades' as const

export function isPatologicosMetaKey(key: string): boolean {
  return key === OTRAS_ENFERMEDADES_KEY
}

/** Normaliza entrada cruda (array, string único legacy o vacío). */
export function coerceOtrasEnfermedadesList(raw: unknown): string[] {
  if (raw === undefined || raw === null) return []
  if (typeof raw === 'string') {
    const t = raw.trim()
    return t ? [t] : []
  }
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => String(x ?? '').trim())
    .filter((s) => s.length > 0)
}

/**
 * Hidrata la lista UI desde un section `patologicos` persistido:
 * prioriza `otras_enfermedades[]`; si falta, usa `otras.detalle.especificacion`.
 */
export function hydrateOtrasEnfermedadesFromPatologicos(
  patologicos: Record<string, unknown> | undefined,
): string[] {
  if (!patologicos) return []
  const fromList = coerceOtrasEnfermedadesList(patologicos[OTRAS_ENFERMEDADES_KEY])
  if (fromList.length > 0) return fromList
  const otras = patologicos.otras
  if (otras && typeof otras === 'object' && otras !== null && 'detalle' in otras) {
    const det = (otras as { detalle?: { especificacion?: string } }).detalle
    const esp = String(det?.especificacion ?? '').trim()
    if (esp) return [esp]
  }
  return []
}

/** Líneas no vacías para persistir; vacío → omitir clave en payload. */
export function otrasEnfermedadesForPersist(list: string[]): string[] {
  return list.map((s) => s.trim()).filter((s) => s.length > 0)
}

export type OtrasPatologiaShape = {
  estado: string
  detalle?: {
    desde_cuando?: string
    tratamiento?: string
    observaciones?: string
    especificacion?: string
  }
}

/** Mantiene `otras.detalle.especificacion` alineada con el primer ítem de la lista (legacy/PDF). */
export function syncOtrasEspecificacion<T extends OtrasPatologiaShape>(
  list: string[],
  otrasEntry: T | undefined,
): T | undefined {
  if (!otrasEntry || otrasEntry.estado !== 'SI') return otrasEntry
  const trimmed = otrasEnfermedadesForPersist(list)
  const detalle = otrasEntry.detalle ?? {
    desde_cuando: '',
    tratamiento: '',
    observaciones: '',
    especificacion: '',
  }
  return {
    ...otrasEntry,
    detalle: { ...detalle, especificacion: trimmed[0] ?? '' },
  }
}

/** Para display/PDF: nombres de otras enfermedades en un solo string. */
export function formatOtrasEnfermedadesDisplay(
  patologicos: Record<string, unknown> | null | undefined,
): string {
  if (!patologicos) return ''
  const names = hydrateOtrasEnfermedadesFromPatologicos(patologicos)
  return names.join('; ')
}
