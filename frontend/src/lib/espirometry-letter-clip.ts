/**
 * Recorte fijo mitad inferior — hoja carta (Letter) 612×792 pt.
 * Origen arriba-izquierda; ancho completo, sin recorte horizontal.
 */
export const ESPIROMETRY_LETTER_WIDTH_PT = 612
export const ESPIROMETRY_LETTER_HEIGHT_PT = 792

/** Mitad inferior exacta: (0, 396) → (612, 792). */
export const ESPIROMETRY_LETTER_BOTTOM_CLIP_PT = {
  x0: 0,
  y0: 396,
  x1: ESPIROMETRY_LETTER_WIDTH_PT,
  y1: ESPIROMETRY_LETTER_HEIGHT_PT,
} as const

export const ESPIROMETRY_LETTER_BOTTOM_Y0_RATIO =
  ESPIROMETRY_LETTER_BOTTOM_CLIP_PT.y0 / ESPIROMETRY_LETTER_HEIGHT_PT

export const ESPIROMETRY_LETTER_BOTTOM_Y1_RATIO = 1

export const ESPIROMETRY_SOURCE_CROP_TEMPLATE_ID = 'sibelmed-letter-bottom-v1'
