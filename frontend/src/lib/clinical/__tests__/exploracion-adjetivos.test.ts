import { describe, expect, it } from 'vitest'
import {
  buildDefaultOrganosAdjetivosState,
  buildExploracionNarrativaDesdeAdjetivos,
} from '@/lib/clinical/exploracion-adjetivos'

describe('exploracion-adjetivos', () => {
  it('genera texto narrativo estándar con el estado por defecto', () => {
    const state = buildDefaultOrganosAdjetivosState()
    const narrative = buildExploracionNarrativaDesdeAdjetivos(state)
    expect(narrative).toContain('Se encuentra paciente consciente, orientado')
    expect(narrative).toContain('Cráneo normocéfalo')
    expect(narrative).toContain('pupilas isocóricas')
    expect(narrative).toContain('cavidad oral')
    expect(narrative).toContain('tórax mesomórfico')
    expect(narrative).toContain('abdomen globoso')
    expect(narrative).toContain('Romberg negativa')
  })

  it('incorpora adjetivo anormal de ojos y boca', () => {
    const state = buildDefaultOrganosAdjetivosState()
    state.ojos = { selectedIds: ['pterigion'], notaLibre: '' }
    state.boca = { selectedIds: ['caries'], notaLibre: 'molar inferior' }
    const narrative = buildExploracionNarrativaDesdeAdjetivos(state)
    expect(narrative).toContain('pterigión')
    expect(narrative).toContain('caries dental')
    expect(narrative).toContain('molar inferior')
  })

  it('integra tatuajes desde antecedentes no patológicos', () => {
    const state = buildDefaultOrganosAdjetivosState()
    const antecedentes = {
      no_patologicos: {
        tatuajes: 'SI',
        tatuajes_especifique: 'brazo derecho y espalda',
      },
    }
    const narrative = buildExploracionNarrativaDesdeAdjetivos(state, antecedentes)
    expect(narrative).toContain('brazo derecho y espalda')
  })
})
