'use client'

import { splitUserFacingMessageLines, type UserFacingError } from '@/lib/user-facing-error'

type UserFacingErrorCalloutProps = {
  mapped: UserFacingError
  className?: string
}

export function UserFacingErrorCallout({ mapped, className = '' }: UserFacingErrorCalloutProps) {
  const lines = splitUserFacingMessageLines(mapped.userMessage)
  const tech = mapped.technicalDetail?.trim()

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${className}`}
      role="alert"
    >
      <p className="font-semibold text-slate-800">{mapped.title}</p>
      {lines.length <= 1 ? (
        <p className="text-red-700 mt-1">{mapped.userMessage}</p>
      ) : (
        <ul className="list-disc pl-4 text-red-700 mt-1 space-y-0.5 m-0">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {tech && tech !== mapped.userMessage.trim() && (
        <details className="mt-2 text-slate-600">
          <summary className="cursor-pointer select-none font-medium text-slate-700">
            Detalle técnico (para soporte)
          </summary>
          <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-snug bg-slate-50 border border-slate-200 rounded p-2 max-h-40 overflow-auto">
            {tech}
          </pre>
        </details>
      )}
    </div>
  )
}
