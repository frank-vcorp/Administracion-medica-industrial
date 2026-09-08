/**
 * @fileoverview Página de login
 * @author SOFIA - Builder
 * @id IMPL-20260225-01
 * @backup context/checkpoints/CHK_FIX-20260306-03-FULL-REVIEW.md
 * ARCH-20260908-01 — identidad visual AMI institucional
 */

'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { FormEvent, useState, Suspense } from 'react'
import { BrandLogo } from '@/components/BrandLogo'

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else if (result?.ok) {
        window.location.assign(result.url || callbackUrl)
        return
      } else {
        setError('No se pudo completar el inicio de sesión. Intenta nuevamente.')
      }
    } catch {
      setError('Error al iniciar sesión. Por favor, intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="border-b border-[#f0f0f0] px-6 py-3">
        <p className="text-center text-sm font-bold text-ami-primary">AMI Salud Responsable</p>
      </div>
      <div className="border-t-2 border-b-[6px] border-t-ami-secondary border-b-ami-primary bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-center">
          <BrandLogo className="max-h-14 w-auto" />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[24px] border border-ami-secondary/10 bg-white p-8 shadow-[0_8px_24px_#592c8226]">
          <h1 className="mb-2 text-center text-2xl font-bold text-ami-gray">
            Residente <span className="text-ami-secondary">Digital</span>
          </h1>
          <p className="mb-8 text-center text-sm text-ami-gray">
            Acceso al sistema de salud ocupacional
          </p>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-ami-secondary">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                className="w-full rounded-2xl border-2 border-gray-200 bg-ami-surface px-4 py-3 text-ami-secondary outline-none transition focus:border-ami-primary focus:bg-white focus:ring-4 focus:ring-ami-primary/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-ami-secondary">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-2xl border-2 border-gray-200 bg-ami-surface px-4 py-3 text-ami-secondary outline-none transition focus:border-ami-primary focus:bg-white focus:ring-4 focus:ring-ami-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-ami-primary py-3 font-semibold text-white shadow-[0_4px_12px_#00afaa4d] transition hover:bg-ami-primary-hover disabled:bg-ami-primary/40"
            >
              {loading ? 'Cargando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ami-gray">
            ¿No tienes cuenta? Contacta a tu administrador.
          </p>
          <p className="mt-2 text-center text-xs text-ami-gray/70">
            © 2026 AMI Salud Responsable. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <LoginForm />
    </Suspense>
  )
}
