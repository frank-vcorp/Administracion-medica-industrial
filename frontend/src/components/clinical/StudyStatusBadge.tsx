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
  /** 'inline' | 'sidebar' = badge + detalle; 'compact' = solo badge (evitar en listas laterales) */
  variant?: 'inline' | 'compact' | 'sidebar'
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

  const showDetail = (variant === 'inline' || variant === 'sidebar') && detail
  const alignEnd = variant === 'inline'

  return (
    <div
      className={`flex flex-col ${alignEnd ? 'items-end' : 'items-start'} ${className}`.trim()}
    >
      <span
        className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${getBusinessStatusBadgeClass(status)}`}
      >
        {BUSINESS_STATUS_LABELS[business]}
      </span>
      {showDetail && (
        <p
          className={`text-[10px] text-slate-600 mt-0.5 leading-tight max-w-[11rem] ${
            alignEnd ? 'text-right' : 'text-left'
          }`}
        >
          {detail}
        </p>
      )}
    </div>
  )
}
