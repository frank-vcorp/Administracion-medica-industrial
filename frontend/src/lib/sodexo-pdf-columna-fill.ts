import type { SodexoColumnaExtension } from '@/lib/sodexo-examen-fisico-columna'
import {
  SODEXO_COLUMNA_ARCO_PDF,
  SODEXO_COLUMNA_ARCO_SINTOMA_PDF,
  SODEXO_COLUMNA_CURVA_PDF,
  SODEXO_COLUMNA_ESCOLIOSIS_PDF,
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

  const escoliosis = data.escoliosis ?? {}
  for (const [key, val] of Object.entries(escoliosis)) {
    if (val !== 'NO' && val !== 'SI') continue
    const pair = SODEXO_COLUMNA_ESCOLIOSIS_PDF[key]
    const field = pair?.[val]
    if (field) sodexoSetCheck(form, field, true)
  }

  const arcos = data.arcos ?? {}
  for (const [key, res] of Object.entries(arcos)) {
    const pair = SODEXO_COLUMNA_ARCO_PDF[key]
    if (pair) {
      if (res === 'NORMAL') sodexoSetCheck(form, pair.normal, true)
      if (res === 'ANORMAL') sodexoSetCheck(form, pair.abnormal, true)
      continue
    }
    const sintoma = SODEXO_COLUMNA_ARCO_SINTOMA_PDF[key]
    if (!sintoma) continue
    if (res === 'NO') sodexoSetCheck(form, sintoma.NO, true)
    if (res === 'SI') sodexoSetCheck(form, sintoma.SI, true)
  }

  if (data.observaciones?.trim()) {
    sodexoSetText(form, 'Texto913', data.observaciones.trim())
  }
}
