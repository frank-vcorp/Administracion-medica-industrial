import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import {
  SODEXO_EXAMEN_FISICO_CATALOG,
  SODEXO_EXAMEN_FISICO_SECTIONS,
} from '@/lib/sodexo-examen-fisico-catalog'
import { prefillExamenFisicoSodexoFromAmi } from '@/lib/sodexo-examen-fisico-prefill'
import { sodexoEfEntryVisibleForSex } from '@/lib/sodexo-examen-fisico-visibility'
import { isSodexoFemalePatient, isSodexoMalePatient } from '@/lib/sodexo-ami-mirror'

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
      const inSection = SODEXO_EXAMEN_FISICO_CATALOG.filter((e) => e.section === sec.id)
      if (sec.id === '9.6') {
        expect(inSection.length).toBe(0)
        continue
      }
      expect(sec.groups.length).toBeGreaterThan(0)
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
      'Inspección',
      'Palpación (Megalias)',
      'Percusión',
      'Auscultación',
      'Hernias',
    ])
  })

  it('sexo del paciente (Módulo 1)', () => {
    expect(isSodexoMalePatient('Masculino')).toBe(true)
    expect(isSodexoFemalePatient('Masculino')).toBe(false)
    expect(isSodexoFemalePatient('Femenino')).toBe(true)
    expect(isSodexoMalePatient('Femenino')).toBe(false)
    expect(isSodexoFemalePatient('Mujer')).toBe(true)
    expect(isSodexoMalePatient('Mujer')).toBe(false)
  })

  it('§9.5 Osteomuscular — grupos del impreso (sin arcos inventados)', () => {
    const rows = SODEXO_EXAMEN_FISICO_CATALOG.filter((e) => e.section === '9.5')
    const keys = rows.map((r) => r.key)
    expect(keys).not.toContain('95_hombro_d')
    expect(keys).not.toContain('95_codo_d')
    const groups = [...new Set(rows.map((r) => r.group))]
    expect(groups).toEqual(['Miembros superiores', 'Miembros inferiores', 'Lesiones repetitivas'])
    expect(rows.filter((r) => r.group === 'Miembros superiores').map((r) => r.label)).toEqual([
      'PHALEN — D',
      'PHALEN — I',
      'TINNEL — D',
      'TINNEL — I',
      'Atrofia',
      'Hipertrofia',
      'Palpación',
      'Sensibilidad',
    ])
    expect(rows.filter((r) => r.group === 'Miembros inferiores').map((r) => r.label)).toEqual([
      'Atrofia',
      'Hipertrofia',
      'Palpación',
      'Sensibilidad',
      'MARCHA',
      'Claudicación',
      'Ayudas',
    ])
  })

  it('§9.4 genitourinario según sexo', () => {
    const byKey = (k: string) => SODEXO_EXAMEN_FISICO_CATALOG.find((e) => e.key === k)!
    expect(sodexoEfEntryVisibleForSex(byKey('94_testiculos'), 'Masculino')).toBe(true)
    expect(sodexoEfEntryVisibleForSex(byKey('94_testiculos'), 'Femenino')).toBe(false)
    expect(sodexoEfEntryVisibleForSex(byKey('94_mujer'), 'Femenino')).toBe(true)
    expect(sodexoEfEntryVisibleForSex(byKey('94_mujer'), 'Masculino')).toBe(false)
    expect(sodexoEfEntryVisibleForSex(byKey('94_tr'), 'M')).toBe(true)
    expect(sodexoEfEntryVisibleForSex(byKey('94_tr'), 'F')).toBe(true)
  })

  it('sin prellenado AMI en §9 Sodexo', () => {
    expect(
      prefillExamenFisicoSodexoFromAmi({ cabeza: 'NORMAL', torax: 'Mesomórfico' }),
    ).toEqual({})
  })
})
