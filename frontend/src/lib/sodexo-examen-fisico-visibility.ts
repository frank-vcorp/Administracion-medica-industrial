import type { SodexoEfCatalogEntry } from '@/lib/sodexo-examen-fisico-types'
import { isSodexoFemalePatient, isSodexoMalePatient } from '@/lib/sodexo-ami-mirror'

/** ¿Mostrar fila del catálogo §9 según sexo en Módulo 1 / antecedentes? */
export function sodexoEfEntryVisibleForSex(
  entry: SodexoEfCatalogEntry,
  sexo: string | undefined | null,
): boolean {
  const scope = entry.sexScope ?? 'all'
  if (scope === 'all') return true
  if (scope === 'female') return isSodexoFemalePatient(sexo)
  if (scope === 'male') return isSodexoMalePatient(sexo)
  return true
}
