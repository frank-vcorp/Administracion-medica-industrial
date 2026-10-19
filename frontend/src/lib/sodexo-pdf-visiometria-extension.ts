import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck } from '@/lib/sodexo-pdf-acroform'

const VISIOMETRIA_CHECK_MAP: {
  key: keyof NonNullable<SodexoExtensionData['visiometria_casillas']>
  box: string
}[] = [
  { key: 'lejana_od_sin_correccion', box: 'Check Box818' },
  { key: 'lejana_oi_sin_correccion', box: 'Check Box816' },
  { key: 'lejana_od_con_correccion', box: 'Check Box814' },
  { key: 'lejana_oi_con_correccion', box: 'Check Box812' },
  { key: 'cercana_od_sin_correccion', box: 'Check Box810' },
  { key: 'cercana_oi_sin_correccion', box: 'Check Box808' },
]

export function fillSodexoVisiometriaFromExtension(
  form: PdfForm,
  ext: SodexoExtensionData | null,
) {
  const v = ext?.visiometria_casillas
  if (!v) return
  for (const { key, box } of VISIOMETRIA_CHECK_MAP) {
    if (v[key]) sodexoSetCheck(form, box, true)
  }
}
