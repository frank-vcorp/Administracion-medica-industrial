import { describe, it, expect, vi } from 'vitest'

const mockFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  default: {
    medicalEvent: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      findMany: vi.fn(),
    },
    eventTest: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@/lib/event-atencion', () => ({
  findSiblingEventsInAtencion: vi.fn().mockResolvedValue({
    eventIds: ['evt-current'],
    appointmentId: null,
    hasAppointment: false,
    workerId: 'worker-1',
  }),
}))

describe('debug', () => {
  it('returns expected', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'evt-current',
      worker: { firstName: 'a', lastName: 'b', universalId: 'u' },
      branch: { name: 'b' },
      exam: { physicalExamData: {}, eyeAcuityData: {}, somatometryData: {}, vitalSignsData: {} },
      verdict: {
        id: 'verdict-1',
        finalDiagnosis: 'Apto',
        recommendations: null,
        signedAt: new Date(),
        signatureHash: null,
        pdfUrl: 'dictamen.pdf',
        validator: { id: 'u1', fullName: 'Dr. V', professionalLicense: 'CED', signatureImageUrl: null },
      },
      studies: [{ serviceName: 'A', extractedData: null }],
      labs: [],
    })
    const { buildDictamenGeneralAmiConsolidado } = await import('@/lib/dictamen-general-ami')
    const r = await buildDictamenGeneralAmiConsolidado('evt-current', {
      medicalEvent: { findUnique: mockFindUnique, findMany: vi.fn() },
      eventTest: { findMany: vi.fn().mockResolvedValue([]) },
    } as never)
    console.log('atencionResolution:', JSON.stringify(r.atencionResolution))
    console.log('consolidatedEvents:', JSON.stringify(r.data.consolidatedEvents))
    expect(r.atencionResolution.eventIds).toEqual(['evt-current'])
  })
})
