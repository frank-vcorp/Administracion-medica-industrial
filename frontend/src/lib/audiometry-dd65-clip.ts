/**
 * Recorte del audiograma en el PDF que sube el usuario (DD65 V2).
 *
 * Sólo las dos gráficas de tono puro. En la página A4 los rótulos
 * Derecho/Izquierdo quedan hacia 0.276 y «Notas:» hacia 0.544, así que
 * 0.27–0.60 cubre el cuadriculado y se detiene antes de «Audiograma Habla»
 * (~0.617). La ficha del equipo no entra en el recorte: esos datos se
 * componen en el formato institucional.
 *
 * Ratios sobre la página 1 rasterizada a ancho completo @ AUDIOMETRY_RENDER_DPI.
 */
export const AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO = 0.27
export const AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO = 0.6

export const AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID = 'dd65-audiogram-tono-puro-v4'

export const AUDIOMETRY_RENDER_DPI = 150
