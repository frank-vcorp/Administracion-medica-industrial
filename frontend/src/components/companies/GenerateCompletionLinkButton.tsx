"use client"

/**
 * @file Botón cliente para generar link de "completar datos" (Sub-A de ARCH-20260624-03).
 * @id IMPL-20260624-05
 *
 * Uso: <GenerateCompletionLinkButton companyId={...} role={...} estado={...} />
 *
 * - Solo visible para ADMIN o VENDEDOR.
 * - Solo habilitado si la Company está en estado HABILITADO.
 * - Al click: invoca generateCompanyDataCompletionLinkAction.
 * - Muestra el URL generado en un modal para copiar.
 * - El URL expira en 168h (7 días) e incluye ?ref=<userId> para trazabilidad.
 */

import { useState, useTransition } from 'react'
import { generateCompanyDataCompletionLinkAction } from '@/actions/company.actions'
import { isSellerLike } from '@/lib/auth/roles'

interface Props {
  companyId: string
  companyName: string
  role: string
  estado: 'PENDIENTE_REVISION' | 'HABILITADO' | 'DESHABILITADO'
}

export default function GenerateCompletionLinkButton({
  companyId,
  companyName,
  role,
  estado,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [url, setUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const allowed = isSellerLike(role) && estado === 'HABILITADO'

  if (!allowed) return null

  const handleClick = () => {
    setError(null)
    setCopied(false)
    startTransition(async () => {
      const result = await generateCompanyDataCompletionLinkAction(companyId)
      if (result.ok) {
        setUrl(result.url)
        setExpiresAt(new Date(result.expiresAt).toLocaleString('es-MX'))
      } else {
        setError(result.error ?? 'Error desconocido')
      }
    })
  }

  const handleCopy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select+execCommand (legacy)
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
      document.body.removeChild(ta)
    }
  }

  const handleClose = () => {
    setUrl(null)
    setExpiresAt(null)
    setError(null)
    setCopied(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={`Generar link para que "${companyName}" complete sus datos por sí misma`}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 flex-shrink-0"
      >
        <span>🔗</span>
        {isPending ? 'Generando...' : 'Generar link para completar datos'}
      </button>

      {error && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={handleClose}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-rose-700 mb-2">❌ Error</h3>
            <p className="text-sm text-slate-700 mb-4">{error}</p>
            <button onClick={handleClose} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 rounded-lg">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {url && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={handleClose}>
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-800 mb-2">🔗 Link generado</h3>
            <p className="text-sm text-slate-600 mb-4">
              Comparte este link con <strong>{companyName}</strong> para que complete o actualice sus datos.
              {expiresAt && (
                <> Expira el <strong>{expiresAt}</strong>.</>
              )}
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
              <code className="text-xs text-slate-800 break-all">{url}</code>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2"
              >
                {copied ? '✓ Copiado' : '📋 Copiar link'}
              </button>
              <button
                onClick={handleClose}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
