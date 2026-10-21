import { modulo1FromPhysicalExam } from '@/lib/clinical/modulo1-text'
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'

export type GinecoObstetricaSodexo = NonNullable<SodexoExtensionData['gineco_sodexo']>

function s(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

export function ginecoObstetricaSodexoIsEmpty(
  g: SodexoExtensionData['gineco_sodexo'] | null | undefined,
): boolean {
  if (!g) return true
  const keys = [
    'ciclos',
    'fum',
    'gesta',
    'parto',
    'cesarea',
    'aborto',
    'vivos',
    'fup',
    'metodo_planificacion',
    'ultima_citologia',
  ] as const
  if (keys.some((k) => s(g[k]))) return false
  if (g.dismenorrea === 'NO' || g.dismenorrea === 'SI' || g.dismenorrea === 'INCAPACITANTE') return false
  if (g.dismenorrea === 'NEGADO' || g.dismenorrea === 'SI') return false
  if (g.dismenorrea_incapacitante) return false
  if (g.toxicos_medicamentos && Object.keys(g.toxicos_medicamentos).length > 0) return false
  return true
}

export function prefillGinecoSodexoFromModulo1(
  modulo1: Record<string, unknown> | null | undefined,
): GinecoObstetricaSodexo {
  const m1 = modulo1 ? modulo1FromPhysicalExam(modulo1) : {}
  const ritmo = s(m1.m1_gine_ritmo)
  const menarca = s(m1.m1_gine_menarca)
  const ciclos = ritmo || (menarca ? `${menarca}` : '')

  return {
    ciclos,
    fum: s(m1.m1_gine_fum),
    gesta: s(m1.m1_gine_gesta),
    parto: s(m1.m1_gine_parto),
    cesarea: s(m1.m1_gine_cesarea),
    aborto: s(m1.m1_gine_aborto),
    vivos: s(m1.m1_gine_doc),
    fup: s(m1.m1_gine_fup_uc),
    metodo_planificacion: s(m1.m1_gine_mpf),
    ultima_citologia: s(m1.m1_gine_exp_mamaria) || s(m1.m1_gine_fup_uc),
    dismenorrea: null,
    dismenorrea_incapacitante: false,
    toxicos_medicamentos: null,
  }
}
