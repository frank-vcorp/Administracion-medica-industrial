import {
  SODEXO_INMUNIZACIONES_CATALOG,
  type SodexoInmunizacionFila,
  type SodexoInmunizacionesSodexo,
} from '@/lib/sodexo-inmunizaciones-catalog'
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'

function vacSi(raw: unknown): boolean {
  const u = String(raw ?? '').trim().toUpperCase()
  return u === 'SI' || (u.length > 0 && u !== 'NEGADO' && u !== 'NO APLICA')
}

function vacNegado(raw: unknown): boolean {
  const u = String(raw ?? '').trim().toUpperCase()
  return u === 'NEGADO' || u === 'NO APLICA'
}

function amiToFila(raw: unknown): SodexoInmunizacionFila | null {
  if (vacNegado(raw)) return { estado: 'NEGADO' }
  if (vacSi(raw)) {
    const detalle = typeof raw === 'string' ? raw.trim() : 'SI'
    return { estado: 'SI', fecha: detalle !== 'SI' ? detalle : '' }
  }
  return null
}

/** Prellenado desde Módulo 1 (AMI). */
export function prefillInmunizacionesSodexoFromModulo1(
  modulo1: Record<string, unknown> | null | undefined,
): SodexoInmunizacionesSodexo {
  const m1 = modulo1 ?? {}
  const filas: Partial<Record<string, SodexoInmunizacionFila>> = {}
  for (const row of SODEXO_INMUNIZACIONES_CATALOG) {
    if (!row.amiKey) continue
    const f = amiToFila(m1[row.amiKey])
    if (f) filas[row.key] = f
  }
  return { filas, observaciones: '' }
}

/** Migra `inmunizaciones_complementarias` legacy → rejilla §6. */
export function mergeLegacyInmunComplementarias(
  base: SodexoInmunizacionesSodexo,
  legacy: SodexoExtensionData['inmunizaciones_complementarias'],
): SodexoInmunizacionesSodexo {
  if (!legacy) return base
  const filas = { ...(base.filas ?? {}) }
  const mapLegacy = (
    key: 'covid_19' | 'hepatitis_ab',
    src: 'covid' | 'hepatitis_ab',
  ) => {
    const row = legacy[src]
    if (!row?.estado) return
    filas[key] = {
      estado: row.estado,
      fecha: row.fecha ?? '',
      imss: row.imss ?? '',
      ssa: row.ssa ?? '',
      otros: row.observaciones ?? '',
    }
  }
  mapLegacy('covid_19', 'covid')
  mapLegacy('hepatitis_ab', 'hepatitis_ab')
  if (legacy.otras?.estado) {
    filas.neumococica = {
      estado: legacy.otras.estado,
      otros: legacy.otras.observaciones ?? '',
    }
  }
  const observaciones = [base.observaciones, legacy.otras?.observaciones].filter(Boolean).join('\n')
  return { filas, observaciones }
}
