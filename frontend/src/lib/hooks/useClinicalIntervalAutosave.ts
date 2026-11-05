'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Intervalo estándar de autoguardado clínico en todo el sistema (borrador). */
export const CLINICAL_AUTOSAVE_INTERVAL_MS = 15_000

export type ClinicalAutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export function clinicalAutosaveStatusLabel(
  status: ClinicalAutosaveStatus,
  errorDetail: string | null,
): string | null {
  switch (status) {
    case 'saving':
      return 'Guardando automáticamente…'
    case 'saved':
      return 'Guardado automáticamente'
    case 'error':
      return errorDetail ?? 'Error al guardar automáticamente'
    case 'dirty':
      return 'Cambios pendientes (autoguardado cada 15 s)…'
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
  save: () => Promise<boolean>
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
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const markSaved = useCallback(() => {
    baselineRef.current = snapshotKey
    setStatus('saved')
    setErrorDetail(null)
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
      setErrorDetail(null)

      void (async () => {
        try {
          const ok = await saveRef.current()
          if (ok) {
            baselineRef.current = snapshotKey
            onSavedRef.current?.()
            setStatus('saved')
          } else {
            setStatus('error')
            setErrorDetail('No se pudo guardar automáticamente')
          }
        } catch {
          setStatus('error')
          setErrorDetail('No se pudo guardar automáticamente')
        } finally {
          inFlightRef.current = false
        }
      })()
    }

    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs, snapshotKey])

  const statusLabel = clinicalAutosaveStatusLabel(status, errorDetail)

  return { status, statusLabel, markSaved, errorDetail }
}
