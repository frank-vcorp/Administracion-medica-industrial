import { describe, expect, it } from 'vitest'
import {
  buildSendGridDisableClickTrackHeaders,
  formatSmtpFromWithBrand,
} from '@/lib/smtp-mail'
import { buildPortalAccessEmailSubject } from '@/lib/portal-access-email'

describe('formatSmtpFromWithBrand', () => {
  it('envuelve dirección simple con la marca Soluciones Médico Empresariales', () => {
    expect(formatSmtpFromWithBrand('sistema@medicaindustrial.com')).toBe(
      '"Soluciones Médico Empresariales" <sistema@medicaindustrial.com>',
    )
    expect(formatSmtpFromWithBrand('  sistema@medicaindustrial.com  ')).toBe(
      '"Soluciones Médico Empresariales" <sistema@medicaindustrial.com>',
    )
  })

  it('respeta sin duplicar un remitente que ya incluye nombre de despliegue', () => {
    expect(formatSmtpFromWithBrand('"Otro Nombre" <a@b.com>')).toBe(
      '"Otro Nombre" <a@b.com>',
    )
  })

  it('devuelve cadena vacía intacta si viene vacía', () => {
    expect(formatSmtpFromWithBrand('')).toBe('')
  })
})

describe('buildPortalAccessEmailSubject', () => {
  it('construye asunto descriptivo del portal de medicina laboral', () => {
    expect(buildPortalAccessEmailSubject('Systron Industrial')).toBe(
      'Credenciales de acceso al Portal de Medicina Laboral — Systron Industrial',
    )
  })
})

describe('buildSendGridDisableClickTrackHeaders', () => {
  it('desactiva click tracking vía X-SMTPAPI cuando source es sendgrid_db', () => {
    const headers = buildSendGridDisableClickTrackHeaders({
      host: 'smtp.custom.local',
      source: 'sendgrid_db',
    })
    expect(headers).toBeDefined()
    const parsed = JSON.parse(headers!['X-SMTPAPI'])
    expect(parsed).toEqual({
      filters: {
        clicktrack: {
          settings: {
            enable: 0,
            enable_text: 0,
          },
        },
      },
    })
  })

  it('desactiva click tracking vía X-SMTPAPI cuando el host es smtp.sendgrid.net', () => {
    const headers = buildSendGridDisableClickTrackHeaders({
      host: 'smtp.sendgrid.net',
      source: 'env',
    })
    expect(headers).toBeDefined()
    const parsed = JSON.parse(headers!['X-SMTPAPI'])
    expect(parsed.filters.clicktrack.settings.enable).toBe(0)
    expect(parsed.filters.clicktrack.settings.enable_text).toBe(0)
  })

  it('retorna undefined para servidores SMTP genéricos no SendGrid', () => {
    const headers = buildSendGridDisableClickTrackHeaders({
      host: 'smtp.gmail.com',
      source: 'env',
    })
    expect(headers).toBeUndefined()
  })
})
