import {
  SodexoExtensionSchema,
  type SodexoExtensionData,
} from '@/schemas/clinical/examen-medico-variant.schema'

export type SodexoValidationResult = { ok: true } | { ok: false; errors: string[] }

function parseExt(raw: unknown): SodexoExtensionData | null {
  const parsed = SodexoExtensionSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Validación al cerrar captura / antes de PDF Sodexo (variante SODEXO). */
export function validateSodexoExtensionForClinicalClose(
  raw: unknown,
): SodexoValidationResult {
  const ext = parseExt(raw)
  const errors: string[] = []
  if (!ext) {
    return { ok: false, errors: ['Extensión Sodexo inválida o vacía.'] }
  }

  if (!ext.tipo_examen) {
    errors.push('Tipo de examen Sodexo (preingreso, periódica, retiro o reingreso).')
  }
  if (!ext.contacto_emergencia?.trim()) {
    errors.push('Contacto de emergencia.')
  }
  if (!ext.telefono_emergencia?.trim()) {
    errors.push('Teléfono de emergencia.')
  }

  const needsActividades =
    ext.tipo_examen === 'PERIODICA' ||
    ext.tipo_examen === 'RETIRO' ||
    ext.tipo_examen === 'REINGRESO'
  if (needsActividades) {
    if (!ext.actividades_cargo?.trim()) {
      errors.push('Cargo / actividades en el puesto.')
    }
    if (!ext.fecha_ingreso_actividades?.trim()) {
      errors.push('Fecha de ingreso a actividades.')
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true }
}

/** Consentimiento firmado en check-in (recepción), no en la extensión Sodexo. */
export function validateSodexoCheckInConsent(
  signedAt: Date | string | null | undefined,
): SodexoValidationResult {
  if (!signedAt) {
    return {
      ok: false,
      errors: [
        'Consentimiento informado de check-in (recepción) requerido para el PDF REG-SO-01.',
      ],
    }
  }
  return { ok: true }
}
