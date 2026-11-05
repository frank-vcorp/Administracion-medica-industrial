import { ZodError } from 'zod'
import { applyExploracionFisicaDefaults } from '@/schemas/clinical/exam.schema'
import { buildExamSummary, type ExamSnapshot } from '@/lib/clinical/exam-summary'
import { formatMedicoNombreYCedula } from '@/lib/clinical/medico-display'

const IMPRESION_RESUMEN_DEFAULTS: Record<string, string> = {
  estado_nutricional: 'NORMAL',
  salud_bucal: 'NORMAL',
}

function isPrimitiveFieldValue(v: unknown): v is string | number | boolean {
  return (
    v === null ||
    v === undefined ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  )
}

/** Mensaje legible cuando falla Zod al guardar examen médico (F17). */
export function formatExamenMedicoZodError(error: unknown): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0]
    if (!issue) return 'Datos del examen médico inválidos.'
    const path = issue.path.length > 0 ? issue.path.join(' → ') : 'formulario'
    return `Revisa ${path}: ${issue.message}`
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return 'Error al guardar Examen Médico'
}

type PrepareOptions = {
  medicoLine?: string | null
}

/**
 * Normaliza payload antes de `ExamenMedicoCompletoSchema.parse`:
 * defaults de exploración, resumen clínico, impresión auto desde hallazgos,
 * líneas de médico desde sesión (no captura manual).
 */
export function prepareExamenMedicoPayloadForSave(
  raw: unknown,
  options?: PrepareOptions,
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  const input = raw as Record<string, unknown>
  const next: Record<string, unknown> = { ...input }

  const stringSlice: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (isPrimitiveFieldValue(value)) {
      stringSlice[key] = String(value ?? '')
    }
  }

  const withExploracionDefaults = applyExploracionFisicaDefaults(stringSlice)
  for (const [key, value] of Object.entries(withExploracionDefaults)) {
    next[key] = value
  }

  for (const [key, defaultValue] of Object.entries(IMPRESION_RESUMEN_DEFAULTS)) {
    if (!String(next[key] ?? '').trim()) {
      next[key] = defaultValue
    }
  }

  const snapshot: ExamSnapshot = {
    estado_nutricional: String(next.estado_nutricional ?? ''),
    agudeza_visual_resumen: String(next.agudeza_visual_resumen ?? ''),
    salud_bucal: String(next.salud_bucal ?? ''),
    presion_arterial_resumen: String(next.presion_arterial_resumen ?? ''),
    examen_medico_texto: String(next.examen_medico_texto ?? ''),
    impresion_diagnostica: String(next.impresion_diagnostica ?? ''),
    audiometria_texto: String(next.audiometria_texto ?? ''),
    espirometria_texto: String(next.espirometria_texto ?? ''),
    laboratorios_texto: String(next.laboratorios_texto ?? ''),
    radiografia_texto: String(next.radiografia_texto ?? ''),
  }

  const summary = buildExamSummary(snapshot)
  const autoImpresion = summary.examen_medico.trim()
  if (!String(next.impresion_diagnostica ?? '').trim() && autoImpresion) {
    next.impresion_diagnostica = autoImpresion
  }
  if (!String(next.examen_medico_texto ?? '').trim()) {
    const imp = String(next.impresion_diagnostica ?? '').trim()
    if (imp) next.examen_medico_texto = imp
    else if (autoImpresion) next.examen_medico_texto = autoImpresion
  }

  if (!String(next.impresion_diagnostica ?? '').trim()) {
    const fallback =
      'Trabajador evaluado; impresión clínica pendiente de correlación con hallazgos del examen.'
    next.impresion_diagnostica = fallback
    if (!String(next.examen_medico_texto ?? '').trim()) {
      next.examen_medico_texto = fallback
    }
  }

  const medicoLine = (options?.medicoLine ?? '').trim()
  if (medicoLine) {
    next.medico_evaluador = medicoLine
    if (String(next.aptitud ?? '').trim()) {
      next.medico_revisor = medicoLine
    }
  }

  return next
}

export function medicoLineFromProfile(
  fullName: string | null | undefined,
  professionalLicense: string | null | undefined,
): string {
  return formatMedicoNombreYCedula(fullName, professionalLicense)
}
