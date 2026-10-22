/**
 * §9.5 Arcos de movimiento — rejilla movimiento × articulación × (D|I).
 * Celdas no aplicables en el impreso no se capturan (UI muestra «—»).
 */

export type SodexoArcosLimb = 'ms' | 'mi'
export type SodexoArcosSide = 'D' | 'I'

export type SodexoArcosMovement = { id: string; label: string }
export type SodexoArcosJoint = { id: string; label: string; short: string }

export type SodexoArcosLimbDef = {
  limb: SodexoArcosLimb
  title: string
  movements: SodexoArcosMovement[]
  joints: SodexoArcosJoint[]
  /** true si el movimiento aplica a la articulación (ambos lados). */
  applies: (movementId: string, jointId: string) => boolean
}

export function sodexoArcosCellKey(
  limb: SodexoArcosLimb,
  movementId: string,
  jointId: string,
  side: SodexoArcosSide,
): string {
  return `${limb}:${movementId}:${jointId}:${side}`
}

export function sodexoArcosCellApplicable(
  def: SodexoArcosLimbDef,
  movementId: string,
  jointId: string,
): boolean {
  return def.applies(movementId, jointId)
}

const MS_JOINTS: SodexoArcosJoint[] = [
  { id: 'hombro', label: 'Hombro', short: 'Homb.' },
  { id: 'codo', label: 'Codo', short: 'Codo' },
  { id: 'muneca', label: 'Muñeca', short: 'Muñec.' },
  { id: 'dedos', label: 'Dedos', short: 'Dedos' },
]

const MS_MOVEMENTS: SodexoArcosMovement[] = [
  { id: 'flexion', label: 'Flexión' },
  { id: 'extension', label: 'Extensión' },
  { id: 'abduccion', label: 'Abducción' },
  { id: 'aduccion', label: 'Aducción' },
  { id: 'rot_interna', label: 'Rot. interna' },
  { id: 'rot_externa', label: 'Rot. externa' },
  { id: 'pronacion', label: 'Pronación' },
  { id: 'supinacion', label: 'Supinación' },
  { id: 'desv_ulnar', label: 'Desv. ulnar' },
  { id: 'desv_radial', label: 'Desv. radial' },
  { id: 'oponencia', label: 'Oponencia' },
]

function msApplies(mov: string, joint: string): boolean {
  const all = new Set(['hombro', 'codo', 'muneca', 'dedos'])
  const hombroDedos = new Set(['hombro', 'dedos'])
  const codoMuneca = new Set(['codo', 'muneca'])
  if (mov === 'flexion' || mov === 'extension') return all.has(joint)
  if (mov === 'abduccion' || mov === 'aduccion') return hombroDedos.has(joint)
  if (mov === 'rot_interna' || mov === 'rot_externa') return joint === 'hombro'
  if (mov === 'pronacion' || mov === 'supinacion') return codoMuneca.has(joint)
  if (mov === 'desv_ulnar' || mov === 'desv_radial') return joint === 'muneca'
  if (mov === 'oponencia') return joint === 'dedos'
  return false
}

const MI_JOINTS: SodexoArcosJoint[] = [
  { id: 'cadera', label: 'Cadera', short: 'Cader.' },
  { id: 'rodilla', label: 'Rodilla', short: 'Rodill.' },
  { id: 'tobillo', label: 'Tobillo / pie', short: 'Cll pie' },
  { id: 'dedos', label: 'Dedos', short: 'Dedos' },
]

const MI_MOVEMENTS: SodexoArcosMovement[] = [
  { id: 'flexion', label: 'Flexión' },
  { id: 'extension', label: 'Extensión' },
  { id: 'abduccion', label: 'Abducción' },
  { id: 'aduccion', label: 'Aducción' },
  { id: 'rot_interna', label: 'Rot. interna' },
  { id: 'rot_externa', label: 'Rot. externa' },
  { id: 'inversion', label: 'Inversión' },
  { id: 'eversion', label: 'Eversión' },
]

function miApplies(mov: string, joint: string): boolean {
  if (joint === 'cadera') {
    return mov !== 'inversion' && mov !== 'eversion'
  }
  if (joint === 'rodilla') {
    return mov === 'flexion' || mov === 'extension'
  }
  if (joint === 'tobillo') {
    return (
      mov === 'flexion' ||
      mov === 'extension' ||
      mov === 'inversion' ||
      mov === 'eversion'
    )
  }
  if (joint === 'dedos') {
    return mov === 'flexion' || mov === 'extension'
  }
  return false
}

export const SODEXO_ARCOS_MS: SodexoArcosLimbDef = {
  limb: 'ms',
  title: 'Arcos de movimiento (anormalidad)',
  movements: MS_MOVEMENTS,
  joints: MS_JOINTS,
  applies: msApplies,
}

export const SODEXO_ARCOS_MI: SodexoArcosLimbDef = {
  limb: 'mi',
  title: 'Arcos de movimiento (anormalidad)',
  movements: MI_MOVEMENTS,
  joints: MI_JOINTS,
  applies: miApplies,
}

export const SODEXO_ARCOS_LIMBS = [SODEXO_ARCOS_MS, SODEXO_ARCOS_MI] as const

export type SodexoArcosCellValue = { anormal?: boolean | null }

export function sodexoArcosMapIsEmpty(
  map: Record<string, SodexoArcosCellValue> | null | undefined,
): boolean {
  if (!map) return true
  return !Object.values(map).some((c) => c?.anormal === true)
}
