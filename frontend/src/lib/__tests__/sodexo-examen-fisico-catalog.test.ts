import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import {
  SODEXO_EXAMEN_FISICO_CATALOG,
  SODEXO_EXAMEN_FISICO_SECTIONS,
} from '@/lib/sodexo-examen-fisico-catalog'
import { prefillExamenFisicoSodexoFromAmi } from '@/lib/sodexo-examen-fisico-prefill'

const TEMPLATE = path.join(
  process.cwd(),
  'resources/pdf/sodexo-examen-medico-template.pdf',
)

describe('sodexo-examen-fisico-catalog', () => {
  it('expone §9.1–9.8 con grupos y claves únicas', () => {
    expect(SODEXO_EXAMEN_FISICO_SECTIONS.map((s) => s.id)).toEqual([
      '9.1',
      '9.2',
      '9.3',
      '9.4',
      '9.5',
      '9.6',
      '9.7',
      '9.8',
    ])
    const keys = SODEXO_EXAMEN_FISICO_CATALOG.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const sec of SODEXO_EXAMEN_FISICO_SECTIONS) {
      expect(sec.groups.length).toBeGreaterThan(0)
      const inSection = SODEXO_EXAMEN_FISICO_CATALOG.filter((e) => e.section === sec.id)
      expect(inSection.length).toBeGreaterThan(0)
      for (const g of sec.groups) {
        expect(inSection.some((e) => e.group === g)).toBe(true)
      }
    }
  })

  it('referencia solo campos AcroForm presentes en la plantilla', async () => {
    const bytes = readFileSync(TEMPLATE)
    const doc = await PDFDocument.load(bytes)
    const names = new Set(doc.getForm().getFields().map((f) => f.getName()))
    for (const entry of SODEXO_EXAMEN_FISICO_CATALOG) {
      if (entry.pdf) {
        expect(names.has(entry.pdf.normal)).toBe(true)
        expect(names.has(entry.pdf.abnormal)).toBe(true)
        if (entry.pdf.desc) expect(names.has(entry.pdf.desc)).toBe(true)
      }
      if (entry.signo) {
        expect(names.has(entry.signo.neg)).toBe(true)
        expect(names.has(entry.signo.pos)).toBe(true)
      }
      if (entry.textField) expect(names.has(entry.textField)).toBe(true)
    }
  })

  it('§9.3 Abdomen — solo ítems del impreso', () => {
    const rows = SODEXO_EXAMEN_FISICO_CATALOG.filter((e) => e.section === '9.3')
    expect(rows.map((r) => r.label)).toEqual([
      'Ruidos',
      'Inspección',
      'Palpación (Megalias)',
      'Percusión',
      'Hernias',
    ])
  })

  it('sin prellenado AMI en §9 Sodexo', () => {
    expect(
      prefillExamenFisicoSodexoFromAmi({ cabeza: 'NORMAL', torax: 'Mesomórfico' }),
    ).toEqual({})
  })
})
