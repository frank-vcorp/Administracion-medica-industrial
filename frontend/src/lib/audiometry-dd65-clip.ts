/**
 * Recorte vertical del PDF DD65 V2 (p. ej. `audio normal.pdf`).
 *
 * Una sola ficha del equipo y, debajo, las dos gráficas de tono puro.
 * En la página A4 el nombre del paciente queda hacia 0.14, los rótulos
 * Derecho/Izquierdo hacia 0.276 y «Notas:» hacia 0.544. 0.12–0.56 cubre
 * esa ficha y las gráficas, y se detiene antes de «Audiograma Habla» (~0.617).
 *
 * Ratios sobre la página 1 rasterizada a ancho completo @ AUDIOMETRY_RENDER_DPI.
 */
export const AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO = 0.12
export const AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO = 0.56

export const AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID = 'dd65-audiogram-ficha-y-graficas-v5'

export const AUDIOMETRY_RENDER_DPI = 150
