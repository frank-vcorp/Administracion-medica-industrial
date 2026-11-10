/**
 * Auto-composición de `impresion_diagnostica` desde antecedentes (APP con SÍ)
 * y hallazgos del examen (F04 / S30-08).
 *
 * Regla de negocio (Excel 30-sep): en Impresión clínica se jala la impresión
 * diagnóstica con base en el llenado del examen cuando el antecedente es SÍ.
 * El médico puede editar; no se sobrescribe texto ya capturado (DA-2).
 */
import {
  PATOLOGICOS_DESCRIPCIONES,
  PATOLOGICOS_GROUP_ORDER,
  readTratamientoMedicoActualDisplay,
  SUPLEMENTOS_COMPLEMENTOS_LABEL,
  HISTORIA_LABORAL_RIESGOS_TRABAJO,
  type GrupoPatologicos,
} from '@/lib/antecedentes-fields'
import { parsePatologiaEntry } from '@/lib/sodexo-pdf-patologicos'
import {
  detectHallazgosFromExam,
  type ExamForHallazgos,
} from '@/lib/clinical/recommendations'

export type AntecedentesCapturedSnapshot = {
  patologicos?: Record<string, unknown> | null
  no_patologicos?: Record<string, unknown> | null
  historia_laboral?: Record<string, unknown> | null
}

export type BuildImpresionDiagnosticaInput = {
  antecedentes?: AntecedentesCapturedSnapshot | Record<string, unknown> | null
  exam: ExamForHallazgos
  /** Texto libre de hallazgos positivos en exploración (txtEFEspecificar). */
  especifiquePositivos?: string | null
}

const PATOLOGICO_LABEL_BY_FIELD: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const groupKey of PATOLOGICOS_GROUP_ORDER) {
    const items = PATOLOGICOS_DESCRIPCIONES[groupKey as keyof GrupoPatologicos]
    for (const item of items) {
      map[item.field] = item.label
    }
  }
  return map
})()

function sectionRecord(
  antecedentes: Record<string, unknown> | null | undefined,
  key: keyof AntecedentesCapturedSnapshot,
): Record<string, unknown> {
  const raw = antecedentes?.[key]
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

function formatPatologicoSiLine(field: string, raw: unknown): string | null {
  const parsed = parsePatologiaEntry(raw)
  if (!parsed.si) return null
  const label = PATOLOGICO_LABEL_BY_FIELD[field] ?? field.replace(/_/g, ' ')
  if (parsed.descripcion) {
    return `${label}: ${parsed.descripcion}`
  }
  if (typeof raw === 'object' && raw !== null && 'detalle' in raw) {
    const det = (raw as { detalle?: Record<string, string> }).detalle
    const parts = [
      det?.especificacion,
      det?.desde_cuando,
      det?.tratamiento,
      det?.observaciones,
    ]
      .map(x => (x ?? '').trim())
      .filter(Boolean)
    if (parts.length > 0) return `${label}: ${parts.join('; ')}`
  }
  return label
}

/** True si hay al menos un antecedente personal patológico marcado SÍ. */
export function hasPatologicoSi(
  antecedentes?: AntecedentesCapturedSnapshot | Record<string, unknown> | null,
): boolean {
  if (!antecedentes || typeof antecedentes !== 'object') return false
  const pat = sectionRecord(antecedentes, 'patologicos')
  for (const raw of Object.values(pat)) {
    if (parsePatologiaEntry(raw).si) return true
  }
  return false
}

function collectPatologicosSiLines(
  patologicos: Record<string, unknown>,
): string[] {
  const lines: string[] = []
  for (const [field, raw] of Object.entries(patologicos)) {
    const line = formatPatologicoSiLine(field, raw)
    if (line) lines.push(line)
  }
  return lines
}

function collectContextoApnpLines(noPatologicos: Record<string, unknown>): string[] {
  const lines: string[] = []
  const tratamiento = readTratamientoMedicoActualDisplay(noPatologicos)
  if (tratamiento.startsWith('SI')) {
    lines.push(`${SUPLEMENTOS_COMPLEMENTOS_LABEL}: ${tratamiento.replace(/^SI\s*—?\s*/i, '').trim() || 'Sí'}`)
  }
  return lines
}

function collectHistoriaLaboralLines(historia: Record<string, unknown>): string[] {
  const lines: string[] = []
  for (const item of HISTORIA_LABORAL_RIESGOS_TRABAJO) {
    const flag = historia[item.key]
    if (flag === true || flag === 'true' || flag === '1') {
      const desc = String(historia[item.descKey] ?? '').trim()
      lines.push(desc ? `${item.label}: ${desc}` : item.label)
    }
  }
  return lines
}

function collectHallazgosExamenLines(exam: ExamForHallazgos): string[] {
  return detectHallazgosFromExam(exam).map(h => h.texto)
}

function joinSentences(parts: string[]): string {
  return parts
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => (p.endsWith('.') ? p : `${p}.`))
    .join(' ')
}

/**
 * Construye propuesta de impresión diagnóstica cuando hay APP con SÍ.
 * Si no hay patológicos SÍ, devuelve cadena vacía (no auto-llenar).
 */
export function buildImpresionDiagnosticaFromAntecedentesYExamen(
  input: BuildImpresionDiagnosticaInput,
): string {
  const ant = input.antecedentes
  if (!hasPatologicoSi(ant)) return ''

  const pat = sectionRecord(ant ?? null, 'patologicos')
  const np = sectionRecord(ant ?? null, 'no_patologicos')
  const hl = sectionRecord(ant ?? null, 'historia_laboral')

  const appLines = collectPatologicosSiLines(pat)
  const apnpLines = collectContextoApnpLines(np)
  const laboralLines = collectHistoriaLaboralLines(hl)
  const hallazgos = collectHallazgosExamenLines(input.exam)

  const positivos = String(input.especifiquePositivos ?? '').trim()

  const blocks: string[] = []

  if (appLines.length > 0) {
    blocks.push(`Antecedentes personales patológicos: ${joinSentences(appLines)}`)
  }
  if (apnpLines.length > 0 || laboralLines.length > 0) {
    blocks.push(
      joinSentences([...apnpLines, ...laboralLines]),
    )
  }
  if (hallazgos.length > 0) {
    blocks.push(`Hallazgos en el examen actual: ${joinSentences(hallazgos)}`)
  } else {
    blocks.push(
      'Examen físico y estudios de la papeleta sin hallazgos agudos adicionales en la correlación clínica.',
    )
  }
  if (positivos) {
    blocks.push(`Detalle de exploración: ${positivos.endsWith('.') ? positivos : `${positivos}.`}`)
  }

  return blocks.join(' ').replace(/\s+/g, ' ').trim()
}

/** Exam + exploración mínima para detectHallazgos desde el form plano del examen. */
export function examForHallazgosFromForm(
  form: Record<string, string>,
): ExamForHallazgos {
  return {
    estado_nutricional: form.estado_nutricional ?? null,
    agudeza_visual_resumen: form.agudeza_visual_resumen ?? null,
    salud_bucal: form.salud_bucal ?? null,
    presion_arterial_resumen: form.presion_arterial_resumen ?? null,
    examen_medico_texto: form.examen_medico_texto ?? form.impresion_diagnostica ?? null,
    exploracion: {
      circulacion_venosa: form.circulacion_venosa ?? null,
    },
  }
}
