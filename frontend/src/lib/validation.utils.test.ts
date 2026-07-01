/**
 * @file Tests para validation.utils.ts
 * @id IMPL-20260630-01
 */

import { describe, it, expect } from 'vitest'
import {
  normalizePhone,
  validatePhone,
  formatPhoneDisplay,
  validateEmail,
  PhoneSchema,
  OptionalPhoneSchema,
  EmailSchema,
  OptionalEmailSchema,
  ContactDataSchema,
} from './validation.utils'

describe('validation.utils', () => {
  describe('normalizePhone', () => {
    it('elimina caracteres no numéricos', () => {
      expect(normalizePhone('(442) 123-4567')).toBe('4421234567')
      expect(normalizePhone('+52 1 442 123 4567')).toBe('5214421234567')
      expect(normalizePhone('442.123.45.67')).toBe('4421234567')
    })

    it('retorna string vacío si no hay dígitos', () => {
      expect(normalizePhone('abc-def')).toBe('')
    })
  })

  describe('validatePhone', () => {
    describe('rechaza', () => {
      it('longitud incorrecta', () => {
        expect(validatePhone('123456789').valid).toBe(false)
        expect(validatePhone('12345678901').valid).toBe(false)
      })

      it('secuencias consecutivas ascendentes', () => {
        expect(validatePhone('1234567890').valid).toBe(false)
        expect(validatePhone('2345678901').valid).toBe(false)
        expect(validatePhone('9876543210').valid).toBe(false)
        expect(validatePhone('8765432109').valid).toBe(false)
      })

      it('dígitos repetidos', () => {
        expect(validatePhone('1111111111').valid).toBe(false)
        expect(validatePhone('2222222222').valid).toBe(false)
        expect(validatePhone('0000000000').valid).toBe(false)
        expect(validatePhone('9999999999').valid).toBe(false)
      })

      it('formato con caracteres especiales', () => {
        const r = validatePhone('(123) 456-7890')
        expect(r.valid).toBe(false)
      })
    })

    describe('acepta', () => {
      it('teléfonos válidos de 10 dígitos', () => {
        expect(validatePhone('5512345678').valid).toBe(true)
        expect(validatePhone('4421234567').valid).toBe(true)
        expect(validatePhone('9934567890').valid).toBe(true)
      })

      it('teléfonos con formato MX aceptables', () => {
        const r = validatePhone('(442) 123-4567')
        expect(r.valid).toBe(true)
      })

      it('teléfonos que parecen edge-case pero no son relleno', () => {
        // 5500123456: empieza con 55, tiene 00 en el medio, NO es 00-99 consecutivo
        expect(validatePhone('5500123456').valid).toBe(true)
        // 4431234567: simple, válido
        expect(validatePhone('4431234567').valid).toBe(true)
      })
    })

    describe('mensajes de error', () => {
      it('error claro para longitud', () => {
        const r = validatePhone('12345')
        expect(r.error).toMatch(/10 dígitos/)
      })

      it('error claro para consecutivo', () => {
        const r = validatePhone('1234567890')
        expect(r.error).toMatch(/consecutiva/)
      })

      it('error claro para dígito repetido', () => {
        const r = validatePhone('1111111111')
        expect(r.error).toMatch(/repetido/)
      })
    })
  })

  describe('formatPhoneDisplay', () => {
    it('formatea 10 dígitos como (XX) XXXX-XXXX', () => {
      expect(formatPhoneDisplay('4421234567')).toBe('(44) 2123-4567')
      expect(formatPhoneDisplay('5512345678')).toBe('(55) 1234-5678')
    })

    it('acepta formato con código de país', () => {
      expect(formatPhoneDisplay('5214421234567')).toBe('+52 1 (44) 2123-4567')
    })

    it('devuelve original si no encaja en formatos conocidos', () => {
      expect(formatPhoneDisplay('12345')).toBe('12345')
    })
  })

  describe('validateEmail', () => {
    describe('rechaza', () => {
      it('formato inválido', () => {
        expect(validateEmail('notanemail').valid).toBe(false)
        expect(validateEmail('@example.com').valid).toBe(false)
        expect(validateEmail('user@').valid).toBe(false)
      })

      it('patrones de relleno en local-part', () => {
        expect(validateEmail('test@example.com').valid).toBe(false)
        expect(validateEmail('demo@example.com').valid).toBe(false)
        expect(validateEmail('test123@example.com').valid).toBe(false)
        expect(validateEmail('aaaa@example.com').valid).toBe(false)
        expect(validateEmail('bbbb@example.com').valid).toBe(false)
        expect(validateEmail('xxxxx@example.com').valid).toBe(false)
      })

      it('solo números en local-part', () => {
        expect(validateEmail('12345@example.com').valid).toBe(false)
      })

      it('dominios temporales', () => {
        expect(validateEmail('user@mailinator.com').valid).toBe(false)
        expect(validateEmail('user@yopmail.com').valid).toBe(false)
        expect(validateEmail('user@guerrillamail.com').valid).toBe(false)
        expect(validateEmail('user@tempmail.com').valid).toBe(false)
        expect(validateEmail('user@maildrop.cc').valid).toBe(false)
      })

      it('dominios bloqueados por negocio (medicaindustrial)', () => {
        expect(validateEmail('user@medicaindustrial.com').valid).toBe(false)
        expect(validateEmail('paciente@medicaindustrial.com.mx').valid).toBe(false)
        expect(validateEmail('admin@medicaindustrial.com').valid).toBe(false)
        expect(validateEmail('contacto@medicaindustrial.com.mx').valid).toBe(false)
      })

      it('local-part muy corto', () => {
        expect(validateEmail('a@example.com').valid).toBe(false)
        expect(validateEmail('ab@example.com').valid).toBe(false)
      })
    })

    describe('acepta', () => {
      it('emails válidos normales', () => {
        expect(validateEmail('juan.perez@gmail.com').valid).toBe(true)
        expect(validateEmail('maria.lopez@empresa.com.mx').valid).toBe(true)
        expect(validateEmail('contacto@ami-industrial.com').valid).toBe(true)
      })

      it('emails con números legítimos', () => {
        expect(validateEmail('juan.perez2024@gmail.com').valid).toBe(true)
        expect(validateEmail('user12345@gmail.com').valid).toBe(true)
      })

      it('emails con caracteres especiales válidos', () => {
        expect(validateEmail('juan.perez+test@gmail.com').valid).toBe(true)
        expect(validateEmail('maria-lopez@empresa.com').valid).toBe(true)
      })
    })
  })

  describe('Schemas Zod', () => {
    describe('PhoneSchema', () => {
      it('valida teléfono correcto', () => {
        const r = PhoneSchema.safeParse('(442) 123-4567')
        expect(r.success).toBe(true)
        if (r.success) expect(r.data).toBe('4421234567')
      })

      it('rechaza teléfono vacío', () => {
        const r = PhoneSchema.safeParse('')
        expect(r.success).toBe(false)
      })

      it('rechaza teléfono con relleno', () => {
        const r = PhoneSchema.safeParse('1111111111')
        expect(r.success).toBe(false)
      })

      it('normaliza el teléfono válido', () => {
        const r = PhoneSchema.safeParse('442.123.4567')
        expect(r.success).toBe(true)
        if (r.success) expect(r.data).toBe('4421234567')
      })
    })

    describe('OptionalPhoneSchema', () => {
      it('acepta undefined', () => {
        const r = OptionalPhoneSchema.safeParse(undefined)
        expect(r.success).toBe(true)
      })

      it('acepta string vacío', () => {
        const r = OptionalPhoneSchema.safeParse('')
        expect(r.success).toBe(true)
      })

      it('valida teléfono correcto cuando se proporciona', () => {
        const r = OptionalPhoneSchema.safeParse('4421234567')
        expect(r.success).toBe(true)
        if (r.success) expect(r.data).toBe('4421234567')
      })

      it('rechaza relleno', () => {
        const r = OptionalPhoneSchema.safeParse('1234567890')
        expect(r.success).toBe(false)
      })
    })

    describe('EmailSchema', () => {
      it('valida email correcto', () => {
        const r = EmailSchema.safeParse('Juan.Perez@Empresa.COM')
        expect(r.success).toBe(true)
        if (r.success) expect(r.data).toBe('juan.perez@empresa.com')
      })

      it('rechaza email inválido', () => {
        const r = EmailSchema.safeParse('notanemail')
        expect(r.success).toBe(false)
      })

      it('rechaza relleno', () => {
        const r = EmailSchema.safeParse('test@empresa.com')
        expect(r.success).toBe(false)
      })

      it('normaliza a minúsculas', () => {
        const r = EmailSchema.safeParse('JUAN@EMPRESA.COM')
        expect(r.success).toBe(true)
        if (r.success) expect(r.data).toBe('juan@empresa.com')
      })
    })

    describe('OptionalEmailSchema', () => {
      it('acepta undefined', () => {
        const r = OptionalEmailSchema.safeParse(undefined)
        expect(r.success).toBe(true)
      })

      it('acepta string vacío', () => {
        const r = OptionalEmailSchema.safeParse('')
        expect(r.success).toBe(true)
      })

      it('valida cuando se proporciona', () => {
        const r = OptionalEmailSchema.safeParse('juan@empresa.com')
        expect(r.success).toBe(true)
      })

      it('rechaza relleno', () => {
        const r = OptionalEmailSchema.safeParse('aaa@example.com')
        expect(r.success).toBe(false)
      })
    })

    describe('ContactDataSchema', () => {
      it('valida datos completos', () => {
        const r = ContactDataSchema.safeParse({
          phone: '4421234567',
          email: 'juan@empresa.com',
        })
        expect(r.success).toBe(true)
      })

      it('rechaza si phone tiene relleno', () => {
        const r = ContactDataSchema.safeParse({
          phone: '1111111111',
          email: 'juan@empresa.com',
        })
        expect(r.success).toBe(false)
      })

      it('rechaza si email tiene relleno', () => {
        const r = ContactDataSchema.safeParse({
          phone: '4421234567',
          email: 'test@empresa.com',
        })
        expect(r.success).toBe(false)
      })
    })
  })
})
