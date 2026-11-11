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
  })
})
