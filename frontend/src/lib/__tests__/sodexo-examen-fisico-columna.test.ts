import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import {
  SODEXO_COLUMNA_ARCO_PDF,
  SODEXO_COLUMNA_ARCO_SINTOMA_PDF,
  SODEXO_COLUMNA_CURVA_PDF,
  SODEXO_COLUMNA_ESCOLIOSIS_PDF,
  sodexoColumnaCurvaKey,
  sodexoColumnaEscoliosisKey,
} from '@/lib/sodexo-examen-fisico-columna'

const TEMPLATE = path.join(
  process.cwd(),
  'resources/pdf/sodexo-examen-medico-template.pdf',
)

describe('sodexo-examen-fisico-columna', () => {
  it('rejilla curva: cifosis y lordosis × 3 regiones × N/A/D', () => {
    expect(Object.keys(SODEXO_COLUMNA_CURVA_PDF)).toHaveLength(6)
    expect(SODEXO_COLUMNA_CURVA_PDF[sodexoColumnaCurvaKey('cifosis', 'cervical')]).toEqual({
      N: 'Check Box777',
      A: 'Check Box781',
      D: 'Check Box783',
    })
  })

  it('escoliosis: 2 lados × 3 regiones × No/Sí', () => {
    expect(Object.keys(SODEXO_COLUMNA_ESCOLIOSIS_PDF)).toHaveLength(6)
    expect(SODEXO_COLUMNA_ESCOLIOSIS_PDF[sodexoColumnaEscoliosisKey('derecha', 'cervical')]).toEqual({
      NO: 'Check Box749',
      SI: 'Check Box750',
    })
  })

  it('referencia campos AcroForm §9.6 mapeados', async () => {
    const bytes = readFileSync(TEMPLATE)
    const doc = await PDFDocument.load(bytes)
    const names = new Set(doc.getForm().getFields().map((f) => f.getName()))
    const fields = new Set<string>()
    for (const m of Object.values(SODEXO_COLUMNA_CURVA_PDF)) {
      for (const f of Object.values(m)) if (f) fields.add(f)
    }
    for (const p of Object.values(SODEXO_COLUMNA_ESCOLIOSIS_PDF)) {
      fields.add(p.NO)
      fields.add(p.SI)
    }
    for (const p of Object.values(SODEXO_COLUMNA_ARCO_PDF)) {
      fields.add(p.normal)
      fields.add(p.abnormal)
    }
    for (const p of Object.values(SODEXO_COLUMNA_ARCO_SINTOMA_PDF)) {
      fields.add(p.NO)
      fields.add(p.SI)
    }
    fields.add('Texto913')
    for (const f of fields) {
      expect(names.has(f)).toBe(true)
    }
  })
})
