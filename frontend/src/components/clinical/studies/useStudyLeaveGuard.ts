'use client'

import { useEffect, useRef } from 'react'
import type { StudyCaptureValidationResult } from '@/lib/clinical/study-required-fields'

export type StudyLeaveGuardFn = () => StudyCaptureValidationResult

/**
 * Registra en el padre (p. ej. PapeletaWorkspace) la validación de la prueba activa
 * para bloquear cambio de pestaña / estudio si faltan obligatorios.
 */
export function useStudyLeaveGuard(
  register: ((fn: StudyLeaveGuardFn | null) => void) | undefined,
  evaluate: StudyLeaveGuardFn,
  enabled: boolean,
) {
  const evaluateRef = useRef(evaluate)
  evaluateRef.current = evaluate

  useEffect(() => {
    if (!register || !enabled) {
      register?.(null)
      return
    }
    const fn: StudyLeaveGuardFn = () => evaluateRef.current()
    register(fn)
    return () => register(null)
  }, [register, enabled])
}
