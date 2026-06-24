/**
 * @file Badge visual de estado y origen de una Company.
 * @id IMPL-20260623-02
 */
import type { CompanyStatus, CompanyOrigin } from '@prisma/client'

const ESTADO_LABELS: Record<CompanyStatus, { label: string; classes: string }> = {
  PENDIENTE_REVISION: { label: 'Pendiente', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  HABILITADO: { label: 'Habilitado', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  DESHABILITADO: { label: 'Deshabilitado', classes: 'bg-slate-200 text-slate-700 border-slate-300' },
}

const ORIGEN_LABELS: Record<CompanyOrigin, { label: string; classes: string; icon: string }> = {
  MANUAL: { label: 'Manual', classes: 'bg-slate-100 text-slate-700 border-slate-200', icon: '✋' },
  AUTO_ALTA: { label: 'Auto-Alta', classes: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: '🔗' },
}

export function CompanyStatusBadge({
  estado,
  origen,
  size = 'sm',
}: {
  estado: CompanyStatus
  origen?: CompanyOrigin
  size?: 'sm' | 'md'
}) {
  const e = ESTADO_LABELS[estado] ?? ESTADO_LABELS.HABILITADO
  const o = origen ? ORIGEN_LABELS[origen] : null
  const sizeClass = size === 'md' ? 'text-xs px-3 py-1' : 'text-[10px] px-2 py-0.5'
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 font-bold rounded-full border ${sizeClass} ${e.classes}`}
        data-testid="company-status-badge"
        data-estado={estado}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" aria-hidden />
        {e.label}
      </span>
      {o && (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-full border ${sizeClass} ${o.classes}`}
          title={`Origen: ${o.label}`}
        >
          <span aria-hidden>{o.icon}</span>
          {o.label}
        </span>
      )}
    </span>
  )
}
