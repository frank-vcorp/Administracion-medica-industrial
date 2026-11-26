/**
 * @fileoverview Página de login
 * @author SOFIA - Builder
 * @id IMPL-20260225-01
 * @backup context/checkpoints/CHK_FIX-20260306-03-FULL-REVIEW.md
 * ARCH-20260908-01 — identidad visual SME institucional
 */

'use client'

import { getSession, signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { FormEvent, useState, Suspense } from 'react'
import {
  AlertCircle,
  CalendarCheck2,
  Eye,
  EyeOff,
  FileCheck2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { SME_BRAND_LINE, SME_LEGAL_NAME } from '@/lib/brand-constants'

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
        const session = await getSession()
        const isPortalClient = session?.user?.role === 'COMPANY_CLIENT'
        const destination = isPortalClient
          ? '/portal'
          : result.url || callbackUrl
        window.location.assign(destination)
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
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-12">
      {/* Panel izquierdo: identidad institucional y beneficios */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#371854] via-sme-secondary to-[#007e7a] p-12 text-white lg:col-span-6 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.45) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sme-primary/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-3.5 rounded-2xl bg-white/95 px-4 py-2.5 shadow-lg">
            <BrandLogo className="h-9 w-auto" />
            <span className="border-l border-slate-200 pl-3.5 text-xs font-semibold text-sme-secondary">
              {SME_BRAND_LINE}
            </span>
          </div>
        </div>

        <div className="relative z-10 my-auto space-y-8 py-8">
          <div className="space-y-4">
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-teal-100">
              Salud Ocupacional Digital
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight text-white">
              Residente <span className="text-teal-200">Digital</span>
            </h2>
            <p className="max-w-md text-base leading-relaxed text-white/80">
              Plataforma integral de medicina laboral para clínicas y empresas.
            </p>
          </div>

          <div className="space-y-3.5 max-w-lg">
            <div className="flex items-start gap-3.5 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-teal-200">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Expedientes clínicos centralizados
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/75">
                  Estudios, interpretaciones e historial ocupacional en un solo lugar.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-teal-200">
                <CalendarCheck2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Portal empresarial en tiempo real
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/75">
                  Agenda de citas, seguimiento de colaboradores y métricas al día.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-teal-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Resultados y dictámenes firmados
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/75">
                  Entrega ágil y confidencial para empresas y pacientes.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/70">
          © 2026 {SME_LEGAL_NAME} · www.medicaindustrial.com
        </p>
      </aside>

      {/* Panel derecho: formulario de acceso */}
      <main className="flex flex-col items-center justify-center px-5 py-10 sm:px-10 lg:col-span-6">
        <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
          <BrandLogo className="h-12 w-auto" />
          <p className="text-center text-xs font-semibold text-sme-primary">{SME_BRAND_LINE}</p>
        </div>

        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-[0_20px_50px_-20px_rgba(89,44,130,0.22)] sm:p-10">
          <div className="mb-6 h-1.5 w-12 rounded-full bg-gradient-to-r from-sme-secondary to-sme-primary" />

          <h1 className="text-2xl font-bold text-slate-900">
            Residente <span className="text-sme-secondary">Digital</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Acceso al sistema de salud ocupacional
          </p>

          {error && (
            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sme-primary focus:bg-white focus:ring-4 focus:ring-sme-primary/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-11 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sme-primary focus:bg-white focus:ring-4 focus:ring-sme-primary/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sme-primary py-3.5 text-sm font-semibold text-white shadow-md shadow-sme-primary/25 transition hover:bg-sme-primary-hover disabled:bg-sme-primary/40"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            ¿No tienes cuenta? Contacta a tu administrador.
          </p>
          <p className="mt-2 text-center text-[11px] text-slate-400 lg:hidden">
            © 2026 {SME_LEGAL_NAME}. Todos los derechos reservados.
          </p>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginForm />
    </Suspense>
  )
}
