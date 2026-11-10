/**
 * Valores efectivos de peso/talla/TA para mostrar en la papeleta de
 * Espirometría: lo guardado en el cuestionario gana; si falta, hereda de
 * somatometría (O9-20), igual que en el modal.
 */

import type { EspirometriaQuestionnairePayload } from '@/schemas/clinical/espirometria-questionnaire.schema'
import {
  inheritVitalsFromSomatometry,
  mergeEspirometriaVitals,
  type EspirometriaInheritedVitals,
} from '@/lib/espirometria-inherited-vitals'

export type EspirometriaDisplayVitals = EspirometriaInheritedVitals

export function getEspirometriaDisplayVitals(
  payload: EspirometriaQuestionnairePayload | null | undefined,
  somatometry: Record<string, unknown> | null | undefined,
): EspirometriaDisplayVitals {
  const inherited = inheritVitalsFromSomatometry(somatometry)
  const fromPayload = payload?.signos_somatometria
  if (!fromPayload) {
    return inherited
  }
  return mergeEspirometriaVitals(fromPayload, inherited)
}

export function hasAnyEspirometriaDisplayVital(v: EspirometriaDisplayVitals): boolean {
  return !!(
    v.peso_kg?.trim() ||
    v.talla_m?.trim() ||
    v.ta_sistolica?.trim() ||
    v.ta_diastolica?.trim()
  )
}
