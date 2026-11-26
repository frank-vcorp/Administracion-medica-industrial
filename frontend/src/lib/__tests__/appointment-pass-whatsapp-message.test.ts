import { buildAppointmentPassWhatsAppMessage } from '@/lib/appointment-pass-whatsapp-message'

describe('appointment-pass-whatsapp-message', () => {
  const baseInput = {
    firstName: 'Ana',
    lastName: 'Pérez',
    scheduledAt: new Date('2026-11-15T15:30:00.000Z'),
    branchName: 'AMI Centro',
    branchAddress: 'Av. Principal 100',
    expedientId: 'EXP-2026115001',
    profileName: 'Perfil Sodexo',
    testNames: ['Audiometría', 'Espirometría'],
  }

  it('incluye paciente, fecha, hora, sucursal y pruebas sin prefillUrl', () => {
    const text = buildAppointmentPassWhatsAppMessage(baseInput)

    expect(text).toContain('Ana')
    expect(text).toContain('Pérez')
    expect(text).toContain('AMI Centro')
    expect(text).toContain('Av. Principal 100')
    expect(text).toContain('Audiometría')
    expect(text).toContain('Espirometría')
    expect(text).toContain('EXP-2026115001')
    expect(text).toContain('tríptico')
    expect(text).not.toContain('Completa tus antecedentes médicos antes de tu cita')
  })

  it('incluye enlace de prellenado cuando prefillUrl está presente', () => {
    const prefillUrl = 'https://app.medicaindustrial.com/prefill/abc123token'
    const text = buildAppointmentPassWhatsAppMessage({
      ...baseInput,
      prefillUrl,
    })

    expect(text).toContain('Completa tus antecedentes médicos antes de tu cita en este enlace:')
    expect(text).toContain(prefillUrl)
    expect(text).toContain('tríptico')
  })
})
