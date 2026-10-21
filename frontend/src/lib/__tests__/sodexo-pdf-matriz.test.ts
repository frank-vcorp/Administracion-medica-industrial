import { describe, expect, it } from 'vitest'
import { parseMatrizFromText } from '@/lib/sodexo-pdf-matriz'

describe('sodexo-pdf-matriz', () => {
  it('parsea factor:nivel y palabras clave', () => {
    expect(parseMatrizFromText('ruido:3; calor:A')).toEqual({
      ruido: ['3'],
      calor: ['A'],
    })
    expect(parseMatrizFromText('ruido 4')).toEqual({
      ruido: ['4'],
    })
  })
})
