import { describe, expect, it } from 'vitest'
import { CertificadoMedicoPayloadSchema } from '@/schemas/clinical/certificado-medico.schema'

const basePayload = {
  schemaVersion: 'certificado-medico-v1' as const,
  lugar_expedicion: 'Santiago de Querétaro, Querétaro',
  medico_nombre: 'Dr. Juan Pérez',
  medico_cedula: '1234567',
  signos_vitales: {},
  dictamen_laboral: 'APTO' as const,
}

describe('CertificadoMedicoPayloadSchema — modo oración (SME-108)', () => {
  it('normaliza exploración física (V) y integración diagnóstica (VI)', () => {
  const parsed = CertificadoMedicoPayloadSchema.parse({
    ...basePayload,
    exploracion_fisica: 'PACIENTE EN BUEN ESTADO GENERAL',
    integracion_diagnostica: 'hOLA COMO ESTAS',
    dictamen_laboral_texto: 'APTO PARA LABORES',
  })
  expect(parsed.exploracion_fisica).toBe('Paciente en buen estado general')
  expect(parsed.integracion_diagnostica).toBe('Hola como estas')
  expect(parsed.dictamen_laboral_texto).toBe('Apto para labores')
  expect(parsed.lugar_expedicion).toBe('Santiago de Querétaro, Querétaro')
  expect(parsed.medico_nombre).toBe('Dr. Juan Pérez')
  })

  it('conserva nombres propios, domicilio y lugar de expedición con mayúsculas iniciales', () => {
    const parsed = CertificadoMedicoPayloadSchema.parse({
      ...basePayload,
      lugar_expedicion: 'SAN LUIS POTOSÍ, SAN LUIS POTOSÍ',
      domicilio_atencion: 'AV. REFORMA 123, COL. CENTRO, QUERÉTARO',
      medico_nombre: 'DRA. ERIKA RODRÍGUEZ LÓPEZ',
      medico_universidad: 'UNIVERSIDAD AUTÓNOMA DE QUERÉTARO',
      exploracion_fisica: 'Paciente consciente y orientado en Querétaro.',
      integracion_diagnostica: 'Sin datos patológicos, diagnóstico J45.0 estable.',
      dictamen_laboral_texto: 'Apto para actividades laborales.',
    })
    expect(parsed.lugar_expedicion).toBe('San Luis Potosí, San Luis Potosí')
    expect(parsed.domicilio_atencion).toBe('Av. Reforma 123, Col. Centro, Querétaro')
    expect(parsed.medico_nombre).toBe('Dra. Erika Rodríguez López')
    expect(parsed.medico_universidad).toBe('Universidad Autónoma de Querétaro')
    expect(parsed.integracion_diagnostica).toBe('Sin datos patológicos, diagnóstico J45.0 estable.')
  })
})
