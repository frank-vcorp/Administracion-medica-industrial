'use client'

import { useEffect, useState } from 'react'
import { GlobalSearchBar } from '@/components/GlobalSearchBar'

export function GlobalSearchLauncher() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Cerrar búsqueda"
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Búsqueda general del sistema"
          className="fixed bottom-24 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] max-h-[min(32rem,calc(100vh-7rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-6"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Búsqueda general</p>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <GlobalSearchBar
              layout="panel"
              autoFocus
              onDismiss={() => setOpen(false)}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label="Abrir búsqueda general"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-ami-primary bg-ami-primary text-2xl text-white shadow-[0_4px_12px_#00afaa4d] transition hover:bg-ami-primary-hover hover:shadow-[0_6px_16px_#00afaa66] focus:outline-none focus:ring-2 focus:ring-ami-primary focus:ring-offset-2 sm:bottom-6 sm:right-6"
      >
        {open ? '✕' : '🔍'}
      </button>
    </>
  )
}
