/**
 * Recorte vertical del PDF DD65 V2 (p. ej. `audio normal.pdf`).
 *
 * La banda incluye las dos gráficas de tono puro (oído derecho y oído
 * izquierdo). En la página A4 del DD65 los rótulos «Derecho / Izquierdo»
 * quedan hacia 0.276 y «Notas:» hacia 0.544, así que 0.27–0.60 cubre el
 * cuadriculado completo y se detiene antes de «Audiograma Habla» (~0.617).
 * No recortar por encima de 0.27: el borde superior del cuadriculado queda
 * justo ahí. No bajar de 0.60: entra el audiograma de habla.
 *
 * Ratios sobre la página 1 rasterizada a ancho completo @ AUDIOMETRY_RENDER_DPI.
 */
export const AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO = 0.27
export const AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO = 0.6

export const AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID = 'dd65-audiogram-tono-puro-v4'

export const AUDIOMETRY_RENDER_DPI = 150
