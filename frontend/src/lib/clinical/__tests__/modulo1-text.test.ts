import { describe, expect, it } from 'vitest'
import {
  buildHistoriaGinecoText,
  buildHistoriaReproductivaMasculinaText,
  buildHistoriaReproductivaModulo1Text,
  buildInmunizacionesFromPhysicalExam,
  modulo1FromPhysicalExam,
} from '../modulo1-text'

describe('modulo1-text', () => {
  it('lee campos desde physicalExamData.modulo1 anidado', () => {
    const ped = {
      modulo1: {
        m1_repro_doc_prostata: 'Sin datos patológicos',
      },
    }
    expect(modulo1FromPhysicalExam(ped).m1_repro_doc_prostata).toBe('Sin datos patológicos')
    expect(buildHistoriaReproductivaModulo1Text(ped)).toContain('D.O.C. próstata: Sin datos patológicos')
  })

  it('prioriza gineco sobre reproductivos masculinos si ambos existieran', () => {
    const m1 = {
      m1_gine_menarca: '12',
      m1_repro_doc_prostata: 'legacy',
    }
    expect(buildHistoriaReproductivaModulo1Text({ modulo1: m1 })).toContain('Menarca: 12')
    expect(buildHistoriaReproductivaModulo1Text({ modulo1: m1 })).not.toContain('próstata')
  })

  it('construye bloque masculino con doc_prostata legacy del portal', () => {
    const text = buildHistoriaReproductivaMasculinaText({
      doc_prostata: 'Tacto rectal negativo',
      m1_repro_mpf: 'NINGUNO',
    })
    expect(text).toContain('D.O.C. próstata: Tacto rectal negativo')
    expect(text).toContain('M.P.F: NINGUNO')
  })

  it('inmunizaciones ignora NEGADO y lee desde modulo1', () => {
    const text = buildInmunizacionesFromPhysicalExam({
      modulo1: {
        m1_vac_rubeola: 'SI',
        m1_vac_neumococo: 'NEGADO',
      },
    })
    expect(text).toContain('Rubéola: SI')
    expect(text).not.toContain('Neumococo')
  })

  it('gineco no incluye IVS/VSA retirados del examen', () => {
    const text = buildHistoriaGinecoText({
      m1_gine_ivs: 'ACTIVA',
      m1_gine_vsa: 'SI',
      m1_gine_menarca: '12',
    })
    expect(text).toContain('Menarca: 12')
    expect(text).not.toContain('IVS')
    expect(text).not.toContain('VSA')
  })
})
