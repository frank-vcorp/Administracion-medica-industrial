'use client'

import {
  BUSINESS_STATUS_LABELS,
  buildStudyInterpretationFromSnapshot,
  getBusinessStatusBadgeClass,
  getOperationalDetail,
  toBusinessStudyStatus,
  type EventTestPipelineStatus,
  type StudyInterpretationInput,
} from '@/lib/clinical/study-status-display'

type StudyStatusBadgeProps = {
  status: EventTestPipelineStatus
  interpretation?: StudyInterpretationInput | null
  aiSnapshot?: Parameters<typeof buildStudyInterpretationFromSnapshot>[0]
  /** 'inline' = badge + detalle en columna; 'compact' = solo badge */
  variant?: 'inline' | 'compact'
  className?: string
}

/** Badge de estatus de negocio con detalle operativo opcional. */
export function StudyStatusBadge({
  status,
  interpretation,
  aiSnapshot,
  variant = 'inline',
  className = '',
}: StudyStatusBadgeProps) {
  const resolvedInterpretation =
    interpretation ?? buildStudyInterpretationFromSnapshot(aiSnapshot)
  const business = toBusinessStudyStatus(status)
  const detail = getOperationalDetail(status, resolvedInterpretation)

  return (
    <div className={`flex flex-col items-end ${className}`.trim()}>
      <span
        className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${getBusinessStatusBadgeClass(status)}`}
      >
        {BUSINESS_STATUS_LABELS[business]}
      </span>
      {variant === 'inline' && detail && (
        <p className="text-[10px] text-slate-500 mt-0.5 text-right max-w-[11rem] leading-tight">
          {detail}
        </p>
      )}
    </div>
  )
}
