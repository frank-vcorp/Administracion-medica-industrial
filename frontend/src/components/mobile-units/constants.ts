/**
 * @file Constantes y tipos compartidos del módulo de Unidades Móviles.
 * @id IMPL-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 *
 * Centraliza etiquetas y colores de status para evitar duplicación entre
 * MobileUnitManager (catálogo) y MobileUnitOperationsPanel (dashboard).
 */
export const MOBILE_UNIT_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVA: { label: 'Activa', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  REPARACION: { label: 'Reparación', color: 'bg-red-100 text-red-800 border-red-300' },
  FUERA_SERVICIO: { label: 'Fuera de servicio', color: 'bg-slate-200 text-slate-700 border-slate-300' },
  BAJA_PERMANENTE: { label: 'Baja permanente', color: 'bg-zinc-300 text-zinc-700 border-zinc-400' },
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