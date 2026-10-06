'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  disconnectWhatsAppBaileys,
  getWhatsAppBaileysSettings,
  saveWhatsAppBaileysEnabled,
  saveWhatsAppGatewaySettings,
  startWhatsAppBaileysPairing,
  type WhatsAppBaileysPublicSettings,
} from '@/actions/whatsapp-baileys.actions'

const STATUS_LABEL: Record<string, string> = {
  disconnected: 'Sin vincular',
  qr_pending: 'Escanee el QR con su teléfono',
  connected: 'Vinculado',
  error: 'Error',
}

export default function WhatsAppBaileysSettingsPanel() {
  const [settings, setSettings] = useState<WhatsAppBaileysPublicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [gatewayUrl, setGatewayUrl] = useState('')
  const [gatewaySecret, setGatewaySecret] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await getWhatsAppBaileysSettings()
      if (res.success && res.settings) {
        setSettings(res.settings)
        setEnabled(res.settings.enabled)
        setGatewayUrl(res.settings.gatewayUrl)
        if (!res.settings.gatewayConfigured) setShowAdvanced(true)
        if (res.error) setError(res.error)
      } else {
        setError(res.error || 'No se pudo cargar WhatsApp')
      }
    } catch {
      setError('Error al cargar WhatsApp')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!settings || settings.status !== 'qr_pending') return
    const id = window.setInterval(() => void load(), 2500)
    return () => window.clearInterval(id)
  }, [settings?.status, load])

  async function handleSaveGateway(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    setError(null)
    const res = await saveWhatsAppGatewaySettings({
      gatewayUrl,
      gatewaySecret: gatewaySecret.trim() || undefined,
    })
    if (res.success && res.settings) {
      setSettings(res.settings)
      setGatewaySecret('')
      setMessage('Servidor de WhatsApp actualizado.')
      setShowAdvanced(false)
    } else {
      setError(res.error || 'Error al guardar')
    }
    setBusy(false)
  }

  async function handleSaveEnabled() {
    setBusy(true)
    setMessage(null)
    setError(null)
    const res = await saveWhatsAppBaileysEnabled(enabled)
    if (res.success && res.settings) {
      setSettings(res.settings)
      setMessage('Preferencia guardada.')
    } else {
      setError(res.error || 'Error al guardar')
    }
    setBusy(false)
  }

  async function handleStartQr() {
    setBusy(true)
    setMessage(null)
    setError(null)
    const res = await startWhatsAppBaileysPairing()
    if (res.success && res.settings) {
      setSettings(res.settings)
      setMessage(
        'Abra WhatsApp en su celular → Configuración → Dispositivos vinculados → Vincular dispositivo → escanee el código.',
      )
    } else {
      setError(res.error || 'No se pudo generar el QR')
    }
    setBusy(false)
  }

  async function handleDisconnect() {
    if (!confirm('¿Desvincular esta línea de WhatsApp del sistema?')) return
    setBusy(true)
    setMessage(null)
    setError(null)
    const res = await disconnectWhatsAppBaileys()
    if (res.success && res.settings) {
      setSettings(res.settings)
      setMessage('Línea desvinculada.')
    } else {
      setError(res.error || 'Error al desvincular')
    }
    setBusy(false)
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando WhatsApp…</p>
  }

  const statusKey = settings?.status ?? 'disconnected'
  const hasServer = Boolean(settings?.gatewayUrl?.trim())
  const gatewayReady = settings?.gatewayConfigured && settings.gatewayReachable
  const needsInfra = !hasServer && !settings?.gatewayConfigured

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-900">WhatsApp</h2>
        <p className="text-sm text-slate-500 mt-1">
          Vincule la línea con la que enviará mensajes (como WhatsApp Web).{' '}
          <strong>No escribe su número aquí</strong>: use el teléfono donde tiene WhatsApp para escanear el QR.
        </p>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-700 space-y-1">
        <p>
          Estado: <strong>{STATUS_LABEL[statusKey] ?? statusKey}</strong>
        </p>
        {settings?.linkedPhone ? (
          <p>
            Línea vinculada: <span className="font-mono font-semibold">{settings.linkedPhone}</span>
          </p>
        ) : null}
        {needsInfra ? (
          <p className="text-xs text-amber-800">Falta configurar el servidor (solo una vez, soporte).</p>
        ) : !settings?.gatewayReachable ? (
          <p className="text-xs text-amber-800">El servidor WhatsApp no responde; intente de nuevo en unos minutos.</p>
        ) : null}
      </div>

      <div className="space-y-4">
        {settings?.qrDataUrl ? (
          <div className="flex flex-col items-center gap-3 p-4 bg-white border-2 border-green-100 rounded-xl">
            <Image
              src={settings.qrDataUrl}
              alt="Código QR WhatsApp"
              width={280}
              height={280}
              unoptimized
              className="rounded-lg"
            />
            <p className="text-sm text-slate-600 text-center max-w-sm">
              En su <strong>celular</strong>, abra WhatsApp y escanee este código (Dispositivos vinculados).
            </p>
          </div>
        ) : statusKey === 'connected' ? (
          <p className="text-sm text-emerald-700 font-medium">La línea ya está vinculada y lista para envíos.</p>
        ) : (
          <p className="text-sm text-slate-500">
            Pulse el botón verde para mostrar el QR. Tenga a mano el teléfono con la app WhatsApp de la línea
            institucional.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || needsInfra || !gatewayReady}
            onClick={() => void handleStartQr()}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-base"
          >
            {busy ? 'Generando…' : statusKey === 'qr_pending' ? 'Actualizar QR' : 'Mostrar QR'}
          </button>
          {statusKey === 'connected' || statusKey === 'qr_pending' ? (
            <button
              type="button"
              disabled={busy || !gatewayReady}
              onClick={() => void handleDisconnect()}
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold px-5 py-3 rounded-xl text-sm"
            >
              Desvincular
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Permitir envíos automáticos por WhatsApp desde el sistema
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSaveEnabled()}
          className="text-sm text-blue-600 font-semibold hover:underline disabled:opacity-50"
        >
          Guardar preferencia de envíos
        </button>
      </div>

      <details
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
        className="border border-slate-100 rounded-xl p-4 text-sm"
      >
        <summary className="cursor-pointer font-semibold text-slate-700">
          Configuración técnica del servidor (normalmente ya está lista)
        </summary>
        <form onSubmit={(e) => void handleSaveGateway(e)} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">URL del gateway</label>
            <input
              type="url"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Secret (opcional al cambiar)</label>
            <input
              type="password"
              autoComplete="new-password"
              value={gatewaySecret}
              onChange={(e) => setGatewaySecret(e.target.value)}
              placeholder={settings?.gatewaySecretSuffix ? `…${settings.gatewaySecretSuffix}` : ''}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !settings?.canStoreSecrets}
            className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm"
          >
            Guardar servidor
          </button>
        </form>
      </details>

      {settings?.lastError && !error ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {settings.lastError}
        </p>
      ) : null}
      {message && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  )
}
