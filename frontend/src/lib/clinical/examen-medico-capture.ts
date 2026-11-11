/**
 * Cierre de captura del Examen Médico (formulario multi-fase) vs checkout en recepción.
 */
import {
  isExamenMedicoTestName,
  resolveExamenMedicoVariant,
} from '@/lib/clinical/examen-medico-variant'
import {
  formatStudyMissingFieldsSpanish,
  validateExamenMedicoForClinicalClose,
  type ExamenMedicoValidationInput,
} from '@/lib/clinical/examen-medico-required-fields'
import { emptyFlowserveExtension } from '@/schemas/clinical/examen-medico-variant.schema'

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

function primitiveFormFromPhysical(data: Record<string, unknown>): Record<string, string> {
  const isPrimitive = (v: unknown) =>
    v === null || v === undefined || typeof v === 'string' ||
    typeof v === 'number' || typeof v === 'boolean'
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => isPrimitive(v))
      .map(([k, v]) => [k, String(v ?? '')]),
  )
}

function buildCloseValidationInput(input: {
  somatometryData?: Record<string, unknown> | null
  eyeAcuityData?: Record<string, unknown> | null
  physicalExamData: Record<string, unknown>
}): ExamenMedicoValidationInput {
  const soma = input.somatometryData ?? {}
  const somaStrings = Object.fromEntries(
    Object.entries(soma).map(([k, v]) => [k, String(v ?? '')]),
  )
  const eye = input.eyeAcuityData ?? {}
  const agudezaForm = Object.fromEntries(
    Object.entries(eye).map(([k, v]) => [k, String(v ?? '')]),
  )
  const physical = input.physicalExamData
  const modulo1Raw = physical.modulo1
  const modulo1 =
    modulo1Raw && typeof modulo1Raw === 'object' && !Array.isArray(modulo1Raw)
      ? Object.fromEntries(
          Object.entries(modulo1Raw as Record<string, unknown>).map(([k, v]) => [
            k,
            String(v ?? ''),
          ]),
        )
      : {}
  const antecedentesCaptured =
    physical.antecedentes_captured &&
    typeof physical.antecedentes_captured === 'object' &&
    !Array.isArray(physical.antecedentes_captured)
      ? (physical.antecedentes_captured as Record<string, unknown>)
      : {}
  const variantExtensions =
    (physical.variant_extensions as Record<string, unknown> | undefined) ?? {}
  const examVariant = resolveExamenMedicoVariant(
    physical.exam_variant as string | null | undefined,
  )
  const flowserveRaw = variantExtensions.FLOWSERVE
  const flowserveExt =
    flowserveRaw && typeof flowserveRaw === 'object' && !Array.isArray(flowserveRaw)
      ? ({ ...emptyFlowserveExtension(), ...flowserveRaw } as ExamenMedicoValidationInput['flowserveExt'])
      : emptyFlowserveExtension()
  const sodexoExt = variantExtensions.SODEXO as ExamenMedicoValidationInput['sodexoExt']

  return {
    somaForm: somaStrings,
    vitalsForm: somaStrings,
    agudezaForm,
    form: primitiveFormFromPhysical(physical),
    modulo1,
    antecedentesCaptured,
    examVariant,
    flowserveExt,
    sodexoExt,
    recomendaciones: String(physical.recomendaciones_clinicas ?? ''),
  }
}

export function assertExamenMedicoReadyToClose(input: {
  somatometryData?: Record<string, unknown> | null
  eyeAcuityData?: Record<string, unknown> | null
  physicalExamData: Record<string, unknown>
}): string | null {
  const gate = validateExamenMedicoForClinicalClose(buildCloseValidationInput(input))
  if (!gate.ok) {
    return formatStudyMissingFieldsSpanish(gate.missing)
  }
  return null
}
