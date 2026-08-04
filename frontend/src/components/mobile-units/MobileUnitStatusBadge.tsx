/**
 * @file MobileUnitStatusBadge — Píldora de estado de unidad móvil.
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 *
 * Componente presentacional sin estado. Paridad con BranchStatusBadge:
 *   - rounded-full (píldora, no cuadrado con borde)
 *   - text-[10px] uppercase font-bold
 *   - colores suaves sin borde (bg-*-100 text-*-700)
 *
 * Si llega un status desconocido, fallback a slate-200 text-slate-600.
 */
import { MOBILE_UNIT_STATUS_BADGE, type MobileUnitStatusKey } from './constants'

export function MobileUnitStatusBadge({ status }: { status: string }) {
  const meta = MOBILE_UNIT_STATUS_BADGE[status as MobileUnitStatusKey] ?? {
    label: status,
    classes: 'bg-slate-200 text-slate-600',
  }
  return (
    <span
      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${meta.classes}`}
    >
      {meta.label}
    </span>
  )
}