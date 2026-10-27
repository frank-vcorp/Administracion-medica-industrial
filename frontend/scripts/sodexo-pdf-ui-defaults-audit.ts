/**
 * Simula captura Sodexo solo con defaults de UI (sin llenar manualmente cada campo).
 */
import { writeFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { renderSodexoExamenMedicoPdf } from '../src/lib/sodexo-examen-medico-pdf'
import { syncSodexoExtensionCapture } from '../src/lib/sodexo-extension-capture-defaults'
import { emptySodexoExtension } from '../src/schemas/clinical/examen-medico-variant.schema'
import type { ExamenMedicoPDFData } from '../src/components/pdf/ExamenMedicoValidatedPDF'

function minimalUiPayload(): ExamenMedicoPDFData {
  const sodexo = syncSodexoExtensionCapture(emptySodexoExtension(), {
    patientSexo: 'Masculino',
    showGineco: false,
    antecedentesCaptured: {},
    modulo1: {},
  })
  sodexo.tipo_examen = 'PERIODICA'
  sodexo.contacto_emergencia = 'Contacto prueba'
  sodexo.telefono_emergencia = '4420000000'

  return {
    folio: 'ui-defaults',
    signedAt: new Date(),
    informedConsentSignedAt: new Date(),
    status: 'SIGNED',
    patientIdentification: {
      fullName: 'Paciente Prueba Sodexo',
      universalId: 'TST-001',
      companyName: 'Empresa Demo',
      sexLabel: 'M',
      ageLabel: '35 años',
      attentionDate: '26/10/2026',
      weightLabel: '70 kg',
      heightLabel: '1.70 m',
      temperatureLabel: '36.5 °C',
      heartRateLabel: '72 lpm',
      bloodPressureLabel: '120/80 mmHg',
      workAreaLabel: 'Planta',
      tenureInAreaLabel: '2 años',
    },
    paciente: {
      nombreCompleto: 'Paciente Prueba Sodexo',
      fechaNacimiento: '01/01/1990',
      edad: '35',
      sexo: 'M',
      identidadGenero: 'Masculino',
      estadoCivil: 'SOLTERO',
      escolaridad: 'PREPARATORIA',
      direccion: 'Calle 1, Col Centro, Querétaro, Qro.',
      tipoSanguineo: 'O POSITIVO',
      empresa: 'Empresa Demo',
      puesto: 'Operador',
      area: 'Producción',
      tipoExamen: 'PERIÓDICO',
      historiaOcupacional: '',
      riesgosTrabajo: '',
      epp: null,
    },
    ahf: {},
    apnp: {},
    app: '',
    patologicos: {},
    historiaGineco: null,
    inmunizaciones: null,
    modulo1: {},
    somatometria: { peso: '70', talla: '1.70', imc: '24.2', fc: '72', fr: '18', ta: '120/80' },
    agudezaVisual: {},
    exploracion: {},
    pruebasMusculo: {},
    impresionDiagnostica: '',
    aptitud: 'APTO',
    restricciones: '',
    observacionesFinales: '',
    recomendaciones: [],
    medico: {
      fullName: 'Médico Demo',
      professionalLicense: '00000000',
      signatureImageUrl: '',
    },
    summary: {},
    slots: {},
    logoUrl: '',
    variant: 'SODEXO',
    variantExtensions: { SODEXO: sodexo },
  }
}

async function countFilled(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes)
  const form = doc.getForm()
  let filled = 0
  let total = 0
  for (const f of form.getFields()) {
    total++
    const type = f.constructor.name
    if (type.includes('CheckBox')) {
      if (form.getCheckBox(f.getName()).isChecked()) filled++
    } else if (type.includes('Text')) {
      const t = form.getTextField(f.getName()).getText()?.trim() ?? ''
      if (t) filled++
    }
  }
  return { filled, total }
}

async function main() {
  const data = minimalUiPayload()
  const pdf = await renderSodexoExamenMedicoPdf(data)
  writeFileSync('/tmp/sodexo-audit-ui-defaults.pdf', pdf)
  const stats = await countFilled(pdf)
  const pct = ((stats.filled / stats.total) * 100).toFixed(1)
  console.log(`UI defaults only: ${stats.filled}/${stats.total} (${pct}%)`)
  console.log('PDF: /tmp/sodexo-audit-ui-defaults.pdf')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
