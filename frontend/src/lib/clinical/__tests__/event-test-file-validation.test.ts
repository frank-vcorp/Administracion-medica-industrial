/**
 * @file Tests de validación de archivos por tipo de estudio en Papeleta.
 */
import { describe, it, expect } from 'vitest'
import {
  validateEventTestUploadFileSync,
  validateEventTestUploadFileAsync,
  resolveStudyTypeForEventTestFileValidation,
  getAcceptAttributeForStudyType,
} from '@/lib/clinical/event-test-file-validation'

function mockFile(
  name: string,
  type: string,
  content: string = '%PDF-1.4 test',
): File {
  return new File([content], name, { type })
}

describe('event-test-file-validation', () => {
  it('Audiometría acepta PDF y XML', () => {
    const pdf = mockFile('audiometria.pdf', 'application/pdf')
    const xml = mockFile('paciente.xml', 'application/xml', '<?xml version="1.0"?><root/>')
    expect(validateEventTestUploadFileSync(pdf, 'Audiometria').valid).toBe(true)
    expect(validateEventTestUploadFileSync(xml, 'Audiometria').valid).toBe(true)
  })

  it('Espirometría rechaza XML', () => {
    const xml = mockFile('falso.xml', 'application/xml', '<?xml version="1.0"?>')
    const res = validateEventTestUploadFileSync(xml, 'Espirometria')
    expect(res.valid).toBe(false)
    expect(res.message).toContain('XML')
    expect(res.message).toContain('Audiometría')
  })

  it('rechaza extensión no permitida (.xlsx)', () => {
    const xlsx = mockFile('labs.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const res = validateEventTestUploadFileSync(xlsx, 'Laboratorio')
    expect(res.valid).toBe(false)
    expect(res.message).toContain('Formato incorrecto')
    expect(res.message).toContain('adecuado')
  })

  it('acepta octet-stream cuando la extensión es PDF', () => {
    const f = mockFile('resultado.pdf', 'application/octet-stream')
    expect(validateEventTestUploadFileSync(f, 'Rayos_X').valid).toBe(true)
  })

  it('magic bytes: extensión PDF con contenido XML → rechazo', async () => {
    const disguised = mockFile(
      'espiro.pdf',
      'application/pdf',
      '<?xml version="1.0"?><espirometria/>',
    )
    const res = await validateEventTestUploadFileAsync(disguised, 'Espirometria')
    expect(res.valid).toBe(false)
    expect(res.message).toContain('no coincide')
  })

  it('accept de Audiometría incluye .xml', () => {
    expect(getAcceptAttributeForStudyType('Audiometria')).toContain('.xml')
    expect(getAcceptAttributeForStudyType('Espirometria')).not.toContain('.xml')
  })

  it('resolveStudyType prefiere calibración V3 publicada', () => {
    const type = resolveStudyTypeForEventTestFileValidation(
      { testNameSnapshot: 'Audiometría tonal', test: { category: { name: 'Generales' } } },
      { enabled: true, canonicalStudyType: 'Espirometria' },
    )
    expect(type).toBe('Espirometria')
  })
})
