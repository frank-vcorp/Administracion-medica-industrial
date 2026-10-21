import type { SodexoEstilosVidaSodexo } from '@/lib/sodexo-estilos-vida-catalog'

function u(v: unknown): string {
  return String(v ?? '').trim().toUpperCase()
}

function isSi(v: unknown): boolean {
  const x = u(v)
  return x === 'SI' || (x.length > 0 && x !== 'NEGADO' && x !== 'NO APLICA' && x !== 'NO')
}

export function prefillEstilosVidaSodexoFromApnp(
  noPatologicos: Record<string, unknown> | null | undefined,
): SodexoEstilosVidaSodexo {
  const np = noPatologicos ?? {}
  const out: SodexoEstilosVidaSodexo = {}

  const tab = u(np.tabaco)
  if (tab === 'NEGADO' || tab === 'NO') out.tabaco_opcion = 'NO'
  else if (isSi(np.tabaco)) {
    const freq = u(np.tabaco_frecuencia)
    if (freq.includes('EVENT') || freq.includes('<5')) out.tabaco_opcion = 'EVENTUAL'
    else if (freq.includes('HABIT') || freq.includes('6')) out.tabaco_opcion = 'HABITUAL'
    else if (freq.includes('COMPUL') || freq.includes('11')) out.tabaco_opcion = 'COMPULSIVO'
    else out.tabaco_opcion = 'SI'
  }
  if (u(np.tabaco_suspendido) === 'SI') {
    out.tabaco_exfumador = true
    const t = u(np.tabaco_tiempo_suspendido)
    if (t.includes('<1') || t.includes('MENOS')) out.tabaco_dejo_hace = 'MENOS_1'
    else if (t.includes('6')) out.tabaco_dejo_hace = '6_10'
    else if (t.includes('>10') || t.includes('MAS')) out.tabaco_dejo_hace = 'MAS_10'
    else if (t) out.tabaco_dejo_hace = '1_5'
  }

  const alc = u(np.alcohol)
  if (alc === 'NEGADO' || alc === 'NO') out.alcohol = 'NO'
  else if (isSi(np.alcohol)) {
    out.alcohol = 'SI'
    const f = String(np.alcohol_frecuencia ?? '').trim()
    out.alcohol_ocasional = f || 'OCASIONAL'
  }

  const drog = u(np.drogas_estimulantes)
  if (drog === 'NEGADO' || drog === 'NO') out.drogas = 'NO'
  else if (isSi(np.drogas_estimulantes)) {
    out.drogas = 'SI'
    out.drogas_tipo = String(np.drogas_especifique ?? '').trim()
  }

  return out
}
