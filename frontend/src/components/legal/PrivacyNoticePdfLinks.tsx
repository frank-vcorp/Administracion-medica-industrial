'use client'

import {
  CHECK_IN_PRIVACY_LEGAL_NAME,
  CHECK_IN_PRIVACY_VERACITY_BLURB,
} from '@/lib/legal/check-in-privacy-notice'

type Props = {
  compact?: boolean
  showPreview?: boolean
}

/**
 * Bloque de veracidad / aviso en consentimiento de check-in (siempre SME).
 * No enlaza el PDF FY27 Sodexo (solo clínica REG-SO-01).
 */
export function PrivacyNoticePdfLinks({ compact = false, showPreview = false }: Props) {
  void showPreview

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <p className={`text-slate-600 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}>
        {CHECK_IN_PRIVACY_VERACITY_BLURB}
      </p>
      <p className={`text-slate-500 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        Responsable: <span className="font-semibold text-slate-700">{CHECK_IN_PRIVACY_LEGAL_NAME}</span>
        {' '}
        · Resumen ampliado en{' '}
        <a href="/legal/privacidad-portal" className="text-teal-700 underline font-medium">
          aviso del portal
        </a>
      </p>
    </div>
  )
}
