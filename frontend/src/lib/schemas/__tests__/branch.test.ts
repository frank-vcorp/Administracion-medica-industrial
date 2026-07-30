/**
 * @file Tests unitarios: Zod schemas de Branch (IMPL-20260730-02 PR-1 + IMPL-20260730-03).
 * @id IMPL-20260730-02 / IMPL-20260730-03
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §6
 *
 * Cubre:
 *   - branchCreateSchema válido con todos los campos.
 *   - branchCreateSchema rechaza openingTime >= closingTime.
 *   - branchCreateSchema rechaza phone con caracteres inválidos.
 *   - branchCreateSchema rechaza hourlyCapacity fuera de [1, 100].
 *   - branchCreateSchema rechaza name < 2 o > 100 chars.
 *   - branchUpdateSchema permite campos parciales.
 *   - branchToggleSchema valida UUID + boolean.
 *   - branchIdSchema valida UUID y rechaza no-UUIDs.
 *   - timeRegex acepta "07:00", "23:59"; rechaza "25:00", "7:00".
 *   - IMPL-20260730-03 (H3 — GEMINI AUD-20260730-01): coerce string→number en
 *     hourlyCapacity para soportar payloads FormData de PR-2.
 */
/// <reference types="vitest/globals" />

import {
  branchCreateSchema,
  branchUpdateSchema,
  branchToggleSchema,
  branchIdSchema,
  timeRegex,
} from '@/lib/schemas/branch'

const validBranch = {
  name: 'Sucursal Centro',
  address: 'Av. Reforma 100, Centro',
  phone: '+52 55 1234 5678',
  managerName: 'Juan Pérez',
  hourlyCapacity: 20,
  openingTime: '08:00',
  closingTime: '18:00',
}

describe('timeRegex (helper)', () => {
  it('acepta "07:00" y "23:59"', () => {
    expect(timeRegex.test('07:00')).toBe(true)
    expect(timeRegex.test('23:59')).toBe(true)
  })

  it('acepta "00:00" (boundary inferior)', () => {
    expect(timeRegex.test('00:00')).toBe(true)
  })

  it('acepta "09:30" (hour con 0X)', () => {
    expect(timeRegex.test('09:30')).toBe(true)
  })

  it('rechaza "25:00" (hora fuera de rango)', () => {
    expect(timeRegex.test('25:00')).toBe(false)
  })

  it('rechaza "24:00" (hora fuera de rango)', () => {
    expect(timeRegex.test('24:00')).toBe(false)
  })

  it('rechaza "7:00" (sin zero-pad)', () => {
    expect(timeRegex.test('7:00')).toBe(false)
  })

  it('rechaza "08:60" (minuto fuera de rango)', () => {
    expect(timeRegex.test('08:60')).toBe(false)
  })

  it('rechaza cadena vacía', () => {
    expect(timeRegex.test('')).toBe(false)
  })

  it('rechaza "8:00 AM" (formato 12h)', () => {
    expect(timeRegex.test('8:00 AM')).toBe(false)
  })
})

describe('branchCreateSchema', () => {
  it('acepta payload válido con todos los campos', () => {
    const r = branchCreateSchema.safeParse(validBranch)
    expect(r.success).toBe(true)
  })

  it('acepta payload con phone vacío (literal "")', () => {
    const r = branchCreateSchema.safeParse({ ...validBranch, phone: '' })
    expect(r.success).toBe(true)
  })

  it('acepta payload sin phone (undefined)', () => {
    const { phone: _omit, ...rest } = validBranch
    const r = branchCreateSchema.safeParse(rest)
    expect(r.success).toBe(true)
  })

  it('acepta payload sin managerName (undefined)', () => {
    const r = branchCreateSchema.safeParse({ ...validBranch, managerName: '' })
    expect(r.success).toBe(true)
  })

  it('rechaza openingTime === closingTime (rango vacío)', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      openingTime: '10:00',
      closingTime: '10:00',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('closingTime'))).toBe(true)
    }
  })

  it('rechaza openingTime > closingTime', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      openingTime: '18:00',
      closingTime: '08:00',
    })
    expect(r.success).toBe(false)
  })

  it('rechaza phone con caracteres inválidos (letras)', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      phone: '+52-abc-defg',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('phone'))).toBe(true)
    }
  })

  it('rechaza phone demasiado corto (5 dígitos)', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      phone: '12345',
    })
    expect(r.success).toBe(false)
  })

  it('rechaza hourlyCapacity = 0', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: 0,
    })
    expect(r.success).toBe(false)
  })

  it('rechaza hourlyCapacity = 101', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: 101,
    })
    expect(r.success).toBe(false)
  })

  it('acepta hourlyCapacity = 1 (boundary inferior)', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: 1,
    })
    expect(r.success).toBe(true)
  })

  it('acepta hourlyCapacity = 100 (boundary superior)', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: 100,
    })
    expect(r.success).toBe(true)
  })

  it('rechaza hourlyCapacity no entero (decimal)', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: 20.5,
    })
    expect(r.success).toBe(false)
  })

  it('rechaza name con 1 carácter', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      name: 'A',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('name'))).toBe(true)
    }
  })

  it('rechaza name con 101 caracteres', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      name: 'a'.repeat(101),
    })
    expect(r.success).toBe(false)
  })

  it('rechaza openingTime con formato inválido', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      openingTime: '8am',
    })
    expect(r.success).toBe(false)
  })

  it('rechaza closingTime con formato inválido', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      closingTime: '20:60',
    })
    expect(r.success).toBe(false)
  })

  it('rechaza address con más de 200 caracteres', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      address: 'a'.repeat(201),
    })
    expect(r.success).toBe(false)
  })
})

describe('branchUpdateSchema (parcial)', () => {
  it('acepta update con un solo campo (name)', () => {
    const r = branchUpdateSchema.safeParse({ name: 'Sucursal Norte' })
    expect(r.success).toBe(true)
  })

  it('acepta update con varios campos', () => {
    const r = branchUpdateSchema.safeParse({
      openingTime: '09:00',
      closingTime: '19:00',
      hourlyCapacity: 30,
    })
    expect(r.success).toBe(true)
  })

  it('acepta objeto vacío (no-op permitido por contrato .partial())', () => {
    const r = branchUpdateSchema.safeParse({})
    expect(r.success).toBe(true)
  })

  it('rechaza hourlyCapacity inválido en partial', () => {
    const r = branchUpdateSchema.safeParse({ hourlyCapacity: 200 })
    expect(r.success).toBe(false)
  })

  it('rechaza time inválido en partial', () => {
    const r = branchUpdateSchema.safeParse({ openingTime: 'mal' })
    expect(r.success).toBe(false)
  })

  it('rechaza openingTime > closingTime en update conjunto', () => {
    const r = branchUpdateSchema.safeParse({
      openingTime: '20:00',
      closingTime: '10:00',
    })
    expect(r.success).toBe(false)
  })
})

describe('branchToggleSchema', () => {
  it('acepta UUID válido + boolean', () => {
    const r = branchToggleSchema.safeParse({
      id: '5b8e6f9c-3a4b-4f1e-9f1a-1c2d3e4f5a6b',
      isActive: false,
    })
    expect(r.success).toBe(true)
  })

  it('rechaza id no-UUID', () => {
    const r = branchToggleSchema.safeParse({
      id: 'no-es-uuid',
      isActive: true,
    })
    expect(r.success).toBe(false)
  })

  it('rechaza isActive no-boolean', () => {
    const r = branchToggleSchema.safeParse({
      id: '5b8e6f9c-3a4b-4f1e-9f1a-1c2d3e4f5a6b',
      isActive: 'yes',
    })
    expect(r.success).toBe(false)
  })
})

describe('branchIdSchema', () => {
  it('acepta UUID válido', () => {
    expect(branchIdSchema.safeParse('5b8e6f9c-3a4b-4f1e-9f1a-1c2d3e4f5a6b').success).toBe(true)
  })

  it('rechaza cadena vacía', () => {
    expect(branchIdSchema.safeParse('').success).toBe(false)
  })

  it('rechaza string no-UUID', () => {
    expect(branchIdSchema.safeParse('abc').success).toBe(false)
  })
})

// --------------------------------------------------------------------------
// IMPL-20260730-03 — correcciones GEMINI AUD-20260730-01 (H3)
// --------------------------------------------------------------------------

describe('IMPL-20260730-03 — H3: hourlyCapacity con z.coerce.number()', () => {
  it('coerce hourlyCapacity string "20" a número 20', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: '20' as unknown as number,
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.hourlyCapacity).toBe(20)
      expect(typeof r.data.hourlyCapacity).toBe('number')
    }
  })

  it('coerce hourlyCapacity string "1" al boundary inferior', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: '1' as unknown as number,
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.hourlyCapacity).toBe(1)
  })

  it('coerce hourlyCapacity string "100" al boundary superior', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: '100' as unknown as number,
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.hourlyCapacity).toBe(100)
  })

  it('rechaza string "0" tras coerce (fuera de rango)', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: '0' as unknown as number,
    })
    expect(r.success).toBe(false)
  })

  it('rechaza string "101" tras coerce (fuera de rango)', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: '101' as unknown as number,
    })
    expect(r.success).toBe(false)
  })

  it('rechaza string "abc" (no-numérico)', () => {
    const r = branchCreateSchema.safeParse({
      ...validBranch,
      hourlyCapacity: 'abc' as unknown as number,
    })
    expect(r.success).toBe(false)
  })

  it('en update schema también coerce (hourlyCapacity parcial)', () => {
    const r = branchUpdateSchema.safeParse({ hourlyCapacity: '30' as unknown as number })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.hourlyCapacity).toBe(30)
  })
})
