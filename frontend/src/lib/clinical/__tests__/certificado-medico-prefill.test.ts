import { describe, expect, it } from 'vitest'
import {
  inheritAgudezaForCertificado,
  mergeCertificadoSignosPrefill,
  prefillCertificadoPatientFields,
} from '@/lib/clinical/certificado-medico-prefill'

describe('mergeCertificadoSignosPrefill', () => {
  it('hereda somatometría sin pisar valores ya capturados', () => {
    const merged = mergeCertificadoSignosPrefill(
      { peso_kg: '72', talla_m: '', ta_sistolica: '', ta_diastolica: '', fc_min: '', fr_min: '', temperatura: '', spo2_pct: '', imc: '', complexion: '', agudeza_vl: '', agudeza_vlc: '', agudeza_vc: '', agudeza_vcc: '' },
      { peso_kg: '70', talla_m: '1.70', ta_sistolica: '120', ta_diastolica: '80' },
      null,
    )
    expect(merged.peso_kg).toBe('72')
    expect(merged.talla_m).toBe('1.70')
    expect(merged.ta_sistolica).toBe('120')
  })
})

describe('inheritAgudezaForCertificado', () => {
  it('formatea pares OD/OI', () => {
    const agu = inheritAgudezaForCertificado({
      vision_lejana_od: '20/20',
      vision_lejana_oi: '20/25',
    })
    expect(agu.agudeza_vl).toContain('20/20')
    expect(agu.agudeza_vl).toContain('20/25')
  })
})

describe('prefillCertificadoPatientFields', () => {
  it('usa CURP del worker si no hay folio en certificado', () => {
    const p = prefillCertificadoPatientFields({
      workerNationalId: 'CURP123',
      longitudinalData: null,
    })
    expect(p.identificacion_folio).toBe('CURP123')
  })
})
