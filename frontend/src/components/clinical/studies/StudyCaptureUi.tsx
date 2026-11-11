'use client'

import { examFieldRingClass } from '@/lib/clinical/examen-medico-save-errors'

export function StudyCaptureFieldLabel({
  children,
  required,
  htmlFor,
}: {
  children: React.ReactNode
  required?: boolean
  htmlFor?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-bold text-slate-500 mb-2 uppercase"
    >
      {children}
      {required ? <span className="text-red-500 normal-case"> *</span> : null}
    </label>
  )
}

export function StudyCaptureMissingBanner({
  message,
  className = '',
}: {
  message: string
  className?: string
}) {
  if (!message.trim()) return null
  return (
    <div
      role="alert"
      data-testid="study-missing-fields-banner"
      className={`rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 ${className}`}
    >
      <span className="font-bold">Campos obligatorios incompletos. </span>
      {message}
    </div>
  )
}

export function studyCaptureInputClass(hasError: boolean, base: string): string {
  return examFieldRingClass(hasError, base)
}
