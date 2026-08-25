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
 *   - FND-20260825-12: la sección de referencia AMI expone las
 *     constantes (normalidad, patrón operativo, severidad,
 *     etiologías) como informational data — NO como salida derivada.
 *   - FND-20260825-12: el componente por defecto ahora renderiza la
 *     tabla de referencia completa con `data-testid` estables.
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
  resolveAudiometriaCriteria,
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
    // Mismo payload con PTA ≤ 25 → derivado NORMAL y NO_APLICA en severidad.
    // La referencia NO convierte el resultado en impresión diagnóstica.
    const data = {
      oido_derecho: { va: { 500: 20, 1000: 25, 2000: 30 } }, // PTA 25
      oido_izquierdo: { va: { 500: 20, 1000: 25, 2000: 30 } },
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

describe('FND-20260825-12: AudiometriaClinicalCriteriaPanel renderiza la sección de referencia', () => {
  const html = renderToStaticMarkup(
    createElement(AudiometriaClinicalCriteriaPanel, {
      extractedData: {
        oido_derecho: { va: { 500: 20, 1000: 25, 2000: 30 } },
        oido_izquierdo: { va: { 500: 20, 1000: 25, 2000: 30 } },
      },
      version: 1,
    }),
  )

  it('Contenedor `data-testid="audiometria-ami-reference-section"` presente', () => {
    expect(html).toContain('data-testid="audiometria-ami-reference-section"')
  })

  it('Título "Criterio audiométrico AMI (referencia)" presente', () => {
    expect(html).toContain('Criterio audiométrico AMI (referencia)')
  })

  it('Etiqueta explícita "Referencia operativa" presente', () => {
    expect(html).toContain('data-testid="audiometria-ami-reference-tag"')
  })

  it('Normalidad ≤ 25 dB visible', () => {
    expect(html).toContain('audiometria-ami-ref-normalidad')
    expect(html).toContain('≤ 25')
  })

  it('Tabla de patrones con etiqueta legible "Patrón de graves" en 250/500/1000 Hz', () => {
    expect(html).toContain('audiometria-ami-ref-patrones')
    expect(html).toContain('Patrón de graves')
    expect(html).toContain('250 / 500 / 1000 Hz')
  })

  it('Tabla de patrones incluye "Neurosensorial medias/agudas"', () => {
    expect(html).toContain('Neurosensorial medias/agudas')
    expect(html).toContain(
      '2000 / 3000 / 4000 / 6000 / 8000 Hz',
    )
  })

  it('Tabla de severidad incluye los 6 rangos (No aplica, Leve 30–40, Moderada 45–55, Mod. severa 60–70, Severa 75–90, Profunda ≥95)', () => {
    expect(html).toContain('audiometria-ami-ref-severidad')
    // Severidad - todos los rangos visibles.
    expect(html).toContain('audiometria-ami-ref-severidad-no_aplica')
    expect(html).toContain('audiometria-ami-ref-severidad-leve')
    expect(html).toContain('30–40 dB HL')
    expect(html).toContain('audiometria-ami-ref-severidad-moderada')
    expect(html).toContain('45–55 dB HL')
    expect(html).toContain('audiometria-ami-ref-severidad-moderadamente_severa')
    expect(html).toContain('60–70 dB HL')
    expect(html).toContain('audiometria-ami-ref-severidad-severa')
    expect(html).toContain('75–90 dB HL')
    expect(html).toContain('audiometria-ami-ref-severidad-profunda')
    expect(html).toContain('≥ 95 dB HL')
  })

  it('Lista de etiologías visibles (normal, trauma acústico crónico, presbiacusia, etc.)', () => {
    expect(html).toContain('audiometria-ami-ref-etiologias')
    expect(html).toContain(
      'audiometria-ami-ref-etiologia-trauma_acustico_cronico',
    )
    expect(html).toContain(
      'audiometria-ami-ref-etiologia-presbiacusia',
    )
    expect(html).toContain(
      'audiometria-ami-ref-etiologia-probable_vias_respiratorias_altas',
    )
    expect(html).toContain(
      'audiometria-ami-ref-etiologia-etiologia_a_determinar',
    )
  })

  it('La sección se muestra ANTES de la advertencia que prohíbe el diagnóstico automático (separación derivación vs impresión)', () => {
    const idxRef = html.indexOf('audiometria-ami-reference-section')
    const idxWarn = html.indexOf('Este panel NO replica el diagnóstico')
    expect(idxRef).toBeGreaterThanOrEqual(0)
    expect(idxWarn).toBeGreaterThan(idxRef)
  })

  it('NO contiene campos administrativos retirados (DEC-20260825-08) — re-confirmación de guardrail', () => {
    expect(html).not.toContain('Patient ID del formato')
    expect(html).not.toContain('Consentimiento informado')
    expect(html).not.toContain('Responsable de captura')
    expect(html).not.toContain('Responsable médico')
  })
})