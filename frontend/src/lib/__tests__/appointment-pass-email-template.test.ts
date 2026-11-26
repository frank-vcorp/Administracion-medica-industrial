import { describe, expect, it } from 'vitest'
import {
  buildAppointmentPassEmailContent,
  type AppointmentPassEmailTemplateArgs,
} from '@/lib/emails/appointment-pass-email-template'

describe('appointment-pass-email-template', () => {
  const FIXTURE: AppointmentPassEmailTemplateArgs = {
    firstName: 'Carlos',
    lastName: 'Ramírez',
    dateLabel: '2026-11-26',
    timeLabel: '09:00',
    branchName: 'Clínica del Trabajador Col. del Prado',
    branchAddress: 'Circuito del Mesón #135',
    expedientId: 'EXP-2026044',
    profileName: 'Perfil Operativo',
    testNames: ['Audiometría', 'Espirometría'],
    prefillUrl: 'https://administracion-medica-industrial.vercel.app/prefill/tok123',
    triptychUrl:
      'https://administracion-medica-industrial.vercel.app/docs/tips-para-pacientes.pdf',
  }

  it('genera asunto SME, enlace de prellenado y descarga de tríptico con clicktracking off', () => {
    const { subject, text, html } = buildAppointmentPassEmailContent(FIXTURE)

    expect(subject).toBe('Confirmación de cita médica — Soluciones Médico Empresariales')
    expect(text).toContain('Carlos Ramírez')
    expect(text).toContain('2026-11-26')
    expect(text).toContain('09:00')
    expect(text).toContain('EXP-2026044')
    expect(text).toContain('Audiometría, Espirometría')
    expect(text).toContain(FIXTURE.prefillUrl)
    expect(text).toContain(FIXTURE.triptychUrl)

    expect(html).toContain('Completar antecedentes previos')
    expect(html).toContain('Descargar tríptico de preparación (PDF)')
    expect(html).toContain(`clicktracking="off" href="${FIXTURE.prefillUrl}"`)
    expect(html).toContain(`clicktracking="off" href="${FIXTURE.triptychUrl}"`)
    expect(html).toContain('#592c82')
    expect(html).toContain('#00afaa')
  })

  it('escapa HTML malicioso en campos de paciente y sucursal', () => {
    const { html } = buildAppointmentPassEmailContent({
      ...FIXTURE,
      firstName: '<script>alert(1)</script>',
      branchName: '<img src=x onerror=alert(1)>',
    })

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img ')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img ')
  })
})
