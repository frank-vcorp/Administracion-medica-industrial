import { describe, expect, it } from 'vitest'
import {
  BUSINESS_STATUS_LABELS,
  formatStudyStatusLine,
  getOperationalDetail,
  toBusinessStudyStatus,
} from '../study-status-display'

describe('study-status-display (DEC-20260907-01)', () => {
  it('mapea pipeline pendiente a estatus de negocio Pendiente', () => {
    expect(toBusinessStudyStatus('PENDING')).toBe('PENDIENTE')
    expect(toBusinessStudyStatus('IN_PROGRESS')).toBe('PENDIENTE')
    expect(toBusinessStudyStatus('SAMPLE_TAKEN')).toBe('PENDIENTE')
  })

  it('mapea resultados y cierre a Realizado', () => {
    expect(toBusinessStudyStatus('RESULT_REGISTERED')).toBe('REALIZADO')
    expect(toBusinessStudyStatus('COMPLETED')).toBe('REALIZADO')
  })

  it('mapea omitido/cancelado a No realizado', () => {
    expect(toBusinessStudyStatus('SKIPPED')).toBe('NO_REALIZADO')
    expect(toBusinessStudyStatus('CANCELLED')).toBe('NO_REALIZADO')
  })

  it('conserva detalle operativo de laboratorio en SAMPLE_TAKEN', () => {
    expect(getOperationalDetail('SAMPLE_TAKEN')).toContain('laboratorio')
    expect(formatStudyStatusLine('SAMPLE_TAKEN')).toBe(
      `${BUSINESS_STATUS_LABELS.PENDIENTE} · Muestra tomada · esperando laboratorio`,
    )
  })

  it('PENDING no agrega subtexto operativo', () => {
    expect(getOperationalDetail('PENDING')).toBeNull()
    expect(formatStudyStatusLine('PENDING')).toBe('Pendiente')
  })
})
