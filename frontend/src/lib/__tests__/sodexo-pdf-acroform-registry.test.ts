import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { SODEXO_PATOLOGICOS_CATALOG } from '@/lib/sodexo-patologicos-catalog'
import { SODEXO_INMUNIZACIONES_CATALOG } from '@/lib/sodexo-inmunizaciones-catalog'
import { SODEXO_EXAMEN_FISICO_CATALOG } from '@/lib/sodexo-examen-fisico-catalog'
import { SODEXO_HO_PDF_ROWS } from '@/lib/sodexo-pdf-ho-rows'
import {
  SODEXO_AHF_LEFT,
  SODEXO_AHF_RIGHT,
  SODEXO_ESCOLARIDAD_CHECKS,
  SODEXO_FUNCIONES_CHECKBOXES,
  SODEXO_PROFESION_TEXT,
  SODEXO_VISIOMETRIA_TEXT,
} from '@/lib/sodexo-pdf-mappings'
import { loadSodexoFieldGeometry } from '@/lib/sodexo-pdf-geometry'

const TEMPLATE = path.join(
  process.cwd(),
  'resources/pdf/sodexo-examen-medico-template.pdf',
)

function collectMappedFieldNames(): string[] {
  const names: string[] = [SODEXO_PROFESION_TEXT]
  for (const v of Object.values(SODEXO_FUNCIONES_CHECKBOXES)) names.push(v)
  for (const v of Object.values(SODEXO_ESCOLARIDAD_CHECKS)) names.push(v)
  for (const row of [...SODEXO_AHF_LEFT, ...SODEXO_AHF_RIGHT]) {
    names.push(row.text, row.checkNo, row.checkSi)
  }
  for (const row of SODEXO_HO_PDF_ROWS) {
    names.push(
      row.empresa,
      row.ocupacion,
      row.tiempo,
      row.indemn_fecha,
      ...row.examen,
      ...row.rt,
      ...row.secuelas,
      ...row.indemnizado,
    )
  }
  for (const e of SODEXO_PATOLOGICOS_CATALOG) {
    names.push(e.pdf.checkNo, e.pdf.checkSi)
    if (e.pdf.descField) names.push(e.pdf.descField)
  }
  for (const e of SODEXO_INMUNIZACIONES_CATALOG) {
    if (e.pdf.checkNo) names.push(e.pdf.checkNo)
    names.push(e.pdf.checkSi)
    if (e.pdf.fecha) names.push(e.pdf.fecha)
    if (e.pdf.imss) names.push(e.pdf.imss)
    if (e.pdf.ssa) names.push(e.pdf.ssa)
    if (e.pdf.otros) names.push(e.pdf.otros)
    if (e.pdf.marca) names.push(e.pdf.marca)
  }
  for (const e of SODEXO_EXAMEN_FISICO_CATALOG) {
    if (e.pdf) {
      names.push(e.pdf.normal, e.pdf.abnormal)
      if (e.pdf.desc) names.push(e.pdf.desc)
    }
    if (e.signo) names.push(e.signo.neg, e.signo.pos)
    if (e.textField) names.push(e.textField)
    if (e.checkField) names.push(e.checkField)
  }
  for (const v of Object.values(SODEXO_VISIOMETRIA_TEXT)) names.push(v)
  return [...new Set(names)]
}

describe('sodexo-pdf-acroform-registry', () => {
  it('todos los campos mapeados en catálogos existen en la plantilla', async () => {
    const bytes = readFileSync(TEMPLATE)
    const doc = await PDFDocument.load(bytes)
    const templateNames = new Set(doc.getForm().getFields().map((f) => f.getName()))
    const mapped = collectMappedFieldNames()
    const missing = mapped.filter((n) => !templateNames.has(n))
    expect(missing).toEqual([])
  })

  it('funciones principales: casillas en la misma fila, orden X = impreso', () => {
    const geo = loadSodexoFieldGeometry()
    const byName = new Map(geo.map((f) => [f.name, f]))
    const order = [
      'ayudante',
      'mantenimiento',
      'tecnica',
      'telefono',
      'conduccion',
      'administrativa',
    ] as const
    const boxes = order.map((k) => byName.get(SODEXO_FUNCIONES_CHECKBOXES[k])!)
    for (const b of boxes) expect(b.page).toBe(0)
    const y0 = boxes[0].y
    for (const b of boxes) expect(Math.abs(b.y - y0)).toBeLessThan(2)
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x)
    }
  })
})
