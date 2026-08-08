'use client'

/**
 * @file IdentityLightbox — lightbox nativo basado en <dialog> para
 * ampliacion de imagenes de identificacion (data URLs).
 * @id IMPL-20260808-04
 * @spec context/SPECs/SPEC_IMPL-20260808-04-LAST-IDENTITY-UI.md
 *
 * Sin dependencias externas. Reusa el patron existente en
 * CorroborationModal.tsx (linea 322, 346, 385): `<img>` nativo con
 * `eslint-disable @next/next/no-img-element` porque las imagenes son
 * data URLs base64 (no optimizables por next/image).
 *
 * API:
 *   <IdentityLightbox
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     src={w.lastIdentityFrontFileUrl}
 *     alt="Frente del documento"
 *     title="Identificacion del paciente"
 *     subtitle={DOC_TYPE_LABELS[w.lastIdentityDocumentType]}
 *     backSrc={w.lastIdentityBackFileUrl}  // opcional
 *   />
 */
import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  src: string | null
  alt: string
  title?: string
  subtitle?: string | null
  /** Reverso opcional. Si se provee, la UI muestra dos imagenes lado a lado. */
  backSrc?: string | null
  backAlt?: string
}

export default function IdentityLightbox({
  open,
  onClose,
  src,
  alt,
  title,
  subtitle,
  backSrc,
  backAlt,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (open && !dlg.open) {
      try {
        dlg.showModal()
      } catch {
        // showModal puede lanzar si el dialog ya esta abierto; ignorar.
      }
    } else if (!open && dlg.open) {
      dlg.close()
    }
  }, [open])

  // Sincroniza el cierre nativo (ESC, backdrop) con el state del padre.
  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    const handleClose = () => onClose()
    dlg.addEventListener('close', handleClose)
    return () => dlg.removeEventListener('close', handleClose)
  }, [onClose])

  // Cierra al click en el backdrop (fuera del contenido).
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  if (!src) return null

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="bg-transparent p-0 m-0 max-w-none max-h-none w-screen h-screen backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      aria-label={title ?? 'Vista ampliada de identificacion'}
    >
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
            <div>
              {title && (
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-2xl leading-none w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div className={`p-6 grid gap-4 ${backSrc ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            <figure className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Frente</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL base64 (no external); next/Image requiere hosts declarados. */}
              <img
                src={src}
                alt={alt}
                className="w-full h-auto max-h-[80vh] object-contain rounded-xl border border-slate-200 bg-slate-50"
              />
            </figure>
            {backSrc && (
              <figure className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reverso</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL base64 (no external); next/Image requiere hosts declarados. */}
                <img
                  src={backSrc}
                  alt={backAlt ?? 'Reverso'}
                  className="w-full h-auto max-h-[80vh] object-contain rounded-xl border border-slate-200 bg-slate-50"
                />
              </figure>
            )}
          </div>
        </div>
      </div>
    </dialog>
  )
}
