import {
  evaluatePartialSendEligibility,
  isLaboratoryEventTest,
  listSendableLabTestsForPartial,
} from '../partial-result-send'

describe('partial-result-send', () => {
  const labTest = {
    id: 'lab-1',
    status: 'RESULT_REGISTERED' as const,
    testNameSnapshot: 'Biometría hemática',
    fileUrl: '/uploads/lab.pdf',
    test: { categoryId: '64d3f863-e293-4e81-88a9-a977ae48d67c', category: { name: 'Laboratorio' } },
    interpretation: null,
    hasValidatedPdf: false,
  }

  const audioTest = {
    id: 'aud-1',
    status: 'RESULT_REGISTERED' as const,
    testNameSnapshot: 'Audiometría',
    test: { categoryId: 'x', category: { name: 'Audiometría' } },
    interpretation: { doctorStatus: 'REVIEWED_ACCEPTED', clinicalState: 'REVIEWED_ACCEPTED' },
    hasValidatedPdf: true,
  }

  it('detecta laboratorio por categoría', () => {
    expect(isLaboratoryEventTest(labTest)).toBe(true)
    expect(isLaboratoryEventTest(audioTest)).toBe(false)
  })

  it('rechaza sin laboratorio en batería', () => {
    const r = evaluatePartialSendEligibility({
      eventTests: [audioTest],
      examPhysicalExamData: { examen_capture_closed: true },
    })
    expect(r.eligible).toBe(false)
  })

  it('acepta cuando no-lab cerrado y hay lab enviable', () => {
    const r = evaluatePartialSendEligibility({
      eventTests: [audioTest, labTest],
      examPhysicalExamData: {},
    })
    expect(r.eligible).toBe(true)
    expect(listSendableLabTestsForPartial({ eventTests: [audioTest, labTest] })).toHaveLength(1)
  })
})
