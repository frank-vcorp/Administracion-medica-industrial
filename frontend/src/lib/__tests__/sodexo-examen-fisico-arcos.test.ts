import { describe, it, expect } from 'vitest'
import {
  SODEXO_ARCOS_MS,
  SODEXO_ARCOS_MI,
  sodexoArcosCellApplicable,
  sodexoArcosCellKey,
} from '@/lib/sodexo-examen-fisico-arcos'

describe('sodexo-examen-fisico-arcos', () => {
  it('MS — flexión aplica a las 4 articulaciones', () => {
    for (const j of SODEXO_ARCOS_MS.joints) {
      expect(sodexoArcosCellApplicable(SODEXO_ARCOS_MS, 'flexion', j.id)).toBe(true)
    }
  })

  it('MS — oponencia solo dedos', () => {
    expect(sodexoArcosCellApplicable(SODEXO_ARCOS_MS, 'oponencia', 'dedos')).toBe(true)
    expect(sodexoArcosCellApplicable(SODEXO_ARCOS_MS, 'oponencia', 'hombro')).toBe(false)
  })

  it('MI — rodilla solo flexión/extensión', () => {
    expect(sodexoArcosCellApplicable(SODEXO_ARCOS_MI, 'flexion', 'rodilla')).toBe(true)
    expect(sodexoArcosCellApplicable(SODEXO_ARCOS_MI, 'abduccion', 'rodilla')).toBe(false)
  })

  it('claves estables', () => {
    expect(sodexoArcosCellKey('ms', 'flexion', 'hombro', 'D')).toBe('ms:flexion:hombro:D')
  })
})
