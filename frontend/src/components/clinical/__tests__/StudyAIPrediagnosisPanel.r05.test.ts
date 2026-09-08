import { describe, expect, it } from 'vitest'
import { resolveDoctorReviewStatus } from '../StudyAIPrediagnosisPanel'

describe('StudyAIPrediagnosisPanel R-05 — resolveDoctorReviewStatus', () => {
  const suggested = 'Función pulmonar normal; FVC 94%; FEV1/FVC 0.81'

  it('marca REVIEWED_ACCEPTED si el texto coincide con el hallazgo sugerido', () => {
    expect(resolveDoctorReviewStatus(suggested, suggested)).toBe('REVIEWED_ACCEPTED')
    expect(resolveDoctorReviewStatus(`  ${suggested}  `, suggested)).toBe('REVIEWED_ACCEPTED')
  })

  it('marca REVIEWED_EDITED si el médico modifica el texto', () => {
    expect(
      resolveDoctorReviewStatus(suggested, 'Patrón obstructivo leve.'),
    ).toBe('REVIEWED_EDITED')
  })
})
