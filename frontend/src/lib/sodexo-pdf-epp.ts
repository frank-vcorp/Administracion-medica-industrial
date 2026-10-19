/**
 * Historia ocupacional — EPP (casillas AcroForm; captura en extensión §3).
 */
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'

const EPP_CHECKS: Partial<
  Record<keyof SodexoExtensionData, string>
> = {
  epp_casco: 'Check Box326',
  epp_mascarilla: 'Check Box325',
  epp_lentes: 'Check Box327',
  epp_botas: 'Check Box324',
  epp_guantes: 'Check Box323',
  epp_faja: 'Check Box328',
}

export function fillSodexoEpp(form: PdfForm, ext: SodexoExtensionData | null) {
  if (!ext) return
  const flags: string[] = []
  for (const [key, box] of Object.entries(EPP_CHECKS) as [keyof SodexoExtensionData, string][]) {
    if (!box) continue
    if (ext[key] === true) {
      sodexoSetCheck(form, box, true)
      flags.push(String(key).replace('epp_', '').toUpperCase())
    }
  }
  if (flags.length) sodexoSetText(form, 'Texto34', flags.join(', '))

  const uso = ext.epp_uso
  if (uso === 'SI') sodexoSetCheck(form, 'Check Box329', true)
  else if (uso === 'NO') sodexoSetCheck(form, 'Check Box330', true)
  else if (uso === 'OCASIONAL') sodexoSetCheck(form, 'Check Box331', true)
  else if (flags.length) sodexoSetCheck(form, 'Check Box329', true)

  if (!uso && flags.length === 0) {
    sodexoSetCheck(form, 'Check Box330', true)
  }
}
