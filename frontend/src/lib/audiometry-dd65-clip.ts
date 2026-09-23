/**
 * Recorte vertical del PDF DD65 V2 (p. ej. `audio normal.pdf`):
 *   - Inicio: título «Audiograma Tono Puro» (sin datos del paciente arriba).
 *   - Fin: justo antes de «Descripción» / «DESCRIPCIÓN AUDIOMÉTRICA».
 *
 * Ratios sobre la página 1 rasterizada a ancho completo @ AUDIOMETRY_RENDER_DPI.
 * Carta ≈ 612×792 pt; Y0≈214 pt y Y1≈562 pt desde el borde superior del bitmap
 * del bitmap (Y crece hacia abajo en el PNG).
 */
export const AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO = 0.27
export const AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO = 0.71

export const AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID = 'dd65-audiogram-tono-puro-v3'

export const AUDIOMETRY_RENDER_DPI = 150
