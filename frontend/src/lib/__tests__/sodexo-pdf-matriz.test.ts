import { describe, expect, it } from 'vitest'
import { parseMatrizFromText } from '@/lib/sodexo-pdf-matriz'

describe('sodexo-pdf-matriz', () => {
  it('parsea factor:nivel y palabras clave', () => {
    expect(parseMatrizFromText('ruido:3; calor:2')).toEqual({
      ruido: '3',
      calor: '2',
    })
    expect(parseMatrizFromText('Ruido, calor')).toEqual({
      ruido: '2',
      calor: '2',
    })
  })
})
