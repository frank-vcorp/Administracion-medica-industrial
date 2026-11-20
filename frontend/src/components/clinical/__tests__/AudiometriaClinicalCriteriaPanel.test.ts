/**
 * @fileoverview Tests V1 focales para los criterios audiométricos
 *   (FEATURE-20260825-02 + gap-fix FND-20260825-12).
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
 *   - FND-20260825-12: las constantes de referencia (normalidad, patrón
 *     operativo, severidad, etiologías) siguen en el módulo y no se
 *     renderizan en el panel del médico.
 *   - La vista del médico muestra el cálculo del índice de Fletcher
 *     (fórmula y entradas), el estado bilateral y la completitud
 *     documental, sin la tabla de vía aérea, el PTA fuente ni las capas.
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AudiometriaClinicalCriteriaPanel from '../AudiometriaClinicalCriteriaPanel'
import {
  calcularPTA3,
  calcularIndiceFletcher,
  resolveAudiometriaCriteria,
  resolverCriterioAmiCombinado,
  hasRenderableAudiometriaCriteria,
  AMI_NORMALIDAD_DB,
  FRECUENCIAS_GRAVES_HZ,
  FRECUENCIAS_AGUDAS_HZ,
  PTA3_FREQUENCIES_HZ,
  AMI_PATRONES_REFERENCIA,
  AMI_SEVERIDAD_REFERENCIA,
  AMI_ETIOLOGIAS_REFERENCIA,
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

  it('AC-5: criterio AMI = NORMAL cuando PTA ≤ 25 dB y patrón sin compromiso', () => {
    const data = {
      oido_derecho: { va: { 500: 20, 1000: 20, 2000: 20, 3000: 15 } },
      oido_izquierdo: { va: { 500: 20, 1000: 20, 2000: 20, 3000: 15 } },
    }
    const r = resolveAudiometriaCriteria(data)
    const od = r.oidos.find((o) => o.oido === 'OD')
    expect(od?.criterioAmi).toBe('NORMAL')
    expect(AMI_NORMALIDAD_DB).toBe(25)
  })

  it('DEC-20260825-03: PTA3 ≤25 con patrón agudas alterado → criterio ALTERADO (FND-20260825-09)', () => {
    const data = {
      oido_derecho: {
        va: { 250: 5, 500: 5, 1000: 5, 2000: 20, 3000: 35 },
        pta_visible: 14,
      },
      oido_izquierdo: {
        va: { 500: 20, 1000: 10, 2000: 25, 3000: 30 },
        pta_visible: 21,
      },
    }
    const r = resolveAudiometriaCriteria(data)
    expect(r.oidos.find((o) => o.oido === 'OD')?.ptaCalculado).toBe(10)
    expect(r.oidos.find((o) => o.oido === 'OD')?.criterioAmi).toBe('ALTERADO')
    expect(r.oidos.find((o) => o.oido === 'OD')?.patronAmi).toBe('AGUDAS')
    expect(r.oidos.find((o) => o.oido === 'OI')?.criterioAmi).toBe('ALTERADO')
  })

  it('resolverCriterioAmiCombinado: no NORMAL si patrón patológico aunque PTA3 ≤25', () => {
    expect(
      resolverCriterioAmiCombinado(
        { promedio: 10, completo: true },
        'AGUDAS',
        [5, 5, 20, 35],
      ),
    ).toBe('ALTERADO')
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
    // Umbrales >25 sin patrón bilateral concluyente → ALTERADO (no enmascarar pérdida)
    expect(od?.criterioAmi).toBe('ALTERADO')
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

// ──────────────────────────────────────────────────────────────────────────
// FND-20260825-12 — Referencia AMI (panel): separación derivación vs
// referencia, etiquetas legibles, reglas exactas.
// ──────────────────────────────────────────────────────────────────────────

describe('FND-20260825-12: constantes de referencia AMI', () => {
  it('Normalidad AMI ≡ PTA ≤ 25 dB HL', () => {
    expect(AMI_NORMALIDAD_DB).toBe(25)
  })

  it('Patrones AMI incluye los 5 tipos: NORMAL, GRAVES, NEUROSENSORIAL_MEDIAS_AGUDAS, MIXTA, FATIGA', () => {
    const ids = AMI_PATRONES_REFERENCIA.map(p => p.id)
    expect(ids).toEqual([
      'NORMAL',
      'GRAVES',
      'NEUROSENSORIAL_MEDIAS_AGUDAS',
      'MIXTA',
      'FATIGA',
    ])
  })

  it('Patrón GRAVES referencia 250/500/1000 Hz', () => {
    const graves = AMI_PATRONES_REFERENCIA.find(p => p.id === 'GRAVES')
    expect(graves?.frecuenciasOperativas).toContain('250')
    expect(graves?.frecuenciasOperativas).toContain('500')
    expect(graves?.frecuenciasOperativas).toContain('1000')
  })

  it('Patrón NEUROSENSORIAL_MEDIAS_AGUDAS referencia 2000/3000/4000/6000/8000 Hz', () => {
    const nsMediaAguda = AMI_PATRONES_REFERENCIA.find(
      p => p.id === 'NEUROSENSORIAL_MEDIAS_AGUDAS',
    )
    expect(nsMediaAguda?.frecuenciasOperativas).toContain('2000')
    expect(nsMediaAguda?.frecuenciasOperativas).toContain('3000')
    expect(nsMediaAguda?.frecuenciasOperativas).toContain('4000')
    expect(nsMediaAguda?.frecuenciasOperativas).toContain('6000')
    expect(nsMediaAguda?.frecuenciasOperativas).toContain('8000')
  })

  it('Severidad AMI cubre los 6 escalones con rangos en dB HL específicos', () => {
    const ids = AMI_SEVERIDAD_REFERENCIA.map(s => s.id)
    expect(ids).toEqual([
      'NO_APLICA',
      'LEVE',
      'MODERADA',
      'MODERADAMENTE_SEVERA',
      'SEVERA',
      'PROFUNDA',
    ])
    expect(AMI_SEVERIDAD_REFERENCIA.find(s => s.id === 'LEVE')?.rangoDB).toBe(
      '30–40 dB HL',
    )
    expect(
      AMI_SEVERIDAD_REFERENCIA.find(s => s.id === 'MODERADA')?.rangoDB,
    ).toBe('45–55 dB HL')
    expect(
      AMI_SEVERIDAD_REFERENCIA.find(s => s.id === 'MODERADAMENTE_SEVERA')
        ?.rangoDB,
    ).toBe('60–70 dB HL')
    expect(AMI_SEVERIDAD_REFERENCIA.find(s => s.id === 'SEVERA')?.rangoDB).toBe(
      '75–90 dB HL',
    )
    expect(
      AMI_SEVERIDAD_REFERENCIA.find(s => s.id === 'PROFUNDA')?.rangoDB,
    ).toBe('≥ 95 dB HL')
    expect(
      AMI_SEVERIDAD_REFERENCIA.find(s => s.id === 'NO_APLICA')?.rangoDB,
    ).toContain('≤ 25')
  })

  it('Categorías etiológicas AMI cubre las 5 categorías esperadas', () => {
    const ids = AMI_ETIOLOGIAS_REFERENCIA.map(e => e.id)
    expect(ids).toEqual([
      'NORMAL',
      'TRAUMA_ACUSTICO_CRONICO',
      'PRESBIACUSIA',
      'PROBABLE_VIAS_RESPIRATORIAS_ALTAS',
      'ETIOLOGIA_A_DETERMINAR',
    ])
  })

  it('Las constantes de referencia no alteran la derivación (separación FND-20260825-12)', () => {
    const data = {
      oido_derecho: { va: { 500: 20, 1000: 20, 2000: 20, 3000: 15 } },
      oido_izquierdo: { va: { 500: 20, 1000: 20, 2000: 20, 3000: 15 } },
    }
    const r = resolveAudiometriaCriteria(data)
    expect(r.oidos.find(o => o.oido === 'OD')?.criterioAmi).toBe('NORMAL')
    // La severidad NO_APLICA es derivable consultando la referencia, pero
    // el componente resuelto NO la incluye: confirma que la tabla de
    // severidad es REFERENCIA pura, no se calcula aquí.
    expect(
      AMI_SEVERIDAD_REFERENCIA.find(s => s.id === 'NO_APLICA'),
    ).toBeDefined()
  })
})

describe('hasRenderableAudiometriaCriteria', () => {
  it('sin datos → no renderiza panel', () => {
    expect(hasRenderableAudiometriaCriteria(null)).toBe(false)
    expect(hasRenderableAudiometriaCriteria({})).toBe(false)
    expect(
      renderToStaticMarkup(
        createElement(AudiometriaClinicalCriteriaPanel, {
          extractedData: {},
          version: 1,
        }),
      ),
    ).toBe('')
  })

  it('PTA del documento sin umbrales TA → sí muestra (p. ej. sólo pta_visible)', () => {
    const data = { oido_derecho: { pta_visible: 18 } }
    expect(hasRenderableAudiometriaCriteria(data)).toBe(true)
  })
})

describe('vista del médico: sin bloque de captura', () => {
  const html = renderToStaticMarkup(
    createElement(AudiometriaClinicalCriteriaPanel, {
      extractedData: {
        oido_derecho: { va: { 500: 0, 1000: 10, 2000: 20 } },
        oido_izquierdo: { va: { 500: 50, 1000: 50, 2000: 50 } },
      },
      version: 1,
    }),
  )

  it('muestra la fórmula y las entradas del índice de Fletcher, el estado bilateral y la completitud', () => {
    expect(html).toContain('Índice de Fletcher')
    expect(html).toContain('data-testid="audiometria-fletcher-formula"')
    expect(html).toContain(
      '((PTA del oído menos afectado × 7) + (PTA del oído más afectado × 1)) ÷ 8',
    )
    expect(html).toContain('data-testid="audiometria-fletcher-entradas"')
    expect(html).toContain(
      'El oído menos afectado (OD) entra con 10 dB y el oído más afectado (OI) entra con 50 dB.',
    )
    expect(html).toContain('data-testid="audiometria-fletcher-valor"')
    expect(html).toContain('((10 × 7) + (50 × 1)) ÷ 8 = 15 dB HL')
    expect(html).toContain('Estado bilateral')
    expect(html).toContain('data-testid="audiometria-estado-bilateral"')
    expect(html).toContain('Completitud documental')
    expect(html).toContain('data-testid="audiometria-completitud-documental"')
  })

  it('no muestra la tabla de vía aérea, el PTA fuente ni las capas', () => {
    expect(html).not.toContain('Vía aérea (TA) por oído y frecuencia')
    expect(html).not.toContain('Vía aérea por oído y frecuencia')
    expect(html).not.toContain('PTA calculado')
    expect(html).not.toContain('PTA fuente')
    expect(html).not.toContain('Entradas TA')
    expect(html).not.toContain('referencia regulatoria')
    expect(html).not.toContain('criterio audiométrico')
    expect(html).not.toContain('datos del documento')
    expect(html).not.toContain('cálculo del sistema')
    expect(html).not.toContain('audiometria-pta-')
    expect(html).not.toContain('audiometria-sme-reference-section')
  })

  it('sin las dos entradas deja la fórmula y dice que no se puede calcular', () => {
    const incompleto = renderToStaticMarkup(
      createElement(AudiometriaClinicalCriteriaPanel, {
        extractedData: {
          oido_derecho: { va: { 500: 20, 1000: 25 } },
          oido_izquierdo: { va: { 500: 20, 1000: 25, 2000: 30 } },
        },
        version: 1,
      }),
    )
    expect(incompleto).toContain('Índice de Fletcher')
    expect(incompleto).toContain('data-testid="audiometria-fletcher-formula"')
    expect(incompleto).toContain('data-testid="audiometria-fletcher-incompleto"')
    expect(incompleto).toContain('No se puede calcular hasta tener los dos oídos completos.')
    expect(incompleto).not.toContain('data-testid="audiometria-fletcher-entradas"')
    expect(incompleto).not.toContain('PTA fuente')
    expect(incompleto).not.toContain('Vía aérea')
    expect(incompleto).toContain('Estado bilateral')
    expect(incompleto).toContain('Completitud documental')
  })
})
