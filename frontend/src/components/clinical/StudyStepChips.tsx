'use client'

import {
  getStudyVisibleStep,
  type StudyStepInput,
} from '@/lib/clinical/study-step'
import {
  buildStudyInterpretationFromSnapshot,
  studyRequiresInterpretation,
  type EventTestPipelineStatus,
} from '@/lib/clinical/study-status-display'

const THREE_STEPS = [
  { key: '1' as const, label: '1', title: 'Realización' },
  { key: '2' as const, label: '2', title: 'Resultado' },
  { key: '3' as const, label: '3', title: 'Interpretación' },
]

const TWO_STEPS = [
  { key: '1' as const, label: '1', title: 'Captura' },
  { key: '2' as const, label: '2', title: 'Certificado listo' },
]

type Props = {
  status: EventTestPipelineStatus
  testName?: string | null
  hasNotPerformedIncidence?: boolean
  aiSnapshot?: Parameters<typeof buildStudyInterpretationFromSnapshot>[0]
  compact?: boolean
}

export function StudyStepChips({
  status,
  testName,
  hasNotPerformedIncidence,
  aiSnapshot,
  compact = false,
}: Props) {
  const interpretation = buildStudyInterpretationFromSnapshot(aiSnapshot)
  const input: StudyStepInput = {
    status,
    hasNotPerformedIncidence,
    interpretation,
  }
  const visible = getStudyVisibleStep(input)
  const requiresInterpretation = studyRequiresInterpretation(testName)

  if (visible === 'E') {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
        E · No realizado
      </span>
    )
  }

  if (visible === 'INVALID') {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">
        Incidencia requerida
      </span>
    )
  }

  const steps = requiresInterpretation ? THREE_STEPS : TWO_STEPS

  return (
    <div className={`flex items-center gap-1 ${compact ? '' : 'gap-1.5'}`}>
      {steps.map((step) => {
        const isTwoStepCompleted = !requiresInterpretation && (visible === '2' || visible === '3')
        const active = requiresInterpretation
          ? visible === step.key
          : isTwoStepCompleted
            ? step.key === '2'
            : visible === step.key
        const done = requiresInterpretation
          ? (step.key === '1' && (visible === '2' || visible === '3')) ||
            (step.key === '2' && visible === '3')
          : isTwoStepCompleted && step.key === '1'

        return (
          <span
            key={step.key}
            title={step.title}
            className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full text-[10px] font-black ${
              active
                ? 'bg-teal-600 text-white ring-2 ring-teal-200'
                : done
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            {step.label}
          </span>
        )
      })}
    </div>
  )
}
