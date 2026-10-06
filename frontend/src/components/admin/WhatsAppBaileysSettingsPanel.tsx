'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  disconnectWhatsAppBaileys,
  getWhatsAppBaileysSettings,
  saveWhatsAppBaileysEnabled,
  startWhatsAppBaileysPairing,
  type WhatsAppBaileysPublicSettings,
} from '@/actions/whatsapp-baileys.actions'

const STATUS_LABEL: Record<string, string> = {
  disconnected: 'Desconectado',
  qr_pending: 'Esperando escaneo de QR',
  connected: 'Conectado',
  error: 'Error',
}

export default function WhatsAppBaileysSettingsPanel() {
  const [settings, setSettings] = useState<WhatsAppBaileysPublicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const res = await getWhatsAppBaileysSettings()
    if (res.success && res.settings) {
      setSettings(res.settings)
      setEnabled(res.settings.enabled)
      if (res.error) setError(res.error)
    } else {
      setError(res.error || 'No se pudo cargar WhatsApp')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!settings || settings.status !== 'qr_pending') return
    const id = window.setInterval(() => {
      void load()
    }, 2500)
    return () => window.clearInterval(id)
  }, [settings?.status, load])

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
      setMessage('Escanee el QR con WhatsApp → Dispositivos vinculados.')
    } else {
      setError(res.error || 'No se pudo generar el QR')
    }
    setBusy(false)
  }

  async function handleDisconnect() {
    if (!confirm('¿Cerrar sesión de WhatsApp en el servidor?')) return
    setBusy(true)
    setMessage(null)
    setError(null)
    const res = await disconnectWhatsAppBaileys()
    if (res.success && res.settings) {
      setSettings(res.settings)
      setMessage('Sesión WhatsApp cerrada.')
    } else {
      setError(res.error || 'Error al desconectar')
    }
    setBusy(false)
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando WhatsApp (Baileys)…</p>
  }

  const statusKey = settings?.status ?? 'disconnected'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-900">WhatsApp (Baileys)</h2>
        <p className="text-sm text-slate-500 mt-1">
          Vincule la línea institucional escaneando un QR (como WhatsApp Web). Requiere el gateway
          Node en Railway con volumen en <code className="text-xs">/data/wa-auth</code>.
        </p>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 space-y-1">
        <p>
          Estado:{' '}
          <strong>{STATUS_LABEL[statusKey] ?? statusKey}</strong>
          {settings?.linkedPhone ? (
            <>
              {' '}
              · <span className="font-mono text-slate-800">{settings.linkedPhone}</span>
            </>
          ) : null}
        </p>
        {!settings?.gatewayConfigured ? (
          <p className="text-xs text-amber-800">
            Gateway no configurado en el frontend (
            <code className="text-xs">WHATSAPP_GATEWAY_URL</code> +{' '}
            <code className="text-xs">WHATSAPP_GATEWAY_SECRET</code>).
          </p>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded border-slate-300"
        />
        Usar envíos automáticos por WhatsApp cuando el gateway esté conectado
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleSaveEnabled()}
        className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold px-4 py-2 rounded-xl text-sm"
      >
        Guardar preferencia
      </button>

      <div className="border-t border-slate-100 pt-4 space-y-4">
        <p className="text-sm font-semibold text-slate-800">Alta / QR</p>
        {settings?.qrDataUrl ? (
          <div className="flex flex-col items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl">
            <Image
              src={settings.qrDataUrl}
              alt="Código QR WhatsApp"
              width={280}
              height={280}
              unoptimized
              className="rounded-lg"
            />
            <p className="text-xs text-slate-500 text-center max-w-xs">
              WhatsApp en el teléfono → Menú → Dispositivos vinculados → Vincular dispositivo
            </p>
          </div>
        ) : statusKey === 'connected' ? (
          <p className="text-sm text-emerald-700">Línea vinculada. Puede desconectar para cambiar de número.</p>
        ) : (
          <p className="text-sm text-slate-500">
            Pulse «Mostrar QR» para vincular. El código se actualiza automáticamente cada pocos segundos.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !settings?.gatewayConfigured}
            onClick={() => void handleStartQr()}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm"
          >
            {busy ? 'Procesando…' : statusKey === 'qr_pending' ? 'Regenerar QR' : 'Mostrar QR'}
          </button>
          <button
            type="button"
            disabled={busy || !settings?.gatewayConfigured || statusKey === 'disconnected'}
            onClick={() => void handleDisconnect()}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold px-5 py-2.5 rounded-xl text-sm"
          >
            Desvincular
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setLoading(true)
              void load()
            }}
            className="text-slate-600 underline text-sm px-2 py-2"
          >
            Actualizar estado
          </button>
        </div>
      </div>

      {settings?.lastError ? (
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
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
