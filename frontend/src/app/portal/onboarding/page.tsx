'use client'

import { useState, useTransition } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { completePortalOnboarding } from '@/actions/company-portal.actions'
import { PORTAL_PRIVACY_PATH, PORTAL_TERMS_PATH } from '@/lib/portal-legal'

export default function PortalOnboardingPage() {
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await completePortalOnboarding({
        acceptTerms,
        acceptPrivacy,
        newPassword,
        confirmPassword,
      })
      if (!res.success) {
        setError(res.error ?? 'No se pudo completar el registro')
        return
      }
      await signOut({ callbackUrl: '/login?portalOnboarded=1' })
    })
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Bienvenido al portal cliente</h1>
      <p className="text-sm text-slate-600 mb-6">
        Antes de continuar, acepte los documentos legales y defina su contraseña definitiva.
      </p>

      <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
        <label className="flex gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1"
          />
          <span>
            He leído y acepto los{' '}
            <Link href={PORTAL_TERMS_PATH} target="_blank" className="text-violet-700 underline">
              términos y condiciones
            </Link>{' '}
            del portal.
          </span>
        </label>

        <label className="flex gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
            className="mt-1"
          />
          <span>
            He leído y acepto el{' '}
            <Link href={PORTAL_PRIVACY_PATH} target="_blank" className="text-violet-700 underline">
              aviso de privacidad
            </Link>
            .
          </span>
        </label>

        <div>
          <label className="text-xs text-slate-500 block mb-1">Nueva contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Confirmar contraseña</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Continuar al portal'}
        </button>
      </form>
    </div>
  )
}
