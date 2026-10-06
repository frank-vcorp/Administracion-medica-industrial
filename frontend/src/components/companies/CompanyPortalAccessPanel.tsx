'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  getCompanyPortalAccessState,
  provisionCompanyPortalUser,
  revokeCompanyPortalAccess,
  setCompanyPortalEnabled,
  type CompanyPortalAccessState,
} from '@/actions/company-portal.actions'
import { isAdminLike, isSellerLike } from '@/lib/auth/roles'

type Props = {
  companyId: string
  companyName: string
  defaultEmail: string | null
  defaultContactName: string | null
  estado: 'PENDIENTE_REVISION' | 'HABILITADO' | 'DESHABILITADO'
  role: string
}

export default function CompanyPortalAccessPanel({
  companyId,
  companyName,
  defaultEmail,
  defaultContactName,
  estado,
  role,
}: Props) {
  const router = useRouter()
  const canManage = isAdminLike(role) || isSellerLike(role)
  const [state, setState] = useState<CompanyPortalAccessState | null>(null)
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [fullName, setFullName] = useState(defaultContactName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!canManage) return
    void getCompanyPortalAccessState(companyId).then((res) => {
      if (res.success && res.state) setState(res.state)
    })
  }, [canManage, companyId])

  if (!canManage) return null

  const refresh = () => {
    void getCompanyPortalAccessState(companyId).then((res) => {
      if (res.success && res.state) setState(res.state)
    })
    router.refresh()
  }

  const handleToggle = (enabled: boolean) => {
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const res = await setCompanyPortalEnabled(companyId, enabled)
      if (!res.success) {
        setError(res.error ?? 'No se pudo actualizar')
        return
      }
      setInfo(enabled ? 'Acceso al portal activado.' : 'Acceso al portal desactivado.')
      refresh()
    })
  }

  const handleProvision = () => {
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const res = await provisionCompanyPortalUser({
        companyId,
        email,
        fullName: fullName || undefined,
      })
      if (!res.success) {
        setError(res.error ?? 'No se pudo generar acceso')
        return
      }
      setInfo(
        res.emailSkipped
          ? 'Usuario portal listo (SMTP no configurado: revise logs para la contraseña temporal).'
          : 'Credenciales enviadas por correo.',
      )
      refresh()
    })
  }

  const handleRevoke = () => {
    if (!confirm('¿Revocar acceso al portal? El usuario no podrá iniciar sesión.')) return
    setError(null)
    setInfo(null)
    startTransition(async () => {
      const res = await revokeCompanyPortalAccess(companyId)
      if (!res.success) {
        setError(res.error ?? 'No se pudo revocar')
        return
      }
      setInfo('Acceso revocado.')
      refresh()
    })
  }

  const portalOn = state?.portalEnabled ?? false

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Portal cliente (usuario único)
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Acceso B2B para {companyName}: un usuario/contraseña por empresa. Primera sesión: términos,
          privacidad y cambio de contraseña.
        </p>
      </div>

      {estado !== 'HABILITADO' && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          La empresa debe estar <strong>habilitada</strong> para provisionar el portal.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {info}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-slate-700">Acceso al portal</span>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={`portal-${companyId}`}
            checked={portalOn}
            disabled={pending || estado !== 'HABILITADO'}
            onChange={() => handleToggle(true)}
          />
          Sí
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={`portal-${companyId}`}
            checked={!portalOn}
            disabled={pending}
            onChange={() => handleToggle(false)}
          />
          No
        </label>
      </div>

      {state?.portalUser && (
        <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-3 space-y-1">
          <p>
            <strong>Usuario:</strong> {state.portalUser.email}{' '}
            {!state.portalUser.isActive && (
              <span className="text-red-600 font-semibold">(inactivo)</span>
            )}
          </p>
          <p>
            <strong>Legal aceptado:</strong>{' '}
            {state.portalUser.legalAccepted ? 'Sí' : 'Pendiente (primer acceso)'}
          </p>
          <p>
            <strong>Contraseña:</strong>{' '}
            {state.portalUser.mustChangePassword ? 'Temporal — debe cambiarla' : 'Definitiva'}
          </p>
        </div>
      )}

      {portalOn && estado === 'HABILITADO' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Correo del responsable portal</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="rh@empresa.com"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Nombre (opcional)</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !email.trim()}
              onClick={handleProvision}
              className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {state?.portalUser ? 'Reenviar / restablecer acceso' : 'Generar acceso y enviar correo'}
            </button>
            {state?.portalUser && (
              <button
                type="button"
                disabled={pending}
                onClick={handleRevoke}
                className="border border-red-200 text-red-700 text-sm font-bold px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                Revocar acceso
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
