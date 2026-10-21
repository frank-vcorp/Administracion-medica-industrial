import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { prefillInmunizacionesSodexoFromModulo1 } from '@/lib/sodexo-inmunizaciones-prefill'
import { fillSodexoInmunizaciones } from '@/lib/sodexo-pdf-inmunizaciones'

describe('sodexo-inmunizaciones', () => {
  it('prefill desde módulo 1', () => {
    const data = prefillInmunizacionesSodexoFromModulo1({
      m1_vac_toxoide: 'NEGADO',
      m1_vac_hepatitisb: 'SI',
      m1_vac_influenza: '2024-01',
    })
    expect(data.filas?.tetanos?.estado).toBe('NEGADO')
    expect(data.filas?.hepatitis?.estado).toBe('SI')
    expect(data.filas?.influenza_estacional?.fecha).toContain('2024')
  })

  it('marca tétanos negado y hepatitis en plantilla', async () => {
    const bytes = await readFile(
      path.join(process.cwd(), 'resources/pdf/sodexo-examen-medico-template.pdf'),
    )
    const doc = await PDFDocument.load(bytes)
    const form = doc.getForm()
    fillSodexoInmunizaciones(form, {}, null, {
      filas: {
        tetanos: { estado: 'NEGADO' },
        hepatitis: { estado: 'SI', fecha: '01/2024' },
      },
      observaciones: 'Sin novedad',
    })
    expect(form.getCheckBox('Check Box560').isChecked()).toBe(true)
    expect(form.getTextField('Texto575').getText()).toContain('01/2024')
    expect(form.getTextField('Texto541').getText()).toContain('Sin novedad')
  })
})
