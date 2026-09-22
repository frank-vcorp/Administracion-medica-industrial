/**
 * Cierre de captura del Examen Médico (formulario multi-fase) vs checkout en recepción.
 */
import { isExamenMedicoTestName } from '@/lib/clinical/examen-medico-variant'

export const EXAMEN_CAPTURE_CLOSED_KEY = 'examen_capture_closed'

export function isSomatometriaTestName(name: string): boolean {
  const lower = name.toLowerCase().trim()
  return lower.includes('somatometr') || lower.includes('signos vitales')
}

export function isAgudezaVisualTestName(name: string): boolean {
  return name.toLowerCase().trim().includes('agudeza')
}

export type CheckoutEventTestRef = {
  id: string
  status?: string
  testNameSnapshot?: string | null
}

/** Estudios que cuentan para checkout cuando hay Examen Médico en el perfil. */
export function filterEventTestsForCheckout<T extends CheckoutEventTestRef>(
  tests: ReadonlyArray<T>,
): T[] {
  const active = tests.filter((t) => t.status !== 'CANCELLED')
  const hasExamen = active.some((t) =>
    isExamenMedicoTestName(t.testNameSnapshot ?? ''),
  )
  if (!hasExamen) return active as T[]
  return active.filter((t) => {
    const name = t.testNameSnapshot ?? ''
    return !isSomatometriaTestName(name) && !isAgudezaVisualTestName(name)
  }) as T[]
}

export function isExamenMedicoCaptureClosed(
  physicalExamData: Record<string, unknown> | null | undefined,
): boolean {
  return physicalExamData?.[EXAMEN_CAPTURE_CLOSED_KEY] === true
}

export function assertExamenMedicoReadyToClose(input: {
  somatometryData?: Record<string, unknown> | null
  eyeAcuityData?: Record<string, unknown> | null
  physicalExamData: Record<string, unknown>
}): string | null {
  const soma = input.somatometryData ?? {}
  if (!String(soma.peso_kg ?? '').trim() || !String(soma.talla_m ?? '').trim()) {
    return 'Completa somatometría (peso y talla) antes de cerrar la captura.'
  }
  if (!String(soma.ta_sistolica ?? '').trim() && !String(soma.fc_min ?? '').trim()) {
    return 'Completa signos vitales antes de cerrar la captura.'
  }
  const eye = input.eyeAcuityData ?? {}
  if (Object.keys(eye).length === 0) {
    return 'Completa agudeza visual antes de cerrar la captura.'
  }
  const impresion = String(input.physicalExamData.impresion_diagnostica ?? '').trim()
  if (!impresion) {
    return 'Agrega impresión diagnóstica antes de cerrar la captura.'
  }
  const recomendaciones = String(
    input.physicalExamData.recomendaciones_clinicas ?? '',
  ).trim()
  if (!recomendaciones) {
    return 'Ingresa recomendaciones antes de cerrar la captura.'
  }
  return null
}
