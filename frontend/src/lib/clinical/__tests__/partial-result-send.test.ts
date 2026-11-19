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

  it('habilita envío parcial si Examen Médico está RESULT_REGISTERED o COMPLETED aunque falte examen_capture_closed', () => {
    const examResultRegistered = {
      id: 'em-1',
      status: 'RESULT_REGISTERED' as const,
      testNameSnapshot: 'Examen Médico General',
      test: { categoryId: 'em', category: { name: 'Medicina Laboral' } },
      interpretation: null,
      hasValidatedPdf: false,
    }
    const r = evaluatePartialSendEligibility({
      eventTests: [examResultRegistered, labTest],
      examPhysicalExamData: {},
    })
    expect(r.eligible).toBe(true)

    const examCompleted = { ...examResultRegistered, status: 'COMPLETED' as const }
    expect(
      evaluatePartialSendEligibility({
        eventTests: [examCompleted, labTest],
        examPhysicalExamData: null,
      }).eligible,
    ).toBe(true)
  })

  it('bloquea envío parcial si Examen Médico sigue IN_PROGRESS sin examen_capture_closed', () => {
    const examInProgress = {
      id: 'em-1',
      status: 'IN_PROGRESS' as const,
      testNameSnapshot: 'Examen Médico General',
      test: { categoryId: 'em', category: { name: 'Medicina Laboral' } },
      interpretation: null,
      hasValidatedPdf: false,
    }
    const r = evaluatePartialSendEligibility({
      eventTests: [examInProgress, labTest],
      examPhysicalExamData: {},
    })
    expect(r.eligible).toBe(false)
  })
})
