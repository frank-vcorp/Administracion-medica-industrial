import { buildAppointmentPassWhatsAppMessage } from '@/lib/appointment-pass-whatsapp-message'

describe('appointment-pass-whatsapp-message', () => {
  it('incluye paciente, fecha, hora, sucursal y pruebas', () => {
    const text = buildAppointmentPassWhatsAppMessage({
      firstName: 'Ana',
      lastName: 'Pérez',
      scheduledAt: new Date('2026-11-15T15:30:00.000Z'),
      branchName: 'AMI Centro',
      branchAddress: 'Av. Principal 100',
      expedientId: 'EXP-2026115001',
      profileName: 'Perfil Sodexo',
      testNames: ['Audiometría', 'Espirometría'],
    })

    expect(text).toContain('Ana')
    expect(text).toContain('Pérez')
    expect(text).toContain('AMI Centro')
    expect(text).toContain('Av. Principal 100')
    expect(text).toContain('Audiometría')
    expect(text).toContain('Espirometría')
    expect(text).toContain('EXP-2026115001')
    expect(text).toContain('tríptico')
  })
})
