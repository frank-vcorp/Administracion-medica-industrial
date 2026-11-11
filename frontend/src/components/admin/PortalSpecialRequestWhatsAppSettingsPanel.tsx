'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getPortalSpecialRequestWhatsAppSettings,
  savePortalSpecialRequestWhatsAppSettings,
  type PortalSpecialRequestWhatsAppPublicSettings,
} from '@/actions/portal-special-request-whatsapp.actions'

const MAX_PHONES = 5

export default function PortalSpecialRequestWhatsAppSettingsPanel() {
  const [settings, setSettings] = useState<PortalSpecialRequestWhatsAppPublicSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phones, setPhones] = useState<string[]>([''])
  const [copyToSeller, setCopyToSeller] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPortalSpecialRequestWhatsAppSettings()
      if (res.success && res.settings) {
        setSettings(res.settings)
        setCopyToSeller(res.settings.copyToSeller)
        setPhones(res.settings.phones.length > 0 ? res.settings.phones : [''])
      } else {
        setError(res.error || 'No se pudo cargar la configuración')
      }
    } catch {
      setError('Error de red al cargar. Recargue la página.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    const cleaned = phones.map(p => p.trim()).filter(Boolean)
    const res = await savePortalSpecialRequestWhatsAppSettings({
      phones: cleaned,
      copyToSeller,
    })
    if (res.success && res.settings) {
      setSettings(res.settings)
      setPhones(res.settings.phones.length > 0 ? res.settings.phones : [''])
      setMessage('Números guardados. Las solicitudes del portal los usarán al enviar por WhatsApp institucional.')
    } else {
      setError(res.error || 'Error al guardar')
    }
    setSaving(false)
  }

  function addRow() {
    if (phones.length >= MAX_PHONES) return
    setPhones(prev => [...prev, ''])
  }

  function removeRow(i: number) {
    setPhones(prev => (prev.length <= 1 ? [''] : prev.filter((_, j) => j !== i)))
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Atención personalizada (portal)</h2>
        <p className="text-sm text-slate-500 mt-1">
          Números WhatsApp que reciben la solicitud cuando el cliente usa &quot;atención personalizada&quot;
          (sin cupo o varias citas). Requiere{' '}
          <strong>WhatsApp institucional (Baileys)</strong> activo en Configuración. Si no guarda ningún
          número aquí, se usa la variable <code className="text-xs bg-slate-100 px-1 rounded">PORTAL_LOGISTICS_WHATSAPP</code>{' '}
          y, en último caso, el número por defecto de AMI.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-500">Números de logística (hasta {MAX_PHONES})</span>
            {phones.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="tel"
                  value={p}
                  onChange={e => {
                    const v = e.target.value
                    setPhones(prev => prev.map((x, j) => (j === i ? v : x)))
                  }}
                  placeholder="10 dígitos o con LADA (ej. 4421234567)"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                {phones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-xs text-red-600 hover:underline shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
            {phones.length < MAX_PHONES && (
              <button
                type="button"
                onClick={addRow}
                className="text-xs font-bold text-teal-700 hover:underline"
              >
                + Agregar otro número
              </button>
            )}
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={copyToSeller}
              onChange={e => setCopyToSeller(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-slate-700">
              También enviar copia al <strong>vendedor</strong> asignado a la empresa (si tiene teléfono en el perfil).
            </span>
          </label>

          {settings?.updatedAt && (
            <p className="text-xs text-slate-400">Última actualización: {new Date(settings.updatedAt).toLocaleString('es-MX')}</p>
          )}

          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-4 py-2 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}
    </section>
  )
}
