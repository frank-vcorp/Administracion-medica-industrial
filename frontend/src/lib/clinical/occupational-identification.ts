/**
 * Área de trabajo y tiempo en el puesto — datos personales / antecedentes.
 * Minuta 23-Sep: visibles en identificación (pantalla y PDF), no solo en cuerpo del examen.
 */

export type DatosPersonalesOccupationalSlice = {
  puesto_actual?: string | null
  area_departamento?: string | null
  antiguedad_anios?: number | string | null
  antiguedad_meses?: number | string | null
}

export type ResolvedOccupationalIdentification = {
  position: string | null
  workArea: string | null
  tenureLabel: string | null
}

function cleanStr(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const t = String(value).trim()
  return t.length > 0 ? t : null
}

function readNonNegativeInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10)
  if (!Number.isFinite(n) || n < 0 || n > 80) return null
  return Math.floor(n)
}

/** Lee `datos_personales` desde snapshot de examen, prefill o historial maestro. */
export function datosPersonalesFromContainer(
  record: Record<string, unknown> | null | undefined,
): DatosPersonalesOccupationalSlice | null {
  if (!record) return null
  const captured = record.antecedentes_captured as Record<string, unknown> | undefined
  const dp =
    (record.datos_personales as Record<string, unknown> | undefined) ??
    (captured?.datos_personales as Record<string, unknown> | undefined)
  if (!dp || typeof dp !== 'object') return null
  return dp as DatosPersonalesOccupationalSlice
}

/** Primer valor no vacío por campo, en orden de prioridad (cita → prefill → maestro). */
export function resolveOccupationalIdentification(
  sources: Array<Record<string, unknown> | null | undefined>,
): ResolvedOccupationalIdentification {
  const slices = sources
    .map(datosPersonalesFromContainer)
    .filter((s): s is DatosPersonalesOccupationalSlice => s != null)

  const pick = (field: keyof DatosPersonalesOccupationalSlice): string | null => {
    for (const s of slices) {
      const v = cleanStr(s[field])
      if (v) return v
    }
    return null
  }

  const pickInt = (field: 'antiguedad_anios' | 'antiguedad_meses'): number | null => {
    for (const s of slices) {
      const v = readNonNegativeInt(s[field])
      if (v != null) return v
    }
    return null
  }

  const anios = pickInt('antiguedad_anios')
  const meses = pickInt('antiguedad_meses')

  return {
    position: pick('puesto_actual'),
    workArea: pick('area_departamento'),
    tenureLabel: formatTenureInAreaLabel(anios, meses),
  }
}

/** Ej. `3 años 6 meses` (tiempo en el área / puesto actual). */
export function formatTenureInAreaLabel(
  anios: number | null | undefined,
  meses: number | null | undefined,
): string | null {
  const parts: string[] = []
  if (anios != null && anios > 0) {
    parts.push(`${anios} ${anios === 1 ? 'año' : 'años'}`)
  }
  if (meses != null && meses > 0) {
    parts.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`)
  }
  if (parts.length === 0) {
    if (anios === 0 && meses === 0) return null
    if (anios === 0 && meses != null) return formatTenureInAreaLabel(null, meses)
    if (meses === 0 && anios != null) return formatTenureInAreaLabel(anios, null)
    return null
  }
  return parts.join(' ')
}

export function formatOccupationalIdentificationLine(
  resolved: ResolvedOccupationalIdentification,
): string | null {
  const { workArea, tenureLabel } = resolved
  if (!workArea && !tenureLabel) return null
  if (workArea && tenureLabel) return `Área: ${workArea} · ${tenureLabel} en el área`
  if (workArea) return `Área: ${workArea}`
  return `${tenureLabel} en el área`
}
