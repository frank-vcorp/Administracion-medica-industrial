import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { prefillGinecoSodexoFromModulo1 } from '@/lib/sodexo-gineco-prefill'
import { fillSodexoGineco } from '@/lib/sodexo-pdf-gineco'

describe('sodexo-gineco', () => {
  it('prefill desde módulo 1', () => {
    const g = prefillGinecoSodexoFromModulo1({
      m1_gine_ritmo: '28/30',
      m1_gine_fum: '2024-06-01',
      m1_gine_gesta: '2',
      m1_gine_mpf: 'DIU',
    })
    expect(g.ciclos).toContain('28')
    expect(g.fum).toContain('2024')
    expect(g.gesta).toBe('2')
    expect(g.metodo_planificacion).toBe('DIU')
  })

  it('proyecta §7 en PDF para mujer', async () => {
    const bytes = await readFile(
      path.join(process.cwd(), 'resources/pdf/sodexo-examen-medico-template.pdf'),
    )
    const doc = await PDFDocument.load(bytes)
    const form = doc.getForm()
    fillSodexoGineco(form, {}, 'Femenino', null, {
      ciclos: '28/30',
      fum: '01/06/2024',
      gesta: '2',
      metodo_planificacion: 'DIU',
      ultima_citologia: '2023',
      dismenorrea: 'NO',
    })
    expect(form.getTextField('Texto570').getText()).toContain('28')
    expect(form.getTextField('Método de planificación').getText()).toContain('DIU')
    expect(form.getTextField('Ultima Citología').getText()).toContain('2023')
  })
})
