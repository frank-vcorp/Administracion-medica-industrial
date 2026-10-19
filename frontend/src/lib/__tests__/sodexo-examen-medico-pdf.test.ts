import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { renderSodexoExamenMedicoPdf } from '@/lib/sodexo-examen-medico-pdf'
import type { ExamenMedicoPDFData } from '@/components/pdf/ExamenMedicoValidatedPDF'

function minimalSodexoData(): ExamenMedicoPDFData {
  return {
    folio: 'test-folio',
    signedAt: new Date('2026-05-16T12:00:00.000Z'),
    informedConsentSignedAt: new Date('2026-05-15T10:00:00.000Z'),
    status: 'SIGNED',
    patientIdentification: {
      fullName: 'Marin Ernesto',
      universalId: 'UNI-1',
      companyName: 'Sodexo Test',
      sexLabel: 'M',
      ageLabel: '45 años',
      attentionDate: '16/05/2026',
      weightLabel: '80 kg',
      heightLabel: '1.75 m',
      temperatureLabel: null,
      heartRateLabel: '72 lpm',
      bloodPressureLabel: '120/80 mmHg',
      workAreaLabel: null,
      tenureInAreaLabel: null,
    },
    paciente: {
      nombreCompleto: 'Marin Ernesto',
      fechaNacimiento: '01/01/1980',
      edad: '45',
      sexo: 'M',
      identidadGenero: 'Masculino',
      estadoCivil: 'Casado',
      escolaridad: 'Universidad',
      direccion: 'Calle Ejemplo 123',
      tipoSanguineo: 'O+',
      empresa: 'Sodexo Test',
      puesto: 'Operador',
      area: 'Producción',
      tipoExamen: 'PERIÓDICO',
      historiaOcupacional: null,
      riesgosTrabajo: null,
      epp: null,
    },
    ahf: {
      diabetes: 'NEGADOS',
      hipertension: 'PADRE',
      mentales: 'NEGADO',
    },
    apnp: {},
    app: '',
    patologicos: {
      has: { estado: 'SI', detalle: { observaciones: 'en tratamiento' } },
      fracturas: 'NEGADO',
    },
    historiaGineco: null,
    inmunizaciones: null,
    somatometria: {
      peso: '80',
      talla: '1.75',
      imc: '26.1',
      fc: '72',
      fr: '18',
    },
    agudezaVisual: {},
    exploracion: {
      neurologico: 'Alerta, orientado',
      cabeza: 'Normocéfalo',
    },
    pruebasMusculo: {},
    impresionDiagnostica: '1. Sin patología aguda',
    aptitud: 'APTO',
    restricciones: '',
    observacionesFinales: '',
    recomendaciones: ['Uso de EPP', 'Control anual'],
    medico: {
      fullName: 'Médico Prueba',
      professionalLicense: '12345678',
      signatureImageUrl: '',
    },
    summary: {
      estado_nutricional: null,
      agudeza_visual: null,
      salud_bucal: null,
      presion_arterial: null,
      examen_medico: null,
      audiometria: null,
      espirometria: null,
      laboratorios: null,
      radiografia: null,
    },
    slots: {},
    logoUrl: '',
    variant: 'SODEXO',
    variantExtensions: {
      SODEXO: {
        tipo_examen: 'PERIODICA',
        contacto_emergencia: 'Contacto Test',
        telefono_emergencia: '4420000000',
        actividades_cargo: 'Operador',
        fecha_ingreso_actividades: '01/01/2020',
        antiguedad_actividades: '5',
        tipo_actividad: 'Mantenimiento',
        matriz_riesgos_observaciones: 'Ruido, calor',
        epp_casco: true,
        epp_lentes: true,
      },
    },
  }
}

describe('sodexo-examen-medico-pdf', () => {
  it(
    'genera PDF de 4 páginas desde plantilla REG-SO-01',
    async () => {
    const buf = await renderSodexoExamenMedicoPdf(minimalSodexoData())
    expect(buf.length).toBeGreaterThan(500_000)
    const doc = await PDFDocument.load(buf)
    expect(doc.getPageCount()).toBe(4)
    const form = doc.getForm()
    const nombre = form.getTextField('Nombre').getText()
    expect(nombre).toContain('Marin')
    expect(form.getCheckBox('Check Box4').isChecked()).toBe(true)
    expect(form.getCheckBox('Check Box332').isChecked()).toBe(true)
    expect(form.getCheckBox('Check Box334').isChecked()).toBe(false)
    expect(form.getCheckBox('Check Box335').isChecked()).toBe(true)
    expect(form.getCheckBox('Check Box76').isChecked()).toBe(true)
    expect(form.getCheckBox('Check Box77').isChecked()).toBe(true)
    expect(form.getTextField('Texto26').getText()).toContain('Marin')
    },
    15_000,
  )

  it('la plantilla oficial está en resources/pdf', async () => {
    const p = path.join(process.cwd(), 'resources/pdf/sodexo-examen-medico-template.pdf')
    const bytes = await readFile(p)
    expect(bytes.length).toBeGreaterThan(1_000_000)
  })
})
