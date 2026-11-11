/**
 * Normaliza snapshots de Audiometría (payload plano o anidado) al shape canónico
 * con `oido_*.va` / `pta_visible`. Misma lógica que el renderer clínico.
 *
 * @see context/SPECs/SPEC_ARCH-20260519-02-REALINEACION-RENDERER-AUDIOMETRIA-PAYLOAD-REAL.md
 * @see context/SPECs/SPEC_ARCH-20260519-04-ESTABILIZACION-FINAL-AUDIOMETRIA.md
 */
export function normalizeAudiometriaSnapshot(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...data }

  for (const earKey of ['oido_derecho', 'oido_izquierdo'] as const) {
    const ear = normalized[earKey]
    if (ear && typeof ear === 'object' && !Array.isArray(ear)) {
      const earObj = ear as Record<string, unknown>
      const earNorm: Record<string, unknown> = { ...earObj }
      if (!('va' in earNorm) && 'via_aerea' in earNorm) {
        earNorm.va = earNorm.via_aerea
      }
      if (!('vo' in earNorm) && 'via_osea' in earNorm) {
        earNorm.vo = earNorm.via_osea
      }
      if (!('va' in earNorm) || typeof earNorm.va !== 'object' || earNorm.va === null) {
        const directFreqs: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(earObj)) {
          if (/^\d+$/.test(k.trim()) && v !== null && v !== undefined && typeof v !== 'object') {
            directFreqs[k.trim()] = v
          }
        }
        if (Object.keys(directFreqs).length > 0) {
          earNorm.va = directFreqs
        }
      }
      if (!('pta_visible' in earNorm) && 'pta' in earNorm) {
        earNorm.pta_visible = earNorm.pta
      }
      normalized[earKey] = earNorm
    }
  }

  return normalized
}
