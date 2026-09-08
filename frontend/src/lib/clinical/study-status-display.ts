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

/** Mapeo pipeline → estatus de negocio (Word R-17 + laboratorio). */
export function toBusinessStudyStatus(
  status: EventTestPipelineStatus,
): BusinessStudyStatus {
  if (status === 'SKIPPED' || status === 'CANCELLED') return 'NO_REALIZADO'
  if (status === 'RESULT_REGISTERED' || status === 'COMPLETED') return 'REALIZADO'
  return 'PENDIENTE'
}

/** Detalle operativo opcional (p. ej. muestra de laboratorio). */
export function getOperationalDetail(
  status: EventTestPipelineStatus,
): string | null {
  switch (status) {
    case 'IN_PROGRESS':
      return 'En proceso'
    case 'SAMPLE_TAKEN':
      return 'Muestra tomada · esperando laboratorio'
    case 'RESULT_REGISTERED':
      return 'Resultado registrado'
    case 'COMPLETED':
      return 'Pendiente de envío'
    case 'SKIPPED':
      return 'Omitido'
    case 'CANCELLED':
      return 'Cancelado'
    default:
      return null
  }
}

export function formatStudyStatusLine(status: EventTestPipelineStatus): string {
  const label = BUSINESS_STATUS_LABELS[toBusinessStudyStatus(status)]
  const detail = getOperationalDetail(status)
  return detail ? `${label} · ${detail}` : label
}

export function getBusinessStatusBadgeClass(
  status: EventTestPipelineStatus,
): string {
  return BUSINESS_STATUS_BADGE[toBusinessStudyStatus(status)]
}
