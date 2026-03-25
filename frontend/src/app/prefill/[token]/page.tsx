/**
 * @fileoverview Portal Público de Prellenado del Módulo 1 — Ruta /prefill/[token]
 * @description Valida el token de invitación (server-side) y renderiza el formulario
 *              del trabajador o el estado de error correspondiente.
 *              Sin autenticación de sesión; seguridad por token SHA-256 de 32 bytes.
 * @see SPEC ARCH-20260324-09, ARCH-20260325-06
 * @id IMPL-20260325-01
 */

import { validatePublicToken } from '@/actions/prefilled-invitation.actions'
import PrefillPortalClient from './PrefillPortalClient'

interface Props {
  params: Promise<{ token: string }>
}

/** Mensajes y acciones por error de token */
const ERROR_CONFIG: Record<string, { emoji: string; title: string; message: string }> = {
  TOKEN_INVALID: {
    emoji: '🔒',
    title: 'Enlace no válido',
    message: 'Este enlace de prellenado no es válido o no existe. Solicita uno nuevo a la clínica.',
  },
  TOKEN_EXPIRED: {
    emoji: '⏰',
    title: 'Enlace expirado',
    message: 'Este enlace de prellenado ha caducado (vigencia de 6 horas). Solicita un nuevo enlace en recepción.',
  },
  TOKEN_ALREADY_SUBMITTED: {
    emoji: '✅',
    title: 'Formulario ya enviado',
    message: 'Ya enviaste tus antecedentes médicos correctamente. El médico los revisará durante tu cita. ¡Gracias!',
  },
  TOKEN_CANCELLED: {
    emoji: '🚫',
    title: 'Invitación cancelada',
    message: 'Este enlace fue cancelado. Si crees que es un error, contacta a la clínica para generar un nuevo enlace.',
  },
}

export default async function PrefillPage({ params }: Props) {
  const { token } = await params

  const result = await validatePublicToken(token)

  if (!result.success || !result.data) {
    const cfg = ERROR_CONFIG[result.error ?? 'TOKEN_INVALID'] ?? ERROR_CONFIG.TOKEN_INVALID

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-10 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-4xl">
            {cfg.emoji}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">{cfg.title}</h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">{cfg.message}</p>
          </div>
          <div className="border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-400">
              Sistema de Gestión Médica Industrial · AMI
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { workerName, companyName, scheduledAt, expiresAt, existingData } = result.data

  return (
    <PrefillPortalClient
      token={token}
      workerName={workerName}
      companyName={companyName ?? ''}
      scheduledAt={new Date(scheduledAt).toISOString()}
      expiresAt={new Date(expiresAt).toISOString()}
      existingData={existingData as Record<string, unknown> | null}
    />
  )
}
