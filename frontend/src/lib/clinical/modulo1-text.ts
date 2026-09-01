/**
 * Texto consolidado de Módulo 1 para PDF / dictamen (gineco, reproductivos M, vacunas).
 */

export function modulo1FromPhysicalExam(
  ped: Record<string, unknown>,
): Record<string, unknown> {
  const nested = ped.modulo1
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>
  }
  return ped
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function joinFields(
  m1: Record<string, unknown>,
  fields: readonly (readonly [string, unknown])[],
): string | null {
  const lines: string[] = []
  for (const [label, val] of fields) {
    const v = str(val)
    if (v) lines.push(`${label}: ${v}`)
  }
  return lines.length > 0 ? lines.join(' · ') : null
}

/** Historia gineco-obstétrica (Módulo 1 — sexo femenino). */
export function buildHistoriaGinecoText(m1: Record<string, unknown>): string | null {
  return joinFields(m1, [
    ['Menarca', m1.m1_gine_menarca],
    ['FUM', m1.m1_gine_fum],
    ['IVS', m1.m1_gine_ivs],
    ['Ritmo', m1.m1_gine_ritmo],
    ['Gesta', m1.m1_gine_gesta],
    ['Aborto', m1.m1_gine_aborto],
    ['Parto', m1.m1_gine_parto],
    ['Cesárea', m1.m1_gine_cesarea],
    ['DOC', m1.m1_gine_doc],
    ['FUP/FUC', m1.m1_gine_fup_uc],
    ['Exp. mamaria', m1.m1_gine_exp_mamaria],
    ['MPF', m1.m1_gine_mpf],
    ['VSA', m1.m1_gine_vsa],
  ] as const)
}

/** Antecedentes reproductivos masculinos (ZIN — D.O.C. próstata / salud prostática). */
export function buildHistoriaReproductivaMasculinaText(
  m1: Record<string, unknown>,
): string | null {
  const docProstata = str(m1.m1_repro_doc_prostata) || str(m1.doc_prostata)
  return joinFields(m1, [
    ['I.V.S', m1.m1_repro_ivs],
    ['V.S.A', m1.m1_repro_vsa],
    ['D.O.C. próstata', docProstata],
    ['M.P.F', m1.m1_repro_mpf],
  ] as const)
}

/** Gineco u hombre según lo capturado en Módulo 1. */
export function buildHistoriaReproductivaModulo1Text(
  ped: Record<string, unknown>,
): string | null {
  const m1 = modulo1FromPhysicalExam(ped)
  return buildHistoriaGinecoText(m1) ?? buildHistoriaReproductivaMasculinaText(m1)
}

/** Inmunizaciones reportadas (Módulo 1). */
export function buildInmunizacionesModulo1Text(m1: Record<string, unknown>): string | null {
  const fields = [
    ['Rubéola', m1.m1_vac_rubeola],
    ['Neumococo', m1.m1_vac_neumococo],
    ['Sarampión', m1.m1_vac_sarampion],
    ['Influenza', m1.m1_vac_influenza],
    ['Toxoide tetánico', m1.m1_vac_toxoide],
    ['Hepatitis B', m1.m1_vac_hepatitisb],
    ['Otras', m1.m1_vac_otras],
  ] as const
  const lines: string[] = []
  for (const [label, val] of fields) {
    const v = str(val)
    if (v && v !== 'NEGADO' && v !== 'NO APLICA') lines.push(`${label}: ${v}`)
  }
  return lines.length > 0 ? lines.join(' · ') : null
}

export function buildInmunizacionesFromPhysicalExam(
  ped: Record<string, unknown>,
): string | null {
  return buildInmunizacionesModulo1Text(modulo1FromPhysicalExam(ped))
}
