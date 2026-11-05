'use client'

type ClinicalAutosaveIndicatorProps = {
  label: string | null
  className?: string
}

export function ClinicalAutosaveIndicator({ label, className = '' }: ClinicalAutosaveIndicatorProps) {
  if (!label) return null

  const isError = label.includes('Error')

  return (
    <p
      className={`text-xs font-medium ${isError ? 'text-red-600' : 'text-slate-500'} ${className}`}
      role="status"
      aria-live="polite"
    >
      {label}
    </p>
  )
}
