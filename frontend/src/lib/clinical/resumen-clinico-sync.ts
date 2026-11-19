/**
 * Sincronización pura entre pestañas origen (Somatometría, Signos Vitales,
 * Agudeza Visual, Exploración Física) y Resumen Clínico por Sistema en
 * Examen Médico. Respeta ediciones manuales del médico cuando existen.
 */

import { computeBmi } from '@/lib/clinical/talla-meters'

export function deriveEstadoNutricionalFromImcValue(imcValue: number): string {
  if (!Number.isFinite(imcValue) || imcValue <= 0) return ''
  if (imcValue < 18.5) return 'BAJO PESO'
  if (imcValue < 25) return 'NORMAL'
  if (imcValue < 30) return 'SOBREPESO'
  if (imcValue < 35) return 'OBESIDAD G1'
  if (imcValue < 40) return 'OBESIDAD G2'
  return 'OBESIDAD G3'
}

export function deriveEstadoNutricionalFromSoma(
  pesoKg: unknown,
  tallaRaw: unknown,
): string {
  const { imcValue } = computeBmi(pesoKg, tallaRaw)
  return deriveEstadoNutricionalFromImcValue(imcValue)
}

export function derivePresionArterialResumenFromVitals(
  sistolica: unknown,
  diastolica: unknown,
): string {
  const sRaw = String(sistolica ?? '').trim()
  const dRaw = String(diastolica ?? '').trim()
  if (!sRaw || !dRaw) return ''
  const sist = Number.parseFloat(sRaw)
  const diast = Number.parseFloat(dRaw)
  if (
    !Number.isFinite(sist) ||
    !Number.isFinite(diast) ||
    sist <= 0 ||
    diast <= 0
  ) {
    return ''
  }
  if (sist >= 140 || diast >= 90) return 'ALTA'
  if (sist <= 90 || diast <= 60) return 'BAJA'
  return 'NORMAL AL MOMENTO DE LA TOMA'
}

/**
 * Determina si `salud_bucal` en Resumen Clínico fue editado manualmente
 * respecto a `boca_estado` de Exploración Física.
 * - Vacío o `'NORMAL'` (default legado fuera de `SALUD_BUCAL_VALUES`) → no es override.
 * - `'SIN DATOS'` cuando `boca_estado` sí tiene hallazgo clínico → stale default, no override.
 * - Igual a `boca_estado` → sincronizado, no override.
 */
export function isSaludBucalManualOverride(
  bocaEstado: string | null | undefined,
  persistedSaludBucal: string | null | undefined,
): boolean {
  const boca = String(bocaEstado ?? '').trim().toUpperCase()
  const salud = String(persistedSaludBucal ?? '').trim().toUpperCase()
  if (!salud || salud === 'NORMAL') return false
  if (salud === boca) return false
  if (salud === 'SIN DATOS' && boca !== '' && boca !== 'SIN DATOS') return false
  return true
}

export function isResumenFieldManualOverride(
  derivedValue: string,
  persistedValue: string | null | undefined,
): boolean {
  const persisted = String(persistedValue ?? '').trim().toUpperCase()
  const derived = derivedValue.trim().toUpperCase()
  if (!persisted) return false
  if (derived && persisted !== derived) return true
  return false
}

export function syncBocaEstadoToSaludBucal(
  form: Record<string, string>,
  nextBocaEstado: string,
  isManualOverride: boolean,
): Record<string, string> {
  const shouldSyncSaludBucal =
    !isManualOverride || !String(form.salud_bucal ?? '').trim()
  return {
    ...form,
    boca_estado: nextBocaEstado,
    ...(shouldSyncSaludBucal ? { salud_bucal: nextBocaEstado } : {}),
  }
}
