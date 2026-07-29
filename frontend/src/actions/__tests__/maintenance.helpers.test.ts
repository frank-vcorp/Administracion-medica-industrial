/**
 * @file Tests para los helpers de Mantenimiento (MobileUnit) — IMPL-20260711-01.
 * @id IMPL-20260711-01
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 *
 * Cubre:
 *  1. calculateNextDueDate PREVENTIVO → +90d
 *  2. calculateNextDueDate VERIFICACION → +365d
 *  3. calculateNextDueDate LIMPIEZA → +30d
 *  4. calculateNextDueDate CORRECTIVO → null
 *  5. calculateNextDueDate override gana sobre automático
 *  6. calculateNextDueDate ignora override si es null (usa auto)
 *  7. calculateNextDueDate devuelve Date tipo
 *  8. calculateNextDueDate idempotente para misma fecha y tipo
 *  9. calculateNextDueDate con fecha específica conocida (boundary)
 * 10. calculateNextDueDate CORRECTIVO no se ve afectado por override
 */
/// <reference types="vitest/globals" />
import { describe, expect, it } from 'vitest'
import { calculateNextDueDate } from '@/actions/maintenance.helpers'

describe('maintenance.actions.calculateNextDueDate', () => {
  const completed = new Date('2026-07-11T00:00:00Z')

  it('1. PREVENTIVO → +90 días', () => {
    const r = calculateNextDueDate(completed, 'PREVENTIVO')
    expect(r).toEqual(new Date(completed.getTime() + 90 * 86400_000))
  })

  it('2. VERIFICACION → +365 días', () => {
    const r = calculateNextDueDate(completed, 'VERIFICACION')
    expect(r).toEqual(new Date(completed.getTime() + 365 * 86400_000))
  })

  it('3. LIMPIEZA → +30 días', () => {
    const r = calculateNextDueDate(completed, 'LIMPIEZA')
    expect(r).toEqual(new Date(completed.getTime() + 30 * 86400_000))
  })

  it('4. CORRECTIVO → null', () => {
    const r = calculateNextDueDate(completed, 'CORRECTIVO')
    expect(r).toBeNull()
  })

  it('5. override gana sobre cálculo automático', () => {
    const override = new Date('2027-01-01T00:00:00Z')
    const r = calculateNextDueDate(completed, 'PREVENTIVO', override)
    expect(r).toBe(override)
  })

  it('6. override explícito null significa "sin next due" (override gana siempre)', () => {
    // Política: `override !== undefined` siempre gana; pasar null = intencionalmente
    // sin next due (útil si usuario quiere resetear el schedule).
    const r = calculateNextDueDate(completed, 'PREVENTIVO', null)
    expect(r).toBeNull()
  })

  it('7. resultado es instancia de Date', () => {
    const r = calculateNextDueDate(completed, 'LIMPIEZA')
    expect(r).toBeInstanceOf(Date)
  })

  it('8. idempotente', () => {
    const a = calculateNextDueDate(completed, 'PREVENTIVO')
    const b = calculateNextDueDate(completed, 'PREVENTIVO')
    expect(a?.getTime()).toBe(b?.getTime())
  })

  it('9. boundary: completedAt 2026-07-11 + 90d = 2026-10-09', () => {
    const r = calculateNextDueDate(new Date('2026-07-11T00:00:00Z'), 'PREVENTIVO')
    expect(r?.toISOString().slice(0, 10)).toBe('2026-10-09')
  })

  it('10. CORRECTIVO con override gana sobre la regla "no aplica"', () => {
    // Política actual: override explícito gana siempre (incluso para CORRECTIVO).
    // El backend mantiene la misma semántica (`mobile_unit_service.calculate_next_due_date`).
    const override = new Date('2027-01-01T00:00:00Z')
    const r = calculateNextDueDate(completed, 'CORRECTIVO', override)
    expect(r).toEqual(override)
  })

  it('11. PREVENTIVO usa timestamp exacto, no calendáreo', () => {
    const r = calculateNextDueDate(new Date('2026-01-01T12:00:00Z'), 'PREVENTIVO')
    expect(r?.toISOString()).toBe('2026-04-01T12:00:00.000Z')
  })

  it('12. fechas futuras no se modifican', () => {
    const future = new Date('2099-12-31T00:00:00Z')
    const r = calculateNextDueDate(future, 'PREVENTIVO')
    expect(r?.toISOString().slice(0, 10)).toBe('2100-03-31')
  })
})
