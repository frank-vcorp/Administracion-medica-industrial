'use client'

import { useEffect, useRef, useState } from 'react'
import { updateAgudezaVisual, updateSomatometria } from '@/actions/medical-exam.actions'
import {
  CLINICAL_AUTOSAVE_INTERVAL_MS,
  clinicalAutosaveStatusLabel,
  normalizeClinicalAutosaveOutcome,
  type ClinicalAutosaveSaveOutcome,
  type ClinicalAutosaveStatus,
} from '@/lib/hooks/useClinicalIntervalAutosave'
import { mapSaveClinicalFailure, type UserFacingError } from '@/lib/user-facing-error'

/** @deprecated Use CLINICAL_AUTOSAVE_INTERVAL_MS — kept for imports/tests. */
export const EXAMEN_MEDICO_AUTOSAVE_DEBOUNCE_MS = CLINICAL_AUTOSAVE_INTERVAL_MS

export type AutosaveStatus = ClinicalAutosaveStatus

type OuterTab = 'somatometria' | 'signos_vitales' | 'agudeza_visual' | 'examen_medico'

export function useExamenMedicoAutosave(params: {
  enabled: boolean
  eventId: string
  eventTestId: string
  outerTab: OuterTab
  somaPayload: Record<string, unknown>
  agudezaPayload: Record<string, unknown>
  examSnapshotKey: string
  onAutosaveExam: () => Promise<ClinicalAutosaveSaveOutcome>
  onAfterSomaAutosave?: () => void
  onAfterAgudezaAutosave?: () => void
}) {
  const {
    enabled,
    eventId,
    outerTab,
    somaPayload,
    agudezaPayload,
    examSnapshotKey,
    onAutosaveExam,
    onAfterSomaAutosave,
    onAfterAgudezaAutosave,
  } = params

  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [userFacingError, setUserFacingError] = useState<UserFacingError | null>(null)

  const somaBaseline = useRef<string | null>(null)
  const agudezaBaseline = useRef<string | null>(null)
  const examBaseline = useRef<string | null>(null)
  const inFlight = useRef(false)

  const onAutosaveExamRef = useRef(onAutosaveExam)
  onAutosaveExamRef.current = onAutosaveExam

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

  const somaKey = JSON.stringify(somaPayload)
  const agudezaKey = JSON.stringify(agudezaPayload)

  const isDirty =
    somaKey !== somaBaseline.current ||
    agudezaKey !== agudezaBaseline.current ||
    (outerTab === 'examen_medico' && examSnapshotKey !== examBaseline.current)

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return
    }
    if (isDirty && status !== 'saving') {
      setStatus('dirty')
    }
  }, [enabled, isDirty, status])

  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      if (inFlight.current) return

      const dirtySoma = somaKey !== somaBaseline.current
      const dirtyAgudeza = agudezaKey !== agudezaBaseline.current
      const dirtyExam =
        outerTab === 'examen_medico' && examSnapshotKey !== examBaseline.current

      if (!dirtySoma && !dirtyAgudeza && !dirtyExam) return

      inFlight.current = true
      setStatus('saving')
      setUserFacingError(null)

      void (async () => {
        try {
          if (dirtySoma) {
            const res = await updateSomatometria(eventId, somaPayload, { autosave: true })
            if (!res.success) {
              setStatus('error')
              setUserFacingError(
                mapSaveClinicalFailure(
                  { success: false, error: res.error ?? 'No se pudo guardar somatometría' },
                  { context: 'Somatometría (autoguardado)' },
                ),
              )
              return
            }
            somaBaseline.current = somaKey
            onAfterSomaAutosave?.()
          }

          if (agudezaKey !== agudezaBaseline.current) {
            const res = await updateAgudezaVisual(eventId, agudezaPayload, { autosave: true })
            if (!res.success) {
              setStatus('error')
              setUserFacingError(
                mapSaveClinicalFailure(
                  { success: false, error: res.error ?? 'No se pudo guardar agudeza visual' },
                  { context: 'Agudeza visual (autoguardado)' },
                ),
              )
              return
            }
            agudezaBaseline.current = agudezaKey
            onAfterAgudezaAutosave?.()
          }

          if (outerTab === 'examen_medico' && examSnapshotKey !== examBaseline.current) {
            const raw = await onAutosaveExamRef.current()
            const normalized = await normalizeClinicalAutosaveOutcome(raw)
            if (!normalized.ok) {
              setStatus('error')
              setUserFacingError(normalized.mapped)
              return
            }
            examBaseline.current = examSnapshotKey
          }

          setStatus('saved')
        } finally {
          inFlight.current = false
        }
      })()
    }

    const id = window.setInterval(tick, CLINICAL_AUTOSAVE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [
    enabled,
    eventId,
    outerTab,
    somaKey,
    somaPayload,
    agudezaKey,
    agudezaPayload,
    examSnapshotKey,
    onAfterSomaAutosave,
    onAfterAgudezaAutosave,
  ])

  const statusLabel = clinicalAutosaveStatusLabel(status, userFacingError)

  return { status, statusLabel, userFacingError }
}
