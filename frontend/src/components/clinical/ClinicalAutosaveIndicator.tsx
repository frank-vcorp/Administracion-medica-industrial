'use client'

import { UserFacingErrorCallout } from '@/components/clinical/UserFacingErrorCallout'
import type { UserFacingError } from '@/lib/user-facing-error'

type ClinicalAutosaveIndicatorProps = {
  label: string | null
  /** Cuando el autoguardado falla, muestra detalle técnico colapsable para soporte. */
  error?: UserFacingError | null
  className?: string
}

export function ClinicalAutosaveIndicator({
  label,
  error,
  className = '',
}: ClinicalAutosaveIndicatorProps) {
  if (!label && !error) return null

  const isError = label?.includes('❌') ?? false

  return (
    <div className={className}>
      {label && (
        <p
          className={`text-xs font-medium ${isError ? 'text-red-600' : 'text-slate-500'}`}
          role="status"
          aria-live="polite"
        >
          {label}
        </p>
      )}
      {error && (
        <div className="mt-1.5">
          <UserFacingErrorCallout mapped={error} className="border-red-200 bg-red-50/80" />
        </div>
      )}
    </div>
  )
}
