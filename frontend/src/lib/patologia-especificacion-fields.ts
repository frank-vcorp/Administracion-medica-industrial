/** Patológicos (APP) que requieren nombre/especificación cuando el estado es SÍ (F-21 / O9-29). */
export const PATOLOGIA_ESPECIFICACION_FIELDS = new Set([
  'exantematicas',
  'psiquiatricas',
  'otras',
])

export function patologiaRequiresEspecificacion(field: string): boolean {
  return PATOLOGIA_ESPECIFICACION_FIELDS.has(field)
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
