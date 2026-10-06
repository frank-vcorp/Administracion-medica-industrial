'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  readIncludeInDictamenGeneral,
  isDictamenOptionalLabTest,
} from '@/lib/clinical/dictamen-lab-papeleta'
import { updateEventTestDictamenLabInclusion } from '@/actions/event-test.actions'

type Props = {
  eventId: string
  eventTestId: string
  testNameSnapshot: string
  clinicalContext: unknown
  readonly?: boolean
  onSaved?: (includeInDictamenGeneral: boolean) => void
}

export default function DictamenGeneralLabToggle({
  eventId,
  eventTestId,
  testNameSnapshot,
  clinicalContext,
  readonly = false,
  onSaved,
}: Props) {
  const show = isDictamenOptionalLabTest(testNameSnapshot)
  const initialInclude = readIncludeInDictamenGeneral(testNameSnapshot, clinicalContext)
  const [include, setInclude] = useState(initialInclude)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setInclude(readIncludeInDictamenGeneral(testNameSnapshot, clinicalContext))
  }, [testNameSnapshot, clinicalContext])

  if (!show) return null

  const save = (next: boolean) => {
    setError('')
    startTransition(async () => {
      const res = await updateEventTestDictamenLabInclusion(eventTestId, eventId, next)
      if (!res.success) {
        setError(res.error ?? 'No se pudo guardar')
        return
      }
      setInclude(next)
      onSaved?.(next)
    })
  }

  return (
    <div
      className="rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 space-y-2"
      data-testid="dictamen-general-lab-toggle"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
        Dictamen general (empresa)
      </p>
      <p className="text-xs text-violet-900/90">
        Indique si el <strong>resultado</strong> de esta prueba debe aparecer en el dictamen
        general. Si elige omitir, el estudio sigue en la papeleta y expediente clínico.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={`dictamen-${eventTestId}`}
            checked={include}
            disabled={readonly || isPending}
            onChange={() => save(true)}
            className="text-violet-600"
          />
          <span>Sí, incluir en dictamen general</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={`dictamen-${eventTestId}`}
            checked={!include}
            disabled={readonly || isPending}
            onChange={() => save(false)}
            className="text-violet-600"
          />
          <span>No, omitir del dictamen general</span>
        </label>
      </div>
      {isPending && <p className="text-xs text-violet-600">Guardando…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
