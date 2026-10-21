import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { prefillEstilosVidaSodexoFromApnp } from '@/lib/sodexo-estilos-vida-prefill'
import { fillSodexoEstilosVida } from '@/lib/sodexo-pdf-estilos-vida'

describe('sodexo-estilos-vida', () => {
  it('prefill desde no patológicos', () => {
    const ev = prefillEstilosVidaSodexoFromApnp({
      tabaco: 'NEGADO',
      alcohol: 'SI',
      alcohol_frecuencia: 'OCASIONAL fines de semana',
      drogas_estimulantes: 'SI',
      drogas_especifique: 'Marihuana',
    })
    expect(ev.tabaco_opcion).toBe('NO')
    expect(ev.alcohol).toBe('SI')
    expect(ev.drogas_tipo).toContain('Marihuana')
  })

  it('marca tabaco y drogas en plantilla', async () => {
    const bytes = await readFile(
      path.join(process.cwd(), 'resources/pdf/sodexo-examen-medico-template.pdf'),
    )
    const doc = await PDFDocument.load(bytes)
    const form = doc.getForm()
    fillSodexoEstilosVida(
      form,
      { tabaco: null, alcohol: null, drogas: null },
      {
        tabaco_opcion: 'EVENTUAL',
        tabaco_anios_habito: '1_5',
        alcohol: 'SI',
        alcohol_ocasional: 'Ocasional social',
        drogas: 'SI',
        drogas_tipo: 'Cannabis',
      },
      null,
    )
    expect(form.getCheckBox('Check Box547').isChecked()).toBe(true)
    expect(form.getCheckBox('Check Box551').isChecked()).toBe(true)
    expect(form.getCheckBox('Check Box557').isChecked()).toBe(true)
    expect(form.getTextField('Tipo de droga').getText()).toContain('Cannabis')
  })
})
