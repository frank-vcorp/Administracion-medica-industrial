import { describe, expect, it } from 'vitest'
import { resolveUmmTheoreticalDurationMinutes } from '@/lib/medical-test-duration-seed'
import {
  calculateProfileDuration,
  formatMinutesLabel,
  resolveEffectiveProfileDuration,
} from '@/lib/profile-duration'

describe('resolveUmmTheoreticalDurationMinutes', () => {
  it('asigna límites superiores y tiempos exactos de la tabla UMM', () => {
    expect(resolveUmmTheoreticalDurationMinutes('GEN-015', 'EXAMEN MEDICO')).toBe(30)
    expect(resolveUmmTheoreticalDurationMinutes('GEN-EM-SOD', 'Examen Médico Sodexo')).toBe(30)
    expect(resolveUmmTheoreticalDurationMinutes('GEN-012', 'ELECTROCARDIOGRAMA')).toBe(25)
    expect(resolveUmmTheoreticalDurationMinutes('GEN-013', 'ESPIROMETRIA')).toBe(15)
    expect(resolveUmmTheoreticalDurationMinutes('GEN-003', 'AUDIOMETRIA')).toBe(15)
    expect(resolveUmmTheoreticalDurationMinutes('GEN-004', 'CAMPIMETRIA')).toBe(15)
    expect(
      resolveUmmTheoreticalDurationMinutes('IMG-002', 'RX DE COLUMNA LUMBOSACRA AP Y LATERAL'),
    ).toBe(10)
    expect(resolveUmmTheoreticalDurationMinutes('IMG-012', 'TELE DE TORAX')).toBe(10)
    expect(resolveUmmTheoreticalDurationMinutes('IMG-013', 'RX DE TORAX AP Y LAT')).toBe(10)
  })

  it('deja en null pruebas sin tiempo definido en el PDF (incluyendo variante con broncodilatador y lab)', () => {
    expect(
      resolveUmmTheoreticalDurationMinutes('GEN-014', 'ESPIROMETRIA CON BRONCODILATADOR'),
    ).toBeNull()
    expect(resolveUmmTheoreticalDurationMinutes('LAB-010', 'BIOMETRIA HEMATICA COMPLETA')).toBeNull()
    expect(resolveUmmTheoreticalDurationMinutes('GEN-009', 'CONSULTA MÉDICA')).toBeNull()
  })
})

describe('calculateProfileDuration', () => {
  it('aplica Mesa de Control +5 min en modo AUTO cuando incluye Espiro/Audio/RX junto con Examen Médico', () => {
    const res = calculateProfileDuration({
      tests: [
        { code: 'GEN-015', name: 'EXAMEN MEDICO', theoreticalDurationMinutes: 30 },
        { code: 'GEN-013', name: 'ESPIROMETRIA', theoreticalDurationMinutes: 15 },
        { code: 'GEN-003', name: 'AUDIOMETRIA', theoreticalDurationMinutes: 15 },
        { code: 'IMG-013', name: 'RX DE TORAX AP Y LAT', theoreticalDurationMinutes: 10 },
      ],
      controlDeskMode: 'AUTO',
    })

    expect(res.testsMinutes).toBe(70)
    expect(res.resolvedControlDeskMode).toBe('CONTROL_5')
    expect(res.controlDeskMinutes).toBe(5)
    expect(res.calculatedDurationMinutes).toBe(75)
    expect(res.effectiveDurationMinutes).toBe(75)
    expect(res.isManualOverride).toBe(false)
  })

  it('aplica Mesa de Control +10 min en modo AUTO cuando incluye Espiro/Audio/RX SIN Examen Médico', () => {
    const res = calculateProfileDuration({
      tests: [
        { code: 'GEN-013', name: 'ESPIROMETRIA', theoreticalDurationMinutes: 15 },
        { code: 'GEN-003', name: 'AUDIOMETRIA', theoreticalDurationMinutes: 15 },
      ],
      controlDeskMode: 'AUTO',
    })

    expect(res.testsMinutes).toBe(30)
    expect(res.resolvedControlDeskMode).toBe('CONTROL_10')
    expect(res.controlDeskMinutes).toBe(10)
    expect(res.calculatedDurationMinutes).toBe(40)
  })

  it('aplica 0 min de Mesa de Control si no incluye Espiro, Audio ni RX', () => {
    const res = calculateProfileDuration({
      tests: [
        { code: 'GEN-015', name: 'EXAMEN MEDICO', theoreticalDurationMinutes: 30 },
        { code: 'LAB-001', name: 'BIOMETRIA HEMATICA', theoreticalDurationMinutes: null },
      ],
      controlDeskMode: 'AUTO',
    })

    expect(res.testsMinutes).toBe(30)
    expect(res.undefinedTestsCount).toBe(1)
    expect(res.resolvedControlDeskMode).toBe('NONE')
    expect(res.controlDeskMinutes).toBe(0)
    expect(res.calculatedDurationMinutes).toBe(30)
  })

  it('suma proyecciones RX extra (+5 min c/u) y respeta override manual manteniendo cálculo automático', () => {
    const res = calculateProfileDuration({
      tests: [
        { code: 'GEN-015', name: 'EXAMEN MEDICO', theoreticalDurationMinutes: 30 },
        { code: 'IMG-002', name: 'RX DE COLUMNA LUMBOSACRA AP Y LATERAL', theoreticalDurationMinutes: 10 },
      ],
      controlDeskMode: 'CONTROL_10',
      extraRxProjections: 2,
      durationOverrideMinutes: 65,
    })

    expect(res.testsMinutes).toBe(40)
    expect(res.controlDeskMinutes).toBe(10)
    expect(res.extraRxMinutes).toBe(10)
    expect(res.calculatedDurationMinutes).toBe(60)
    expect(res.effectiveDurationMinutes).toBe(65)
    expect(res.isManualOverride).toBe(true)
  })

  it('resolveEffectiveProfileDuration y formatMinutesLabel', () => {
    expect(
      resolveEffectiveProfileDuration({
        calculatedDurationMinutes: 75,
        durationOverrideMinutes: null,
      }),
    ).toBe(75)
    expect(
      resolveEffectiveProfileDuration({
        calculatedDurationMinutes: 75,
        durationOverrideMinutes: 50,
      }),
    ).toBe(50)
    expect(formatMinutesLabel(75)).toBe('75 min (1 h 15 min)')
    expect(formatMinutesLabel(45)).toBe('45 min')
    expect(formatMinutesLabel(null)).toBe('Sin definir')
  })
})
