'use client'

import { useEffect, useRef, useState } from 'react'
import { updateAgudezaVisual, updateSomatometria } from '@/actions/medical-exam.actions'

export const EXAMEN_MEDICO_AUTOSAVE_DEBOUNCE_MS = 1200

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

type OuterTab = 'somatometria' | 'signos_vitales' | 'agudeza_visual' | 'examen_medico'

export function useExamenMedicoAutosave(params: {
  enabled: boolean
  eventId: string
  eventTestId: string
  outerTab: OuterTab
  somaPayload: Record<string, unknown>
  agudezaPayload: Record<string, unknown>
  examSnapshotKey: string
  onAutosaveExam: () => Promise<boolean>
  onAfterSomaAutosave?: () => void
  onAfterAgudezaAutosave?: () => void
}) {
  const {
    enabled,
    eventId,
    eventTestId,
    outerTab,
    somaPayload,
    agudezaPayload,
    examSnapshotKey,
    onAutosaveExam,
    onAfterSomaAutosave,
    onAfterAgudezaAutosave,
  } = params

  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [statusDetail, setStatusDetail] = useState<string | null>(null)

  const somaBaseline = useRef<string | null>(null)
  const agudezaBaseline = useRef<string | null>(null)
  const examBaseline = useRef<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    if (somaBaseline.current === null) {
      somaBaseline.current = JSON.stringify(somaPayload)
    }
    if (agudezaBaseline.current === null) {
      agudezaBaseline.current = JSON.stringify(agudezaPayload)
    }
    if (examBaseline.current === null) {
      examBaseline.current = examSnapshotKey
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!enabled) return
    const key = JSON.stringify(somaPayload)
    if (key === somaBaseline.current) return

    setStatus('pending')
    const timer = setTimeout(() => {
      void (async () => {
        if (inFlight.current) return
        inFlight.current = true
        setStatus('saving')
        setStatusDetail(null)
        const res = await updateSomatometria(eventId, somaPayload, { autosave: true })
        inFlight.current = false
        if (res.success) {
          somaBaseline.current = key
          onAfterSomaAutosave?.()
          setStatus('saved')
        } else {
          setStatus('error')
          setStatusDetail(res.error ?? 'No se pudo guardar somatometría')
        }
      })()
    }, EXAMEN_MEDICO_AUTOSAVE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [enabled, eventId, somaPayload])

  useEffect(() => {
    if (!enabled) return
    const key = JSON.stringify(agudezaPayload)
    if (key === agudezaBaseline.current) return

    setStatus('pending')
    const timer = setTimeout(() => {
      void (async () => {
        if (inFlight.current) return
        inFlight.current = true
        setStatus('saving')
        setStatusDetail(null)
        const res = await updateAgudezaVisual(eventId, agudezaPayload, { autosave: true })
        inFlight.current = false
        if (res.success) {
          agudezaBaseline.current = key
          onAfterAgudezaAutosave?.()
          setStatus('saved')
        } else {
          setStatus('error')
          setStatusDetail(res.error ?? 'No se pudo guardar agudeza visual')
        }
      })()
    }, EXAMEN_MEDICO_AUTOSAVE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [enabled, eventId, agudezaPayload])

  useEffect(() => {
    if (!enabled || outerTab !== 'examen_medico') return

    if (examSnapshotKey === examBaseline.current) return

    setStatus('pending')
    const timer = setTimeout(() => {
      void (async () => {
        if (inFlight.current) return
        inFlight.current = true
        setStatus('saving')
        setStatusDetail(null)
        const ok = await onAutosaveExam()
        inFlight.current = false
        if (ok) {
          examBaseline.current = examSnapshotKey
          setStatus('saved')
        } else {
          setStatus('error')
          setStatusDetail('No se pudo guardar examen médico')
        }
      })()
    }, EXAMEN_MEDICO_AUTOSAVE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [enabled, eventId, eventTestId, outerTab, examSnapshotKey, onAutosaveExam])

  const statusLabel =
    status === 'saving'
      ? 'Guardando automáticamente…'
      : status === 'saved'
        ? 'Guardado automáticamente'
        : status === 'error'
          ? statusDetail ?? 'Error al guardar'
          : status === 'pending'
            ? 'Cambios pendientes…'
            : null

  return { status, statusLabel }
}
