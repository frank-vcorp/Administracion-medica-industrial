/**
 * @fileoverview Tests V1 focales para los criterios audiométricos
 *   (FEATURE-20260825-02).
 *
 * Verifica:
 *   - Cálculo de PTA3 = (TA500+TA1000+TA2000)/3 cuando los 3 componentes
 *     están presentes.
 *   - Marcado de PTA incompleto cuando falta alguno de los 3 componentes.
 *   - Criterio AMI de normalidad ≤ 25 dB (BR-20260825-04).
 *   - Manejo de huecos: cuando faltan umbrales en graves o agudas, la
 *     clasificación se marca NO_CONCLUYENTE.
 *   - `pta_fuente` se conserva por separado del calculado.
 *   - NO se inventan frecuencias: el helper sólo devuelve las que están
 *     realmente presentes en `va`/`vo`.
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */

import { describe, it, expect } from 'vitest'
import {
  calcularPTA3,
  resolveAudiometriaCriteria,
  AMI_NORMALIDAD_DB,
  FRECUENCIAS_GRAVES_HZ,
  FRECUENCIAS_AGUDAS_HZ,
  PTA3_FREQUENCIES_HZ,
} from '../AudiometriaClinicalCriteriaPanel'

describe('calcularPTA3 (helper puro)', () => {
  it('AC-2: PTA3 = (TA500+TA1000+TA2000)/3 cuando los 3 componentes están presentes', () => {
    const r = calcularPTA3({ 500: 20, 1000: 25, 2000: 30 })
    expect(r.completo).toBe(true)
    expect(r.promedio).toBe(25)
    expect(r.valores).toEqual({ 500: 20, 1000: 25, 2000: 30 })
  })

  it('AC-5: PTA incompleto cuando falta TA500', () => {
    const r = calcularPTA3({ 1000: 25, 2000: 30 })
    expect(r.completo).toBe(false)
    expect(r.promedio).toBe(null)
    expect(r.valores[500]).toBe(null)
  })

  it('AC-5: PTA incompleto cuando falta TA2000', () => {
    const r = calcularPTA3({ 500: 20, 1000: 25 })
    expect(r.completo).toBe(false)
    expect(r.promedio).toBe(null)
  })

  it('rango audiométrico: 1000 Hz es frontera — NO se duplica en PTA3', () => {
    expect(PTA3_FREQUENCIES_HZ).toEqual([500, 1000, 2000])
    expect(FRECUENCIAS_GRAVES_HZ).toContain(1000)
    expect(FRECUENCIAS_AGUDAS_HZ).not.toContain(1000)
  })
})

describe('resolveAudiometriaCriteria (helper puro)', () => {
  it('AC-2: NO inventa frecuencias ausentes', () => {
    const data = {
      oido_derecho: { va: { 500: 20, 1000: 25 } },
      oido_izquierdo: { va: { 1000: 25, 2000: 30 } },
    }
    const r = resolveAudiometriaCriteria(data)
    // Sólo 500/1000/2000 aparecen, ninguna otra.
    expect(r.frecuenciasDetectadas).toEqual([500, 1000, 2000])
  })

  it('AC-3: conserva cobertura parcial con 4 frecuencias', () => {
    const data = {
      oido_derecho: {
        va: { 500: 15, 1000: 20, 2000: 25, 4000: 30 },
      },
      oido_izquierdo: {
        va: { 500: 15, 1000: 20, 2000: 25, 4000: 30 },
      },
    }
    const r = resolveAudiometriaCriteria(data)
    // Las 4 frecuencias se conservan sin invención de 3000/6000/8000.
    expect(r.frecuenciasDetectadas).toEqual([500, 1000, 2000, 4000])
    // advertencia de cobertura parcial presente
    expect(r.advertencias.some((a) => a.includes('4 frecuencias'))).toBe(true)
  })

  it('AC-5: criterio AMI = NORMAL cuando PTA ≤ 25 dB', () => {
    const data = {
      oido_derecho: { va: { 500: 20, 1000: 25, 2000: 30 } }, // promedio = 25
      oido_izquierdo: { va: { 500: 20, 1000: 25, 2000: 30 } },
    }
    const r = resolveAudiometriaCriteria(data)
    const od = r.oidos.find((o) => o.oido === 'OD')
    expect(od?.criterioAmi).toBe('NORMAL')
    expect(AMI_NORMALIDAD_DB).toBe(25)
  })

  it('AC-5: criterio AMI = ALTERADO cuando PTA > 25 dB', () => {
    const data = {
      oido_derecho: { va: { 500: 30, 1000: 35, 2000: 40 } }, // promedio = 35
      oido_izquierdo: { va: { 500: 30, 1000: 35, 2000: 40 } },
    }
    const r = resolveAudiometriaCriteria(data)
    const od = r.oidos.find((o) => o.oido === 'OD')
    expect(od?.criterioAmi).toBe('ALTERADO')
  })

  it('AC-5: marca NO_CONCLUYENTE cuando faltan umbrales en graves o agudas', () => {
    const data = {
      // Sólo agudas (2000/4000/8000) — sin graves
      oido_derecho: { va: { 2000: 30, 4000: 40, 8000: 50 } },
      oido_izquierdo: { va: { 2000: 30, 4000: 40, 8000: 50 } },
    }
    const r = resolveAudiometriaCriteria(data)
    const od = r.oidos.find((o) => o.oido === 'OD')
    expect(od?.patronAmi).toBe('NO_CONCLUYENTE')
    expect(od?.criterioAmi).toBe('NO_CONCLUYENTE')
  })

  it('AC-2: `pta_fuente` se conserva por separado del calculado', () => {
    const data = {
      oido_derecho: {
        va: { 500: 20, 1000: 25, 2000: 30 },
        pta_visible: 22, // valor "del documento"
      },
      oido_izquierdo: {
        va: { 500: 20, 1000: 25, 2000: 30 },
        // sin pta_visible → null
      },
    }
    const r = resolveAudiometriaCriteria(data)
    const od = r.oidos.find((o) => o.oido === 'OD')
    const oi = r.oidos.find((o) => o.oido === 'OI')
    expect(od?.ptaCalculado).toBe(25) // calculado (20+25+30)/3 = 25
    expect(od?.ptaFuente).toBe(22) // fuente (visible en formato)
    expect(od?.ptaFuenteOrigen).toBe('documento')
    expect(oi?.ptaFuente).toBe(null)
    expect(oi?.ptaFuenteOrigen).toBe('no_disponible')
  })

  it('AC-10: TA = vía aérea y VO = vía ósea se distinguen en el payload', () => {
    const data = {
      oido_derecho: {
        va: { 500: 20, 1000: 25, 2000: 30 },
        vo: { 500: 15, 1000: 20, 2000: 25 }, // gap audible 5 dB
      },
      oido_izquierdo: {
        va: { 500: 20, 1000: 25, 2000: 30 },
        vo: { 500: 15, 1000: 20, 2000: 25 },
      },
    }
    const r = resolveAudiometriaCriteria(data)
    // PTA se calcula sobre TA, NO sobre VO (BR-20260825-04).
    const od = r.oidos.find((o) => o.oido === 'OD')
    expect(od?.ptaCalculado).toBe(25) // calculado sobre TA, NO sobre VO (15+20+25)/3 ≈ 20
  })
})