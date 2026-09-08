import { describe, expect, it } from 'vitest'
import {
  getEventCompleteness,
  getEventCompletenessLabel,
  isEventTestResolved,
} from '../event-completeness'

describe('event-completeness (validación diagnóstica)', () => {
  it('marca incompleto si no hay pruebas', () => {
    expect(getEventCompleteness([])).toBe('incomplete')
    expect(getEventCompletenessLabel([])).toBe('Expediente incompleto')
  })

  it('marca incompleto si alguna prueba sigue pendiente', () => {
    expect(
      getEventCompleteness([
        { status: 'COMPLETED' },
        { status: 'SAMPLE_TAKEN' },
      ]),
    ).toBe('incomplete')
  })

  it('marca completo si todas las pruebas están resueltas', () => {
    expect(
      getEventCompleteness([
        { status: 'COMPLETED' },
        { status: 'RESULT_REGISTERED' },
        { status: 'SKIPPED' },
      ]),
    ).toBe('complete')
    expect(getEventCompletenessLabel([
      { status: 'COMPLETED' },
      { status: 'CANCELLED' },
    ])).toBe('Expediente completo')
  })

  it('isEventTestResolved distingue pendiente vs resuelto', () => {
    expect(isEventTestResolved('PENDING')).toBe(false)
    expect(isEventTestResolved('IN_PROGRESS')).toBe(false)
    expect(isEventTestResolved('SAMPLE_TAKEN')).toBe(false)
    expect(isEventTestResolved('RESULT_REGISTERED')).toBe(true)
    expect(isEventTestResolved('COMPLETED')).toBe(true)
    expect(isEventTestResolved('SKIPPED')).toBe(true)
    expect(isEventTestResolved('CANCELLED')).toBe(true)
  })
})
