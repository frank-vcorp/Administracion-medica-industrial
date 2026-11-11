/**
 * Fusiona snapshot del portal de prellenado (Módulo 1) en antecedentes del examen.
 * O9-28 — datos del enlace deben reflejarse en captura clínica/tests.
 * SME-111 — examen médico: historial longitudinal + portal con paridad a consulta.
 */

import {
  antecedentesSectionHasContent,
  mergeProfileAntecedentesIntoConsulta,
} from '@/lib/clinical/consulta-antecedentes'

const PORTAL_SECTIONS = [
  'datos_personales',
  'historia_laboral',
  'heredo_familiares',
  'patologicos',
  'no_patologicos',
] as const

function isEmptySection(value: unknown): boolean {
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) return false
  return !Object.values(value as Record<string, unknown>).some(
    (v) => v !== null && v !== undefined && v !== '' && v !== 'NEGADO',
  )
}

function sectionNeedsFill(existing: unknown, incoming: unknown): boolean {
  if (isEmptySection(existing) && !isEmptySection(incoming)) return true
  return isEmptySection(existing) && isEmptySection(incoming) === false
}

/** Mezcla portal → snapshot solo donde el snapshot aún no tiene datos. */
export function mergePortalPrefillIntoAntecedentes(
  captured: Record<string, unknown> | null | undefined,
  prefilled: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!prefilled) return captured ?? {}
  const out: Record<string, unknown> = { ...(captured ?? {}) }
  for (const sec of PORTAL_SECTIONS) {
    const fromPortal = prefilled[sec]
    if (fromPortal == null) continue
    const current = out[sec]
    if (sectionNeedsFill(current, fromPortal) || isEmptySection(current)) {
      out[sec] = fromPortal
    }
  }
  return out
}

export function antecedentesCapturedIsEmpty(captured: Record<string, unknown> | null | undefined): boolean {
  if (!captured) return true
  return PORTAL_SECTIONS.every((sec) => isEmptySection(captured[sec]))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function stripProvenance(snapshot: Record<string, unknown>): Record<string, unknown> {
  const { _provenance: _ignored, ...rest } = snapshot
  return rest
}

type ProvenanceSource = 'portal' | 'longitudinal' | 'captured' | 'mixed'

function inferAntecedentesProvenance(args: {
  savedSections: Record<string, unknown>
  merged: Record<string, unknown>
  hadLongitudinal: boolean
  hadPortal: boolean
  existing?: unknown
}): { source: ProvenanceSource; updatedAt: string } | undefined {
  if (isRecord(args.existing) && typeof args.existing.source === 'string') {
    return args.existing as { source: ProvenanceSource; updatedAt: string }
  }
  const savedHadContent = PORTAL_SECTIONS.some((sec) =>
    antecedentesSectionHasContent(args.savedSections[sec]),
  )
  const usedPrefill = args.hadLongitudinal || args.hadPortal
  if (!usedPrefill) return undefined

  let source: ProvenanceSource = 'longitudinal'
  if (savedHadContent) source = 'mixed'
  else if (args.hadPortal && args.hadLongitudinal) source = 'mixed'
  else if (args.hadPortal) source = 'portal'

  return { source, updatedAt: new Date().toISOString() }
}

/**
 * Mezcla snapshot persistido + historial longitudinal + portal (cita con cita previa).
 * Prioridad por campo: lo ya capturado en el examen gana; vacíos se llenan desde
 * historial maestro y luego enlace del paciente (misma regla que consulta médica).
 */
export function mergeExamAntecedentesPrefill(
  captured: Record<string, unknown> | null | undefined,
  longitudinal: Record<string, unknown> | null | undefined,
  portal: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const saved = isRecord(captured) ? { ...captured } : {}
  const existingProvenance = saved._provenance
  const savedSections = stripProvenance(saved)

  const mergedSections = mergeProfileAntecedentesIntoConsulta(
    savedSections,
    longitudinal ?? {},
    portal ?? {},
  )

  const hadLongitudinal = isRecord(longitudinal) && PORTAL_SECTIONS.some((sec) =>
    antecedentesSectionHasContent(longitudinal[sec]),
  )
  const hadPortal = isRecord(portal) && PORTAL_SECTIONS.some((sec) =>
    antecedentesSectionHasContent(portal[sec]),
  )

  const out: Record<string, unknown> = { ...mergedSections }
  const provenance = inferAntecedentesProvenance({
    savedSections,
    merged: out,
    hadLongitudinal,
    hadPortal,
    existing: existingProvenance,
  })
  if (provenance) out._provenance = provenance
  return out
}

/** Comparación estable para decidir si hace falta persistir prefill en examen. */
export function antecedentesSnapshotComparable(data: unknown): string {
  if (!isRecord(data)) return '{}'
  return JSON.stringify(stripProvenance(data))
}
