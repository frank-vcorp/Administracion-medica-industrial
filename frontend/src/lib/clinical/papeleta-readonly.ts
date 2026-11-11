import type { UserRole } from '@prisma/client'
import { canEditClosedClinicalCapture } from '@/lib/auth/roles'

/** Vistas de papeleta donde el workspace de estudios sigue activo en la URL. */
export const PAPELETA_WORKSPACE_VIEWS = ['CHECKED_IN', 'IN_PROGRESS', 'VALIDATING'] as const

export type PapeletaWorkspaceView = (typeof PAPELETA_WORKSPACE_VIEWS)[number]

/**
 * SME-109: en pasos Validación/Fin (`currentStep > 3`), recepción y captura
 * quedan en solo lectura; admin y médicos revisor pueden seguir editando
 * dentro de las vistas de papeleta habituales.
 */
export function computePapeletaReadonly(params: {
  currentStep: number
  activeView: string
  userRole: UserRole | string | null | undefined
}): boolean {
  const { currentStep, activeView, userRole } = params
  if (currentStep <= 3) return false
  if (
    canEditClosedClinicalCapture(userRole) &&
    (PAPELETA_WORKSPACE_VIEWS as readonly string[]).includes(activeView)
  ) {
    return false
  }
  return true
}

/**
 * Bloqueo por captura cerrada del estudio (independiente del paso del expediente).
 */
export function resolveClinicalStudyReadonly(
  papeletaReadonly: boolean,
  captureClosed: boolean,
  userRole: UserRole | string | null | undefined,
): boolean {
  if (papeletaReadonly) return true
  if (captureClosed && !canEditClosedClinicalCapture(userRole)) return true
  return false
}

export const CLOSED_CAPTURE_EDIT_DENIED =
  'La captura clínica está cerrada; no tienes permiso para editarla.'

export function denyIfClosedCaptureUnauthorized(
  captureClosed: boolean,
  userRole: UserRole | string | null | undefined,
): { ok: true } | { ok: false; error: string } {
  if (captureClosed && !canEditClosedClinicalCapture(userRole)) {
    return { ok: false, error: CLOSED_CAPTURE_EDIT_DENIED }
  }
  return { ok: true }
}

/** Mensaje UX en banner de solo lectura / corrección post-cierre. */
export function clinicalCaptureReadonlyBannerText(
  formReadonly: boolean,
  captureClosed: boolean,
  userRole: UserRole | string | null | undefined,
): string | null {
  if (!formReadonly && captureClosed && canEditClosedClinicalCapture(userRole)) {
    return 'Puedes corregir texto; guarda borrador.'
  }
  if (formReadonly) {
    return captureClosed
      ? 'Vista de solo lectura — expediente cerrado.'
      : 'Vista de solo lectura — el expediente ya fue cerrado.'
  }
  return null
}
