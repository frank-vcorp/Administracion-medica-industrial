import { SODEXO_EXAMEN_FISICO_CATALOG } from '@/lib/sodexo-examen-fisico-catalog'
import type { SodexoEfRowValue } from '@/lib/sodexo-examen-fisico-types'
import { amiExploracionValue } from '@/lib/sodexo-ami-mirror'

export type SodexoExamenFisicoExtensionMap = Record<string, SodexoEfRowValue>

function inferResultado(text: string): SodexoEfRowValue | null {
  const t = text.trim()
  if (!t) return null
  const u = t.toUpperCase()
  const anormal =
    u.includes('ANORMAL') ||
    u.includes('ALTER') ||
    u.includes('PATOL') ||
    u.includes('DOLOR') ||
    u.includes('MASA')
  if (anormal) return { resultado: 'ANORMAL', desc: t }
  if (u.includes('NORMAL') || u.includes('ÍNTEGRO') || u.includes('INTEGRO')) {
    return { resultado: 'NORMAL', desc: t }
  }
  return { desc: t }
}

/** Sugiere captura §9 desde exploración AMI cuando la extensión está vacía. */
export function prefillExamenFisicoSodexoFromAmi(
  examForm: Record<string, string>,
): SodexoExamenFisicoExtensionMap {
  const out: SodexoExamenFisicoExtensionMap = {}
  for (const entry of SODEXO_EXAMEN_FISICO_CATALOG) {
    if (!entry.amiKey) continue
    const raw = amiExploracionValue(examForm, entry.amiKey)
    if (!raw) continue
    if (entry.kind === 'texto') {
      out[entry.key] = { desc: raw }
      continue
    }
    const inferred = inferResultado(raw)
    if (inferred) out[entry.key] = inferred
  }
  return out
}
