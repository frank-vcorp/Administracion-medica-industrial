import { parsePatologiaEntry } from '@/lib/sodexo-pdf-patologicos'
import { SODEXO_PATOLOGICOS_CATALOG } from '@/lib/sodexo-patologicos-catalog'

export type SodexoPatologicoExtensionRow = {
  estado?: 'NEGADO' | 'SI' | null
  descripcion?: string | null
}

export function prefillPatologicosSodexoFromAmi(
  patologicos: Record<string, unknown> | null | undefined,
): Record<string, SodexoPatologicoExtensionRow> {
  const record = patologicos ?? {}
  const out: Record<string, SodexoPatologicoExtensionRow> = {}
  for (const row of SODEXO_PATOLOGICOS_CATALOG) {
    if (!row.amiKey) continue
    const p = parsePatologiaEntry(record[row.amiKey])
    if (p.negado && !p.si) out[row.key] = { estado: 'NEGADO', descripcion: '' }
    else if (p.si) out[row.key] = { estado: 'SI', descripcion: p.descripcion }
  }
  return out
}
