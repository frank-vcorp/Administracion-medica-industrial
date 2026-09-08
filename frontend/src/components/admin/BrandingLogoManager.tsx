'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  getBrandingLogoSettings,
  uploadBrandingLogo,
  resetBrandingLogo,
  type BrandingLogoSettings,
} from '@/actions/branding.actions'
import { SME_BRAND_LINE } from '@/lib/brand-constants'

export default function BrandingLogoManager() {
  const [settings, setSettings] = useState<BrandingLogoSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getBrandingLogoSettings()
    if (res.success && res.settings) {
      setSettings(res.settings)
    } else {
      setError(res.error || 'No se pudo cargar la configuración')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleUpload(file: File) {
    setUploading(true)
    setMessage(null)
    setError(null)
    const formData = new FormData()
    formData.append('logo', file)
    const res = await uploadBrandingLogo(formData)
    if (res.success && res.settings) {
      setSettings(res.settings)
      setMessage('Logo actualizado. Se refleja en login, menú y PDFs.')
    } else {
      setError(res.error || 'Error al subir el logo')
    }
    setUploading(false)
  }

  async function handleReset() {
    if (!confirm('¿Restaurar el logo predeterminado del sistema?')) return
    setUploading(true)
    setMessage(null)
    setError(null)
    const res = await resetBrandingLogo()
    if (res.success && res.settings) {
      setSettings(res.settings)
      setMessage('Logo restaurado al predeterminado.')
    } else {
      setError(res.error || 'Error al restaurar')
    }
    setUploading(false)
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando configuración…</p>
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Logo institucional</h2>
        <p className="text-sm text-slate-500 mt-1">
          {SME_BRAND_LINE}. Se usa en login, menú lateral y membrete de PDFs.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 min-w-[220px]">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Vista previa</p>
          {settings?.logoUrl ? (
            <Image
              src={settings.logoUrl}
              alt="Logo institucional"
              width={200}
              height={52}
              className="object-contain object-left max-h-14 w-auto"
              unoptimized
            />
          ) : (
            <p className="text-sm text-slate-400">Sin vista previa</p>
          )}
          <p className="text-xs text-slate-500 mt-3">
            Origen:{' '}
            <strong>{settings?.source === 'upload' ? 'Configuración' : 'Predeterminado'}</strong>
          </p>
          {settings?.originalFilename && (
            <p className="text-xs text-slate-400 mt-1 truncate" title={settings.originalFilename}>
              {settings.originalFilename}
            </p>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm"
          >
            {uploading ? 'Guardando…' : 'Subir nuevo logo'}
          </button>
          {settings?.source === 'upload' && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => void handleReset()}
              className="ml-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold px-5 py-2.5 rounded-xl text-sm"
            >
              Restaurar predeterminado
            </button>
          )}
          <p className="text-xs text-slate-400">PNG, JPG o WebP · máximo 2 MB</p>
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
