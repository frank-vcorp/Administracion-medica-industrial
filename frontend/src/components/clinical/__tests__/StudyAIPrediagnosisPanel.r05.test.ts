import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StudyAIPrediagnosisPanel, { resolveDoctorReviewStatus } from '../StudyAIPrediagnosisPanel'

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

  it('renderiza enlace PDF de Campimetría en SSR y acepta onReviewed opcional', () => {
    const review = {
      id: '710fb923-4385-4bcd-9671-e5409f707dd2',
      doctorStatus: 'REVIEWED_ACCEPTED',
      doctorDiagnosis: 'Campimetría normal',
      doctorNotes: null,
      doctorRecommendations: null,
      createdAt: new Date('2026-11-26T05:52:07.986Z'),
      pdfGenerated: true,
      pdfErrorMessage: null,
    }
    const html = renderToStaticMarkup(
      createElement(StudyAIPrediagnosisPanel, {
        prediagnosisSnapshotId: '6ab060be-2802-49f7-8130-d3d37ec9b478',
        snapshot: {
          id: '6ab060be-2802-49f7-8130-d3d37ec9b478',
          version: 1,
          clinicalState: 'REVIEWED_ACCEPTED',
          createdAt: new Date('2026-11-26T05:51:30.894Z'),
          isSuperseded: false,
          prediagnosisData: {
            summary: 'Campimetría normal',
            confidence: 0.9,
            clinical_state: 'REVIEWED_ACCEPTED',
          },
          doctorReviews: [review],
        },
        reviewerUserId: 'doc-1',
        eventId: 'evt-1',
        existingReview: review,
        studyType: 'Campimetria',
        onReviewed: vi.fn(),
      }),
    )

    expect(html).toContain('/api/pdf/campimetria/710fb923-4385-4bcd-9671-e5409f707dd2')
    expect(html).toContain('Descargar PDF validado')
  })
})
