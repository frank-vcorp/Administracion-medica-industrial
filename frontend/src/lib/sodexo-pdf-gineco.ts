/**
 * §7 Historia gineco-obstétrica — solo paciente femenino.
 */
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import { fillSodexoGinecoFromExtension } from '@/lib/sodexo-pdf-gineco-fill'
import { isSodexoFemalePatient } from '@/lib/sodexo-ami-mirror'

export function fillSodexoGineco(
  form: PdfForm,
  physicalOrModulo1: Record<string, unknown> | null | undefined,
  sexo: string | null | undefined,
  patologicosGineco: unknown,
  ginecoExt?: SodexoExtensionData['gineco_sodexo'],
) {
  if (!isSodexoFemalePatient(sexo)) return
  fillSodexoGinecoFromExtension(form, physicalOrModulo1, ginecoExt ?? null, patologicosGineco)
}
