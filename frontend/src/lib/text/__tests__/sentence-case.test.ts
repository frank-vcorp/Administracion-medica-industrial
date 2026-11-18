import { describe, expect, it } from 'vitest'
import {
  applyProperNameCase,
  applySentenceCase,
  applySentenceCaseIfAllCaps,
  isAllCapsUserText,
} from '@/lib/text/sentence-case'

describe('isAllCapsUserText', () => {
  it('detecta MAYÚSCULAS con acentos', () => {
    expect(isAllCapsUserText('DOLOR DE CABEZA')).toBe(true)
    expect(isAllCapsUserText('MARÍA')).toBe(true)
  })

  it('ignora cadenas mixtas o minúsculas', () => {
    expect(isAllCapsUserText('Dolor de cabeza')).toBe(false)
    expect(isAllCapsUserText('McDonald')).toBe(false)
    expect(isAllCapsUserText('Covid-19')).toBe(false)
  })

  it('trata acrónimo todo en mayúsculas como convertible', () => {
    expect(isAllCapsUserText('COVID-19')).toBe(true)
    expect(applySentenceCaseIfAllCaps('COVID-19')).toBe('Covid-19')
  })

  it('ignora solo números o vacío', () => {
    expect(isAllCapsUserText('120/80')).toBe(false)
    expect(isAllCapsUserText('')).toBe(false)
  })
})

describe('applySentenceCase', () => {
  it('convierte MAYÚSCULAS y mixtas a oración', () => {
    expect(applySentenceCase('DOLOR DE CABEZA')).toBe('Dolor de cabeza')
    expect(applySentenceCase('hello WORLD')).toBe('Hello world')
    expect(applySentenceCase('  MARÍA GÓMEZ  ')).toBe('  María gómez  ')
  })

  it('deja texto ya en modo oración', () => {
    expect(applySentenceCase('Dolor de cabeza')).toBe('Dolor de cabeza')
  })

  it('capitaliza tras prefijo no alfabético', () => {
    expect(applySentenceCase('123 ABC')).toBe('123 Abc')
  })

  it('es idempotente', () => {
    const once = applySentenceCase('dOLOR Mixto')
    expect(applySentenceCase(once)).toBe(once)
  })

  it('respeta códigos CIE-10 y ciudades mexicanas conocidas en texto clínico', () => {
    expect(applySentenceCase('DIAGNÓSTICO J45.0 EN QUERÉTARO')).toBe(
      'Diagnóstico J45.0 en Querétaro',
    )
    expect(applySentenceCase('Paciente procedente de san luis potosí con E11.9')).toBe(
      'Paciente procedente de San Luis Potosí con E11.9',
    )
    expect(applySentenceCase('Paciente Juan Pérez atendido en Ciudad de México')).toBe(
      'Paciente Juan Pérez atendido en Ciudad de México',
    )
  })
})

describe('applyProperNameCase', () => {
  it('capitaliza nombres propios y apellidos conservando partículas en minúscula', () => {
    expect(applyProperNameCase('JUAN CARLOS PÉREZ DE LA CRUZ')).toBe(
      'Juan Carlos Pérez de la Cruz',
    )
    expect(applyProperNameCase('  MARÍA GÓMEZ  ')).toBe('  María Gómez  ')
    expect(applyProperNameCase('DR. JUAN PÉREZ')).toBe('Dr. Juan Pérez')
  })

  it('capitaliza ciudades y domicilios correctamente', () => {
    expect(applyProperNameCase('SANTIAGO DE QUERÉTARO, QUERÉTARO')).toBe(
      'Santiago de Querétaro, Querétaro',
    )
    expect(applyProperNameCase('SAN LUIS POTOSÍ')).toBe('San Luis Potosí')
    expect(applyProperNameCase('AV. REFORMA 123, COL. CENTRO, CIUDAD DE MÉXICO')).toBe(
      'Av. Reforma 123, Col. Centro, Ciudad de México',
    )
  })

  it('es idempotente', () => {
    const once = applyProperNameCase('santiago de querétaro, querétaro')
    expect(once).toBe('Santiago de Querétaro, Querétaro')
    expect(applyProperNameCase(once)).toBe(once)
  })
})

describe('applySentenceCaseIfAllCaps (legado)', () => {
  it('convierte solo todo MAYÚSCULAS', () => {
    expect(applySentenceCaseIfAllCaps('DOLOR DE CABEZA')).toBe('Dolor de cabeza')
    expect(applySentenceCaseIfAllCaps('  MARÍA GÓMEZ  ')).toBe('  María gómez  ')
  })

  it('no altera texto mixto', () => {
    expect(applySentenceCaseIfAllCaps('iPhone')).toBe('iPhone')
    expect(applySentenceCaseIfAllCaps('Dolor leve')).toBe('Dolor leve')
    expect(applySentenceCaseIfAllCaps('  mixto Case')).toBe('  mixto Case')
  })
})
