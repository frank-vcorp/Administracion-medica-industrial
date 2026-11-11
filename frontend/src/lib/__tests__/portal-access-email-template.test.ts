import { describe, expect, it } from 'vitest'
import {
  buildPortalAccessEmailHtml,
  buildPortalAccessEmailText,
} from '@/lib/emails/portal-access-email-template'

const FIXTURE = {
  companyName: 'Sodexo Mexico',
  loginEmail: 'portal@sodexo.mx',
  temporaryPassword: 'Tmp-9xK2mQ',
  loginUrl: 'https://app.medicaindustrial.com/login',
} as const

describe('portal-access-email-template', () => {
  it('plain text incluye credenciales y URL de acceso directa', () => {
    const text = buildPortalAccessEmailText(FIXTURE)
    expect(text).toContain('Sodexo Mexico')
    expect(text).toContain('portal@sodexo.mx')
    expect(text).toContain('Tmp-9xK2mQ')
    expect(text).toContain('https://app.medicaindustrial.com/login')
    expect(text).toContain('/legal/terminos-portal')
    expect(text).toContain('/legal/privacidad-portal')
  })

  it('HTML incluye CTA, caja de credenciales y escapa contenido sensible', () => {
    const html = buildPortalAccessEmailHtml(FIXTURE)
    expect(html).toMatchSnapshot()
    expect(html).toContain('Acceder al portal')
    expect(html).toContain('href="https://app.medicaindustrial.com/login"')
    expect(html).toContain('portal@sodexo.mx')
    expect(html).toContain('Tmp-9xK2mQ')
    expect(html).toContain('#00afaa')
    expect(html).toContain('#592c82')
  })

  it('escapa HTML malicioso en nombre de empresa', () => {
    const html = buildPortalAccessEmailHtml({
      ...FIXTURE,
      companyName: '<script>alert(1)</script>',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
