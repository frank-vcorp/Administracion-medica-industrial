import { describe, expect, it } from 'vitest'
import {
  formatHoraAtencionFromEvent,
  resolveCertificadoMedicoMetadata,
} from '@/lib/clinical/certificado-medico-metadata'
import { DEFAULT_LUGAR_EXPEDICION } from '@/schemas/clinical/certificado-medico.schema'

describe('resolveCertificadoMedicoMetadata', () => {
  it('aplica defaults y expediente del worker', () => {
    const meta = resolveCertificadoMedicoMetadata({
      workerNationalId: 'CURP123',
      doctorFullName: 'Dra. Ana López',
      doctorLicense: '1234567',
      eventAt: new Date('2026-11-11T15:30:00.000Z'),
    })
    expect(meta.lugar_expedicion).toBe(DEFAULT_LUGAR_EXPEDICION)
    expect(meta.identificacion_folio).toBe('CURP123')
    expect(meta.identificacion_tipo).toBe('INE')
    expect(meta.medico_nombre).toBe('Dra. Ana López')
    expect(meta.medico_cedula).toBe('1234567')
    expect(meta.hora_atencion).toBeTruthy()
  })

  it('formatHoraAtencionFromEvent usa zona México', () => {
    const h = formatHoraAtencionFromEvent(new Date('2026-06-15T18:00:00.000Z'))
    expect(h).toMatch(/^\d{2}:\d{2}$/)
  })
})
