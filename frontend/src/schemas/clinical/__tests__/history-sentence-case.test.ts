import { describe, expect, it } from 'vitest'
import {
  ClinicalHistoryDataSchema,
  DetalleTripleSchema,
  HeredoFamiliaresSchema,
} from '@/schemas/clinical/history.schema'
import { z } from 'zod'
import { applySentenceCase } from '@/lib/text/sentence-case'

describe('ClinicalHistoryDataSchema — modo oración (SME-108)', () => {
  it('normaliza texto libre en datos personales y laborales', () => {
    const parsed = ClinicalHistoryDataSchema.parse({
      datos_personales: { puesto_actual: 'OPERADOR DE GRÚA' },
      historia_laboral: { accidentes_descripcion: 'CAÍDA DE ESCALERA' },
    })
    expect(parsed.datos_personales?.puesto_actual).toBe('Operador de grúa')
    expect(parsed.historia_laboral?.accidentes_descripcion).toBe('Caída de escalera')
  })

  it('conserva códigos ZIN en heredo-familiares sin transformar', () => {
    const parsed = HeredoFamiliaresSchema.parse({
      diabetes: 'PADRE MA',
      diabetes_especifique: 'TIPO 2',
    })
    expect(parsed.diabetes).toBe('PADRE MA')
    expect(parsed.diabetes_especifique).toBe('Tipo 2')
  })
})

describe('DetalleTripleSchema — detalle patológico', () => {
  it('normaliza observaciones en MAYÚSCULAS', () => {
    const parsed = DetalleTripleSchema.parse({
      observaciones: 'DOLOR CRÓNICO LUMBAR',
    })
    expect(parsed.observaciones).toBe('Dolor crónico lumbar')
  })
})

describe('certificado — integración diagnóstica (VI)', () => {
  const integracionField = z
    .string()
    .trim()
    .max(4000)
    .transform(applySentenceCase)

  it('normaliza mezcla de mayúsculas al persistir', () => {
    expect(integracionField.parse('hOLA COMO ESTAS')).toBe('Hola como estas')
  })
})
