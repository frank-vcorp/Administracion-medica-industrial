import { describe, expect, it } from 'vitest'
import { resolvePracticalRecommendation } from '@/lib/clinical/practical-recommendations-predx'

describe('resolvePracticalRecommendation R-06', () => {
  it('prioriza practical_recommendation del snapshot', () => {
    expect(
      resolvePracticalRecommendation(
        { practical_recommendation: 'TEXTO IA PRÁCTICO' },
        'Espirometria',
      ),
    ).toBe('TEXTO IA PRÁCTICO')
  })

  it('fallback espirometría normal para snapshots legacy', () => {
    expect(
      resolvePracticalRecommendation(
        {
          summary: 'Función pulmonar normal; FVC 94%; FEV1/FVC 0.81',
          clinical_state: 'AI_PENDING_REVIEW',
        },
        'Espirometria',
      ),
    ).toBe('USO ADECUADO DE EQUIPO DE PROTECCIÓN ESPIROMETRÍAS DE SEGUIMIENTO ANUAL')
  })

  it('fallback audiometría normal para snapshots legacy', () => {
    expect(
      resolvePracticalRecommendation(
        {
          summary: 'Audición bilateral dentro de límites normales',
          clinical_state: 'AI_PENDING_REVIEW',
        },
        'Audiometria',
      ),
    ).toBe('AUDIOMETRÍA DE SEGUIMIENTO ANUAL')
  })
})
