/**
 * Recorte vertical del PDF DD65 V2: desde el título «Audiograma Tono Puro»
 * hasta justo antes del bloque «Notas:» (gráficas bilaterales + tabla central).
 *
 * Calibrado con reportes AMI / capturas de Frank (FND-20260825-05, 2026-08-25).
 * Ratios sobre la página 1 rasterizada a ancho completo.
 */
export const AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO = 0.035
export const AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO = 0.87

export const AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID = 'dd65-audiogram-tono-puro-v1'

export const AUDIOMETRY_RENDER_DPI = 150
