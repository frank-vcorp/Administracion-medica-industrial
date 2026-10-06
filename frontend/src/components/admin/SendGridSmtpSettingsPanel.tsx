'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getSendGridSmtpSettings,
  probeSendGridSmtpConnection,
  saveSendGridSmtpSettings,
  type SendGridSmtpPublicSettings,
} from '@/actions/sendgrid-smtp.actions'
import { SENDGRID_SMTP_PORTS } from '@/schemas/sendgrid-smtp.schema'

export default function SendGridSmtpSettingsPanel() {
  const [settings, setSettings] = useState<SendGridSmtpPublicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [probing, setProbing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [port, setPort] = useState(465)
  const [enabled, setEnabled] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [fromPortalAccess, setFromPortalAccess] = useState('')
  const [fromResults, setFromResults] = useState('')
  const [fromReceipts, setFromReceipts] = useState('')
  const [testEmail, setTestEmail] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getSendGridSmtpSettings()
    if (res.success && res.settings) {
      setSettings(res.settings)
      setPort(res.settings.port)
      setEnabled(res.settings.enabled)
      setFromAddress(res.settings.fromAddress)
      setFromPortalAccess(res.settings.fromPortalAccess)
      setFromResults(res.settings.fromResults)
      setFromReceipts(res.settings.fromReceipts)
    } else {
      setError(res.error || 'No se pudo cargar SendGrid')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    const res = await saveSendGridSmtpSettings({
      port,
      enabled,
      fromAddress,
      fromPortalAccess,
      fromResults,
      fromReceipts,
      apiKey: apiKey.trim() || undefined,
    })
    if (res.success && res.settings) {
      setSettings(res.settings)
      setApiKey('')
      setMessage('Configuración SendGrid guardada.')
    } else {
      setError(res.error || 'Error al guardar')
    }
    setSaving(false)
  }

  async function handleProbe() {
    setProbing(true)
    setMessage(null)
    setError(null)
    const res = await probeSendGridSmtpConnection(testEmail.trim() || undefined)
    if (res.success) {
      setMessage('Correo de prueba enviado. Revise la bandeja de entrada.')
    } else {
      setError(res.error || 'La prueba falló')
    }
    setProbing(false)
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando SendGrid…</p>
  }

  const sourceLabel =
    settings?.source === 'db'
      ? 'Configuración guardada en el sistema'
      : settings?.source === 'env'
        ? 'Variables SMTP_* del servidor (respaldo)'
        : 'Sin correo saliente configurado'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-900">SendGrid (correo saliente)</h2>
        <p className="text-sm text-slate-500 mt-1">
          Relay SMTP oficial de SendGrid para portal B2B, recibos y resultados parciales.
        </p>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 space-y-2">
        <p className="font-semibold text-slate-800">Parámetros SMTP (documentación SendGrid)</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Servidor: <code className="text-xs bg-white px-1 rounded">smtp.sendgrid.net</code>
          </li>
          <li>Puertos: 25, 587 (TLS) o 465 (SSL — recomendado)</li>
          <li>
            Usuario: <code className="text-xs bg-white px-1 rounded">apikey</code>
          </li>
          <li>Contraseña: su API key de SendGrid</li>
        </ul>
        <p className="text-xs text-slate-500 pt-1">
          Estado actual: <strong>{sourceLabel}</strong>
          {settings?.configured && settings.apiKeySuffix ? (
            <>
              {' '}
              · API key …{settings.apiKeySuffix}
            </>
          ) : null}
          {settings?.envFallbackActive ? (
            <span className="block mt-1">
              Hay SMTP por variables de entorno; la configuración de esta pantalla tiene prioridad cuando
              está habilitada y guardada.
            </span>
          ) : null}
        </p>
      </div>

      {!settings?.canStoreSecrets && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Configure <code className="text-xs">NEXTAUTH_SECRET</code> o{' '}
          <code className="text-xs">ENCRYPTION_KEY</code> en el servidor para poder guardar la API key.
        </p>
      )}

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Usar SendGrid configurado aquí (activo)
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Puerto</label>
            <select
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              {SENDGRID_SMTP_PORTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                  {p === 465 ? ' (SSL, recomendado)' : p === 587 ? ' (TLS)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Usuario SMTP</label>
            <input
              type="text"
              readOnly
              value="apikey"
              className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
            API key (contraseña SMTP)
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={settings?.configured ? 'Dejar vacío para no cambiar' : 'Pegue su API key'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>

        <fieldset className="space-y-3 border-t border-slate-100 pt-4">
          <legend className="text-sm font-semibold text-slate-800">Remitentes verificados en SendGrid</legend>
          <p className="text-xs text-slate-500">
            Use direcciones autorizadas en SendGrid. El remitente general aplica si no define uno específico.
          </p>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Remitente general</label>
            <input
              type="email"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="no-reply@su-dominio.com"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Portal B2B (credenciales)</label>
            <input
              type="email"
              value={fromPortalAccess}
              onChange={(e) => setFromPortalAccess(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Resultados parciales</label>
            <input
              type="email"
              value={fromResults}
              onChange={(e) => setFromResults(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Recibos de pago</label>
            <input
              type="email"
              value={fromReceipts}
              onChange={(e) => setFromReceipts(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={saving || !settings?.canStoreSecrets}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>

      <div className="border-t border-slate-100 pt-4 space-y-2">
        <p className="text-sm font-semibold text-slate-800">Probar conexión</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Correo de prueba (opcional)"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={probing}
            onClick={() => void handleProbe()}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold px-5 py-2.5 rounded-xl text-sm whitespace-nowrap"
          >
            {probing ? 'Enviando…' : 'Enviar correo de prueba'}
          </button>
        </div>
      </div>

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
