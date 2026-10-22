/**
 * §9.5 arcos — mapeo PDF pendiente por celda (rejilla AcroForm).
 * La captura en extensión ya persiste `examen_fisico_arcos_sodexo`; el volcado al PDF
 * se completará al cerrar el inventario casilla a casilla.
 */
import type { SodexoArcosCellValue } from '@/lib/sodexo-examen-fisico-arcos'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck } from '@/lib/sodexo-pdf-acroform'

/** Inventario parcial MS flexión (fila superior rejilla izquierda). */
const MS_FLEXION_PDF: Record<string, string> = {
  'ms:flexion:hombro:D': 'Check Box695',
  'ms:flexion:hombro:I': 'Check Box696',
  'ms:flexion:codo:D': 'Check Box697',
  'ms:flexion:codo:I': 'Check Box698',
  'ms:flexion:muneca:D': 'Check Box699',
  'ms:flexion:muneca:I': 'Check Box700',
  'ms:flexion:dedos:D': 'Check Box701',
  'ms:flexion:dedos:I': 'Check Box702',
}

export function fillSodexoArcosFromExtension(
  form: PdfForm,
  map: Record<string, SodexoArcosCellValue> | null | undefined,
) {
  if (!map) return
  for (const [key, cell] of Object.entries(map)) {
    if (!cell?.anormal) continue
    const field = MS_FLEXION_PDF[key]
    if (field) sodexoSetCheck(form, field, true)
  }
}
