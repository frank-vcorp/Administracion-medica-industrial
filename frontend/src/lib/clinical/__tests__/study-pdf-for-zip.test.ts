import { describe, expect, it } from 'vitest'
import { resolveEventTestPdfForZip } from '../study-pdf-for-zip'

describe('resolveEventTestPdfForZip', () => {
  it('omite examen médico (resolver dedicado en ZIP)', async () => {
    const out = await resolveEventTestPdfForZip({
      id: '1',
      status: 'COMPLETED',
      testNameSnapshot: 'Examen Médico AMI',
      fileUrl: null,
      validatedPdfUrl: 'examen-medico-pdfs/x.pdf',
    })
    expect(out).toBeNull()
  })

  it('omite cancelados', async () => {
    const out = await resolveEventTestPdfForZip({
      id: '1',
      status: 'CANCELLED',
      testNameSnapshot: 'Audiometría',
      fileUrl: null,
      validatedPdfUrl: null,
    })
    expect(out).toBeNull()
  })
})
