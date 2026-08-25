/**
 * @file Tests focales (V1) para el schema Zod del perfil médico y la
 *   validación de completitud para emitir PDF validado.
 * @id IMPL-FEATURE-20260825-01
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * Cobertura:
 *  - `fullName` ≥3 / ≤120 tras trim.
 *  - `professionalLicense` opcional pero con regex letras/dígitos/guion/espacio
 *    y longitud 4–20 cuando está presente.
 *  - `signatureImageUrl` acepta data-URL de imagen, ruta `/uploads/...` o
 *    URL https. Rechaza otros esquemas y longitudes absurdas.
 *  - `validateDoctorProfileForPdf` exige los tres campos no vacíos antes de
 *    autorizar la generación de PDF; devuelve mensaje legible para la UI.
 */
import { describe, it, expect } from 'vitest'
import {
  doctorProfileSchema,
  validateDoctorProfileForPdf,
} from '@/schemas/clinical/doctor-profile.schema'

describe('doctorProfileSchema — perfil médico editable', () => {
  it('acepta un perfil completo válido', () => {
    const res = doctorProfileSchema.safeParse({
      fullName: 'Dra. María López García',
      professionalLicense: '1234567',
      signatureImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
    })
    expect(res.success).toBe(true)
  })

  it('rechaza nombre con menos de 3 caracteres tras trim', () => {
    const res = doctorProfileSchema.safeParse({
      fullName: '  Ab  ',
      professionalLicense: '1234567',
      signatureImageUrl: '',
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.message).toMatch(/al menos 3 caracteres/)
    }
  })

  it('rechaza nombre de más de 120 caracteres', () => {
    const res = doctorProfileSchema.safeParse({
      fullName: 'A'.repeat(121),
      professionalLicense: '1234567',
      signatureImageUrl: '',
    })
    expect(res.success).toBe(false)
  })

  it('permite cédula con formato AE123456-7 (letras, dígitos, guion)', () => {
    const res = doctorProfileSchema.safeParse({
      fullName: 'Dr. Test',
      professionalLicense: 'AE123456-7',
      signatureImageUrl: '',
    })
    expect(res.success).toBe(true)
  })

  it('rechaza cédula con caracteres no permitidos', () => {
    const res = doctorProfileSchema.safeParse({
      fullName: 'Dr. Test',
      professionalLicense: '1234@567',
      signatureImageUrl: '',
    })
    expect(res.success).toBe(false)
  })

  it('rechaza cédula de menos de 4 caracteres', () => {
    const res = doctorProfileSchema.safeParse({
      fullName: 'Dr. Test',
      professionalLicense: '12',
      signatureImageUrl: '',
    })
    expect(res.success).toBe(false)
  })

  it('permite cédula vacía (opcional en perfil, requerida para PDF)', () => {
    const res = doctorProfileSchema.safeParse({
      fullName: 'Dr. Test',
      professionalLicense: '',
      signatureImageUrl: '',
    })
    expect(res.success).toBe(true)
  })

  it('rechaza firma con esquema no soportado (javascript:)', () => {
    const res = doctorProfileSchema.safeParse({
      fullName: 'Dr. Test',
      professionalLicense: '1234567',
      signatureImageUrl: 'javascript:alert(1)',
    })
    expect(res.success).toBe(false)
  })

  it('acepta firma como ruta /uploads/...', () => {
    const res = doctorProfileSchema.safeParse({
      fullName: 'Dr. Test',
      professionalLicense: '1234567',
      signatureImageUrl: '/uploads/signatures/abc.png',
    })
    expect(res.success).toBe(true)
  })

  it('acepta firma como URL https', () => {
    const res = doctorProfileSchema.safeParse({
      fullName: 'Dr. Test',
      professionalLicense: '1234567',
      signatureImageUrl: 'https://example.com/sig.png',
    })
    expect(res.success).toBe(true)
  })
})

describe('validateDoctorProfileForPdf — gate de generación de PDF', () => {
  it('devuelve null cuando el perfil tiene los tres campos requeridos', () => {
    expect(
      validateDoctorProfileForPdf({
        fullName: 'Dra. María López',
        professionalLicense: '1234567',
        signatureImageUrl: 'data:image/png;base64,xxx',
      }),
    ).toBeNull()
  })

  it('bloquea si falta cédula', () => {
    const msg = validateDoctorProfileForPdf({
      fullName: 'Dra. María López',
      professionalLicense: '',
      signatureImageUrl: 'data:image/png;base64,xxx',
    })
    expect(msg).toMatch(/c[ée]dula/i)
  })

  it('bloquea si falta firma', () => {
    const msg = validateDoctorProfileForPdf({
      fullName: 'Dra. María López',
      professionalLicense: '1234567',
      signatureImageUrl: '',
    })
    expect(msg).toMatch(/firma/i)
  })

  it('bloquea si el nombre es demasiado corto', () => {
    const msg = validateDoctorProfileForPdf({
      fullName: 'Ab',
      professionalLicense: '1234567',
      signatureImageUrl: 'data:image/png;base64,xxx',
    })
    expect(msg).toMatch(/nombre/i)
  })
})
