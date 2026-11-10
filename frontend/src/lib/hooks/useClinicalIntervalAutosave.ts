'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  mapUserFacingError,
  splitUserFacingMessageLines,
  type UserFacingError,
} from '@/lib/user-facing-error'

/** Intervalo estándar de autoguardado clínico en todo el sistema (borrador). */
export const CLINICAL_AUTOSAVE_INTERVAL_MS = 7_000

export type ClinicalAutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/** Resultado de `save` para mapear fallos a mensajes claros (validación vs técnico). */
export type ClinicalAutosaveSaveOutcome =
  | boolean
  | {
      ok: boolean
      error?: unknown
      message?: string
      fieldErrors?: Record<string, string[]>
      technicalDetail?: string
      context?: string
    }

export async function normalizeClinicalAutosaveOutcome(
  out: ClinicalAutosaveSaveOutcome,
): Promise<{ ok: true } | { ok: false; mapped: UserFacingError }> {
  if (typeof out === 'boolean') {
    if (out) return { ok: true }
    return {
      ok: false,
      mapped: mapUserFacingError({ context: 'autosave' }),
    }
  }
  if (out.ok) return { ok: true }
    return {
      ok: false,
      mapped: mapUserFacingError({
        error: out.error,
        message: out.message,
        fieldErrors: out.fieldErrors,
        serverTechnicalDetail: out.technicalDetail,
        context: out.context ?? 'autosave',
      }),
    }
}

export function clinicalAutosaveStatusLabel(
  status: ClinicalAutosaveStatus,
  error: UserFacingError | null,
): string | null {
  switch (status) {
    case 'saving':
      return 'Guardando automáticamente…'
    case 'saved':
      return 'Guardado automáticamente'
    case 'error': {
      if (!error) return '❌ No se pudo guardar automáticamente'
      const first = splitUserFacingMessageLines(error.userMessage)[0] ?? error.userMessage
      return `❌ ${error.title}: ${first}`
    }
    case 'dirty':
      return 'Cambios pendientes (autoguardado cada 7 s)…'
    default:
      return null
  }
}

/**
 * Persiste borradores en intervalo fijo cuando `snapshotKey` difiere del último guardado exitoso.
 * No sustituye el botón manual: solo evita pérdida de captura entre guardados.
 */
export function useClinicalIntervalAutosave(params: {
  enabled: boolean
  snapshotKey: string
  save: () => Promise<ClinicalAutosaveSaveOutcome>
  intervalMs?: number
  onSaved?: () => void
}) {
  const { enabled, snapshotKey, intervalMs = CLINICAL_AUTOSAVE_INTERVAL_MS, onSaved } = params

  const saveRef = useRef(params.save)
  saveRef.current = params.save
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  const baselineRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)
  const [status, setStatus] = useState<ClinicalAutosaveStatus>('idle')
  const [userFacingError, setUserFacingError] = useState<UserFacingError | null>(null)

  const markSaved = useCallback(() => {
    baselineRef.current = snapshotKey
    setStatus('saved')
    setUserFacingError(null)
  }, [snapshotKey])

  useEffect(() => {
    if (!enabled) {
      baselineRef.current = null
      setStatus('idle')
      return
    }
    if (baselineRef.current === null) {
      baselineRef.current = snapshotKey
    }
  }, [enabled, snapshotKey])

  useEffect(() => {
    if (!enabled || baselineRef.current === null) return
    if (snapshotKey !== baselineRef.current) {
      setStatus((prev) => (prev === 'saving' ? prev : 'dirty'))
    }
  }, [enabled, snapshotKey])

  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      if (baselineRef.current === null) {
        baselineRef.current = snapshotKey
        return
      }
      if (snapshotKey === baselineRef.current) return
      if (inFlightRef.current) return

      inFlightRef.current = true
      setStatus('saving')
      setUserFacingError(null)

      void (async () => {
        try {
          const raw = await saveRef.current()
          const normalized = await normalizeClinicalAutosaveOutcome(raw)
          if (normalized.ok) {
            baselineRef.current = snapshotKey
            onSavedRef.current?.()
            setStatus('saved')
          } else {
            setStatus('error')
            setUserFacingError(normalized.mapped)
          }
        } catch (err: unknown) {
          setStatus('error')
          setUserFacingError(mapUserFacingError({ error: err, context: 'autosave' }))
        } finally {
          inFlightRef.current = false
        }
      })()
    }

    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs, snapshotKey])

  const statusLabel = clinicalAutosaveStatusLabel(status, userFacingError)

  return { status, statusLabel, markSaved, userFacingError }
}
