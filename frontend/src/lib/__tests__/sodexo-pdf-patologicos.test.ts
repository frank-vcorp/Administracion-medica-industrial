import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { fillSodexoPatologicos, parsePatologiaEntry } from '@/lib/sodexo-pdf-patologicos'

describe('sodexo-pdf-patologicos', () => {
  it('parsea SI con detalle', () => {
    const p = parsePatologiaEntry({
      estado: 'SI',
      detalle: { desde_cuando: '2020', tratamiento: 'METF', observaciones: 'control' },
    })
    expect(p.si).toBe(true)
    expect(p.descripcion).toContain('METF')
  })

  it('marca fracturas y diabetes en la plantilla', async () => {
    const bytes = await readFile(
      path.join(process.cwd(), 'resources/pdf/sodexo-examen-medico-template.pdf'),
    )
    const doc = await PDFDocument.load(bytes)
    const form = doc.getForm()
    fillSodexoPatologicos(form, {
      fracturas: 'NEGADO',
      diabetes: {
        estado: 'SI',
        detalle: { observaciones: 'tipo II controlado' },
      },
      asma: { estado: 'NEGADO' },
    })
    expect(form.getCheckBox('Check Box434').isChecked()).toBe(true)
    expect(form.getCheckBox('Check Box395').isChecked()).toBe(false)
    expect(form.getCheckBox('Check Box398').isChecked()).toBe(true)
    expect(form.getTextField('Texto485').getText()).toContain('tipo II')
  })
})
