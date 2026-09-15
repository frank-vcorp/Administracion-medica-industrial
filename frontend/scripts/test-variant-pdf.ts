/**
 * Genera PDF de prueba con anexo Flowserve (sin servidor).
 */
import { buildExamenMedicoPdfData, generateExamenMedicoValidatedPdf } from '../src/lib/examen-medico-pdf'
import { writeFileSync } from 'node:fs'

async function main() {
  const data = buildExamenMedicoPdfData({
    folio: 'test-folio',
    signedAt: new Date(),
    status: 'SIGNED',
    worker: {
      nombreCompleto: 'Paciente Demo',
      fechaNacimiento: '01/01/1990',
      edad: '36',
      sexo: 'M',
      empresa: 'Flowserve Demo',
      puesto: 'Operador',
    },
    ahf: {},
    apnp: {},
    historiaOcupacional: { narrativa: 'Demo' },
    app: { texto: 'Negados' },
    somatometria: { peso: '80', talla: '1.75', imc: '26.1', ta: '120/80' },
    agudezaVisual: {},
    exploracion: { neurologico: 'Normal' },
    impresionDiagnostica: 'Sin alteraciones',
    aptitud: 'APTO',
    restricciones: '',
    observacionesFinales: '',
    medico: {
      fullName: 'Dr Demo',
      professionalLicense: '12345678',
      signatureImageUrl: '',
    },
    slots: {},
    logoDataUrl: null,
    variant: 'FLOWSERVE',
    variantExtensions: {
      FLOWSERVE: {
        area: 'Producción',
        alergias: 'Ninguna',
        contacto_emergencia: 'María Demo',
        celular_emergencia: '4421234567',
        nivel_salud: 'Bueno',
        alimentacion_nivel: 'BUENO',
        ruffier_resultado: 'Medio',
        interrogatorio: {
          cardiovascular: { estado: 'SIN_SINTOMAS', especifique: '' },
        },
        declaracion_protesta: 'Juan Demo bajo protesta',
        cuestionario_nordico: {
          cuello: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
          hombros: { sintomas_12m: 'SI', impidio_trabajo_12m: 'NO', sintomas_7d: 'SI' },
          codos: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
          munecas_manos: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
          espalda_alta: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
          espalda_baja: { sintomas_12m: 'SI', impidio_trabajo_12m: 'SI', sintomas_7d: 'NO' },
          caderas_muslos: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
          rodillas: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
          tobillos_pies: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
        },
      },
    },
  })

  const result = await generateExamenMedicoValidatedPdf({
    data,
    eventId: 'pdf-variant-test',
  })

  writeFileSync('/tmp/examen-flowserve-test.pdf', result.buffer)
  console.log('PDF written to /tmp/examen-flowserve-test.pdf', result.buffer.length, 'bytes')
}

main().catch(console.error)
