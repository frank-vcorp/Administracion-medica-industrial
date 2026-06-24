/**
 * @file Badge visual del canal/origen de auto-alta de una Company.
 * @id IMPL-20260624-01
 * @spec context/SPECs/SPEC_ARCH-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md
 *
 * Muestra el canal por el cual el cliente fue dado de alta:
 *   - VENDOR_LINK   → "Link de Vendedor" (índigo)
 *   - PUBLIC_DIRECT → "Solicitud Web Pública" (azul claro)
 *   - null          → "Alta Manual" (gris)
 *
 * Este badge complementa al CompanyStatusBadge (que muestra estado + origen
 * AUTO_ALTA/MANUAL). Aquí se discrimina el sub-canal dentro de AUTO_ALTA.
 */
export type CompanyChannel = 'VENDOR_LINK' | 'PUBLIC_DIRECT' | null

const CHANNEL_LABELS: Record<Exclude<CompanyChannel, null>, { label: string; classes: string }> = {
  VENDOR_LINK: {
    label: 'Link de Vendedor',
    classes: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  PUBLIC_DIRECT: {
    label: 'Solicitud Web Pública',
    classes: 'bg-sky-100 text-sky-800 border-sky-200',
  },
}

const MANUAL_FALLBACK = {
  label: 'Alta Manual',
  classes: 'bg-slate-100 text-slate-700 border-slate-200',
}

export function CompanyOriginBadge({
  channel,
  size = 'md',
}: {
  channel: CompanyChannel
  size?: 'sm' | 'md'
}) {
  const c = channel ? CHANNEL_LABELS[channel] : MANUAL_FALLBACK
  const sizeClass = size === 'md' ? 'text-xs px-3 py-1' : 'text-[10px] px-2 py-0.5'
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full border ${sizeClass} ${c.classes}`}
      title={`Canal de origen: ${c.label}`}
      data-testid="company-origin-badge"
      data-channel={channel ?? 'MANUAL'}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" aria-hidden />
      {c.label}
    </span>
  )
}