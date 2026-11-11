import { describe, expect, it } from 'vitest'
import { migrateFreeTextString, migrateJsonFreeText } from '@/lib/text/migrate-sentence-case'

describe('migrateFreeTextString', () => {
  it('normaliza texto libre', () => {
    expect(migrateFreeTextString('DOLOR DE CABEZA', 'notes')).toBe('Dolor de cabeza')
  })

  it('no toca emails ni URLs', () => {
    expect(migrateFreeTextString('user@example.com', 'email')).toBe('user@example.com')
    expect(migrateFreeTextString('https://x.y/z', 'fileUrl')).toBe('https://x.y/z')
  })

  it('no toca códigos CIE', () => {
    expect(migrateFreeTextString('J45.0', 'codigo')).toBe('J45.0')
  })
})

describe('migrateJsonFreeText', () => {
  it('recorre objetos anidados', () => {
    const out = migrateJsonFreeText({
      observaciones: 'DOLOR LEVE',
      email: 'A@B.COM',
    })
    expect(out).toEqual({
      observaciones: 'Dolor leve',
      email: 'A@B.COM',
    })
  })
})
