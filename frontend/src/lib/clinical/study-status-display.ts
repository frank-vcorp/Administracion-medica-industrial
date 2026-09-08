/**
 * Estatus de pruebas clínicas — modelo de dos capas (DEC-20260907-01).
 *
 * Capa 1 (negocio, visible): Pendiente · Realizado · No realizado
 * Capa 2 (operativo, subtexto): pipeline EventTestStatus sin cambiar BD
 *
 * @see context/acuerdos/DEC-20260907-01-estatus-pruebas-dos-capas.md
 */

export type EventTestPipelineStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SAMPLE_TAKEN'
  | 'RESULT_REGISTERED'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'CANCELLED'

export type BusinessStudyStatus = 'PENDIENTE' | 'REALIZADO' | 'NO_REALIZADO'

export const BUSINESS_STATUS_LABELS: Record<BusinessStudyStatus, string> = {
  PENDIENTE: 'Pendiente',
  REALIZADO: 'Realizado',
  NO_REALIZADO: 'No realizado',
}

export const BUSINESS_STATUS_BADGE: Record<BusinessStudyStatus, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  REALIZADO: 'bg-emerald-100 text-emerald-700',
  NO_REALIZADO: 'bg-slate-100 text-slate-600',
}

export type StudyInterpretationInput = {
  clinicalState?: string | null
  doctorStatus?: string | null
}

const INTERPRETED_STATES = new Set([
  'REVIEWED_ACCEPTED',
  'REVIEWED_EDITED',
])

/** Deriva contexto de interpretación desde el snapshot IA del EventTest. */
export function buildStudyInterpretationFromSnapshot(
  aiSnapshot?: {
    snapshot?: { clinicalState?: string } | null
    existingReview?: { doctorStatus?: string } | null
  } | null,
): StudyInterpretationInput | null {
  if (!aiSnapshot) return null
  return {
    clinicalState: aiSnapshot.snapshot?.clinicalState ?? null,
    doctorStatus: aiSnapshot.existingReview?.doctorStatus ?? null,
  }
}

export function isStudyInterpreted(
  interpretation?: StudyInterpretationInput | null,
): boolean {
  if (!interpretation) return false
  if (interpretation.doctorStatus && INTERPRETED_STATES.has(interpretation.doctorStatus)) {
    return true
  }
  if (interpretation.clinicalState && INTERPRETED_STATES.has(interpretation.clinicalState)) {
    return true
  }
  return false
}

/** Estatus de interpretación clínica (Word R-18) para pruebas con resultado. */
export function getInterpretationDetail(
  status: EventTestPipelineStatus,
  interpretation?: StudyInterpretationInput | null,
): string | null {
  if (status !== 'COMPLETED' && status !== 'RESULT_REGISTERED') return null
  return isStudyInterpreted(interpretation)
    ? 'Prueba interpretada'
    : 'Pendiente de interpretación'
}

/** Mapeo pipeline → estatus de negocio (Word R-17 + laboratorio). */
export function toBusinessStudyStatus(
  status: EventTestPipelineStatus,
): BusinessStudyStatus {
  if (status === 'SKIPPED' || status === 'CANCELLED') return 'NO_REALIZADO'
  if (status === 'RESULT_REGISTERED' || status === 'COMPLETED') return 'REALIZADO'
  return 'PENDIENTE'
}

/** Detalle operativo opcional (laboratorio, interpretación clínica, etc.). */
export function getOperationalDetail(
  status: EventTestPipelineStatus,
  interpretation?: StudyInterpretationInput | null,
): string | null {
  const interpretationDetail = getInterpretationDetail(status, interpretation)
  if (interpretationDetail) return interpretationDetail

  switch (status) {
    case 'IN_PROGRESS':
      return 'En proceso'
    case 'SAMPLE_TAKEN':
      return 'Muestra tomada · esperando laboratorio'
    case 'SKIPPED':
      return 'Omitido'
    case 'CANCELLED':
      return 'Cancelado'
    default:
      return null
  }
}

export function formatStudyStatusLine(
  status: EventTestPipelineStatus,
  interpretation?: StudyInterpretationInput | null,
): string {
  const label = BUSINESS_STATUS_LABELS[toBusinessStudyStatus(status)]
  const detail = getOperationalDetail(status, interpretation)
  return detail ? `${label} · ${detail}` : label
}

export function getBusinessStatusBadgeClass(
  status: EventTestPipelineStatus,
): string {
  return BUSINESS_STATUS_BADGE[toBusinessStudyStatus(status)]
}
