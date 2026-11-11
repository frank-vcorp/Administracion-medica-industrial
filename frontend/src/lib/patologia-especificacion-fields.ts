/** Patológicos (APP) que requieren nombre/especificación cuando el estado es SÍ (F-21 / O9-29). */
export const PATOLOGIA_ESPECIFICACION_FIELDS = new Set([
  'exantematicas',
  'psiquiatricas',
  'otras',
])

/** Especificación visible siempre (campo abierto), no solo al marcar SÍ. */
export const PATOLOGIA_ESPECIFICACION_SIEMPRE_VISIBLE = new Set(['exantematicas'])

export function patologiaRequiresEspecificacion(field: string): boolean {
  return PATOLOGIA_ESPECIFICACION_FIELDS.has(field)
}

export function patologiaEspecificacionSiempreVisible(field: string): boolean {
  return PATOLOGIA_ESPECIFICACION_SIEMPRE_VISIBLE.has(field)
}

export function patologiaEspecificacionPlaceholder(field: string): string {
  switch (field) {
    case 'exantematicas':
      return 'Especificación (ej: varicela infantil, sarampión)'
    case 'psiquiatricas':
      return 'Especificación (ej: depresión mayor, ansiedad generalizada)'
    case 'otras':
      return 'Nombre de la enfermedad u otra condición'
    default:
      return 'Especificación'
  }
}
