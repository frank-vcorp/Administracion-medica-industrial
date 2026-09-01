/**
 * Sección inferior AMI del PDF de espirometría (post-gráficas).
 */
import {
  resolveCriteria,
  type ResolvedCriteria,
} from '@/components/clinical/EspirometriaClinicalCriteriaPanel'

export type EspirometryAmiSectionData = {
  repetibilidadFvcMl: number | null
  repetibilidadFev1Ml: number | null
  repetibilidadFvcMenor200: string | null
  repetibilidadFev1Menor200: string | null
  picoMaximo: string | null
  formaTriangular: string | null
  libreArtefactos: string | null
  meseta: string | null
  tiempo: string | null
  pruebasAceptables: number | null
  criteriosParaDx: string | null
  calidad: string | null
}

function formatQualitative(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 'SI' : 'NO'
  const s = String(value).trim()
  if (!s) return null
  const upper = s.toUpperCase()
  if (upper === 'SI' || upper === 'SÍ' || upper === 'YES' || upper === 'TRUE') return 'SI'
  if (upper === 'NO' || upper === 'FALSE') return 'NO'
  return s
}

function formatMl(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null
  return `${value.toFixed(2)} ml`
}

export function buildEspirometryAmiSectionFromExtraction(
  extractionStructuredData: unknown,
): EspirometryAmiSectionData {
  const sd = extractionStructuredData as Record<string, unknown> | null
  const extracted =
    sd && typeof sd.extracted_data === 'object' && !Array.isArray(sd.extracted_data)
      ? (sd.extracted_data as Record<string, unknown>)
      : sd

  const criteria: ResolvedCriteria = resolveCriteria(
    extracted as Record<string, unknown> | null | undefined,
  )

  return {
    repetibilidadFvcMl: criteria.repetibilidadFvcMl,
    repetibilidadFev1Ml: criteria.repetibilidadFev1Ml,
    repetibilidadFvcMenor200: criteria.repetibilidadFvcMenor150,
    repetibilidadFev1Menor200: criteria.repetibilidadFev1Menor150,
    picoMaximo: formatQualitative(criteria.picoMaximo),
    formaTriangular: formatQualitative(criteria.formaTriangular),
    libreArtefactos: formatQualitative(criteria.libreArtefactos),
    meseta: formatQualitative(criteria.meseta),
    tiempo: formatQualitative(criteria.tiempo),
    pruebasAceptables: criteria.pruebasAceptables,
    criteriosParaDx: formatQualitative(criteria.criteriosParaDx),
    calidad: criteria.calidad,
  }
}

export function formatAmiSectionMl(value: number | null): string {
  return formatMl(value) ?? '—'
}
