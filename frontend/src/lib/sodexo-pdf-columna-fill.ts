import type { SodexoColumnaExtension } from '@/lib/sodexo-examen-fisico-columna'
import {
  SODEXO_COLUMNA_ARCO_PDF,
  SODEXO_COLUMNA_CURVA_PDF,
  SODEXO_COLUMNA_DOLOR_PDF,
  SODEXO_COLUMNA_ESCOLIOSIS_PDF,
  SODEXO_COLUMNA_ESPASMO_PDF,
} from '@/lib/sodexo-examen-fisico-columna'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'

export function fillSodexoColumnaFromExtension(
  form: PdfForm,
  data: SodexoColumnaExtension | null | undefined,
) {
  if (!data) return

  const curvas = data.curvas ?? {}
  for (const [key, nad] of Object.entries(curvas)) {
    if (!nad) continue
    const map = SODEXO_COLUMNA_CURVA_PDF[key]
    const field = map?.[nad]
    if (field) sodexoSetCheck(form, field, true)
  }

  if (data.escoliosis) {
    const field = SODEXO_COLUMNA_ESCOLIOSIS_PDF[data.escoliosis]
    if (field) sodexoSetCheck(form, field, true)
  }

  const arcos = data.arcos ?? {}
  for (const [key, res] of Object.entries(arcos)) {
    const pair = SODEXO_COLUMNA_ARCO_PDF[key]
    if (!pair) continue
    if (res === 'NORMAL') sodexoSetCheck(form, pair.normal, true)
    if (res === 'ANORMAL') sodexoSetCheck(form, pair.abnormal, true)
  }

  if (data.dolor === 'SI') sodexoSetCheck(form, SODEXO_COLUMNA_DOLOR_PDF.SI, true)
  if (data.dolor === 'NO') sodexoSetCheck(form, SODEXO_COLUMNA_DOLOR_PDF.NO, true)
  if (data.espasmo === 'SI') sodexoSetCheck(form, SODEXO_COLUMNA_ESPASMO_PDF.SI, true)
  if (data.espasmo === 'NO') sodexoSetCheck(form, SODEXO_COLUMNA_ESPASMO_PDF.NO, true)

  if (data.observaciones?.trim()) {
    sodexoSetText(form, 'Texto913', data.observaciones.trim())
  }
}
