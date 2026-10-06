'use client'

import { useTransition } from 'react'
import { endPortalPreview } from '@/actions/portal-preview.actions'

type Props = {
  companyId: string
  companyName: string
}

export default function PortalPreviewBanner({ companyId, companyName }: Props) {
  const [pending, startTransition] = useTransition()

  return (
    <div
      className="bg-amber-500 text-amber-950 px-4 py-2 text-sm flex flex-wrap items-center justify-between gap-2 border-b border-amber-600/30"
      role="status"
    >
      <p>
        <strong>Vista previa del portal</strong> — viendo como empresa:{' '}
        <span className="font-semibold">{companyName}</span>. Los datos son los mismos que vería
        el cliente; las acciones de staff siguen auditadas.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await endPortalPreview(companyId)
          })
        }
        className="shrink-0 bg-amber-950/10 hover:bg-amber-950/20 px-3 py-1 rounded-lg font-bold text-xs disabled:opacity-50"
      >
        {pending ? 'Saliendo…' : 'Salir de vista previa'}
      </button>
    </div>
  )
}
