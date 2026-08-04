/**
 * @file Constantes y tipos compartidos del módulo de Unidades Móviles.
 * @id IMPL-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 *
 * Centraliza etiquetas y colores de status. Hay dos mapas según contexto:
 *
 * - `MOBILE_UNIT_STATUS_LABEL`: versión "card de métricas" del dashboard
 *   operativo. Usa bordes y colores fuertes para destacar contadores.
 *
 * - `MOBILE_UNIT_STATUS_BADGE`: versión "píldora" usada en cards de catálogo
 *   y página de detalle. Paridad con BranchStatusBadge (text-[10px] uppercase
 *   font-bold rounded-full).
 */
export const MOBILE_UNIT_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVA: { label: 'Activa', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  REPARACION: { label: 'Reparación', color: 'bg-red-100 text-red-800 border-red-300' },
  FUERA_SERVICIO: { label: 'Fuera de servicio', color: 'bg-slate-200 text-slate-700 border-slate-300' },
  BAJA_PERMANENTE: { label: 'Baja permanente', color: 'bg-zinc-300 text-zinc-700 border-zinc-400' },
} as const

export const MOBILE_UNIT_STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  ACTIVA: { label: 'Activa', classes: 'bg-emerald-100 text-emerald-700' },
  MANTENIMIENTO: { label: 'Mantenimiento', classes: 'bg-amber-100 text-amber-700' },
  REPARACION: { label: 'Reparación', classes: 'bg-red-100 text-red-700' },
  FUERA_SERVICIO: { label: 'Fuera de servicio', classes: 'bg-slate-200 text-slate-600' },
  BAJA_PERMANENTE: { label: 'Baja permanente', classes: 'bg-zinc-200 text-zinc-700' },
} as const

export const MOBILE_UNIT_STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVA', label: 'Activa' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'REPARACION', label: 'Reparación' },
  { value: 'FUERA_SERVICIO', label: 'Fuera de servicio' },
  { value: 'BAJA_PERMANENTE', label: 'Baja permanente' },
] as const

export type MobileUnitStatusKey = keyof typeof MOBILE_UNIT_STATUS_LABEL