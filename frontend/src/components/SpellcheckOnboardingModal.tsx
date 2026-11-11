'use client'

import {
  isSpellcheckOnboardingDismissed,
  persistSpellcheckOnboardingDismissed,
} from '@/lib/spellcheck-onboarding'
import { useEffect, useState } from 'react'

/**
 * SME-106: aviso por navegador sobre ortografía mejorada del navegador para español.
 * No bloquea la interacción con la app (sin window.alert).
 */
export default function SpellcheckOnboardingModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isSpellcheckOnboardingDismissed()) {
      setOpen(true)
    }
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/40 pointer-events-none"
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spellcheck-onboarding-title"
        data-testid="spellcheck-onboarding-modal"
      >
        <h2 id="spellcheck-onboarding-title" className="text-lg font-bold text-slate-900">
          Ortografía en los formularios
        </h2>
        <div className="text-sm text-slate-600 space-y-3">
          <p>
            SME ya activa la revisión ortográfica en los campos de texto libre. El diccionario
            depende de su navegador y del idioma del sistema.
          </p>
          <p>
            Para sugerencias más precisas en <strong>español</strong>, active la ortografía
            mejorada en Chrome o Edge:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-700">
            <li>Abra la configuración del navegador.</li>
            <li>Vaya a <span className="font-medium">Idiomas</span>.</li>
            <li>
              En <span className="font-medium">Español</span>, active{' '}
              <span className="font-medium">Ortografía mejorada</span> (
              <span className="italic">Enhanced spell check</span>).
            </li>
          </ol>
          <p className="text-xs text-slate-500">
            Por seguridad del navegador no podemos activar esa opción automáticamente; debe
            hacerlo una vez en cada equipo.
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            Entendido
          </button>
          <button
            type="button"
            onClick={() => {
              persistSpellcheckOnboardingDismissed()
              setOpen(false)
            }}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold"
          >
            No volver a mostrar
          </button>
        </div>
      </div>
    </div>
  )
}
