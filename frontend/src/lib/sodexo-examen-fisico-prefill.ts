import type { SodexoEfRowValue } from '@/lib/sodexo-examen-fisico-types'

export type SodexoExamenFisicoExtensionMap = Record<string, SodexoEfRowValue>

/** §9 Sodexo: sin prellenado desde AMI (solo captura del impreso). */
export function prefillExamenFisicoSodexoFromAmi(
  _examForm: Record<string, string>,
): SodexoExamenFisicoExtensionMap {
  return {}
}
