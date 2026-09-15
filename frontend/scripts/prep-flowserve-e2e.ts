/**
 * Prepara un evento activo para verificación E2E Flowserve:
 * - EventTest GEN-EM-FLO
 * - Somatometría, vitales y agudeza completos
 * - variant_extensions en physicalExamData
 * - MedicalVerdict firmado (para PDF)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FLOWSERVE_EXT = {
  area: 'Producción',
  alergias: 'Ninguna conocida',
  religion: 'Católica',
  contacto_emergencia: 'María Demo',
  celular_emergencia: '4421234567',
  higiene_bano: '7',
  higiene_aseo_bucal: '3',
  higiene_cambio_ropa: 'Diario',
  alimentacion_nivel: 'BUENO',
  actividad_fisica_frecuencia: '3 veces/semana',
  actividad_fisica_tipo: 'Caminata',
  sat_o2: '98',
  ruffier_fc_inicial: '72',
  ruffier_fc_flexiones: '110',
  ruffier_fc_minuto: '85',
  ruffier_resultado: 'Medio',
  nivel_salud: 'Bueno',
  interrogatorio: {
    cardiovascular: { estado: 'SIN_SINTOMAS', especifique: '' },
    respiratorio: { estado: 'SIN_SINTOMAS', especifique: '' },
    digestivo: { estado: 'SIN_SINTOMAS', especifique: '' },
    genitourinario: { estado: 'SIN_SINTOMAS', especifique: '' },
    musculoesqueletico: { estado: 'SIN_SINTOMAS', especifique: '' },
    neurologico: { estado: 'SIN_SINTOMAS', especifique: '' },
    endocrino: { estado: 'SIN_SINTOMAS', especifique: '' },
    piel_anexos: { estado: 'SIN_SINTOMAS', especifique: '' },
    psiquiatrico: { estado: 'SIN_SINTOMAS', especifique: '' },
  },
  declaracion_protesta: 'Declaro bajo protesta de decir verdad que la información es correcta.',
  cuestionario_nordico: {
    cuello: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
    hombros: { sintomas_12m: 'SI', impidio_trabajo_12m: 'NO', sintomas_7d: 'NO' },
    codos: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
    munecas_manos: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
    espalda_alta: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
    espalda_baja: { sintomas_12m: 'SI', impidio_trabajo_12m: 'NO', sintomas_7d: 'SI' },
    caderas_muslos: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
    rodillas: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
    tobillos_pies: { sintomas_12m: 'NO', impidio_trabajo_12m: null, sintomas_7d: null },
  },
}

async function main() {
  const flow = await prisma.medicalTest.findUnique({ where: { code: 'GEN-EM-FLO' } })
  if (!flow) throw new Error('GEN-EM-FLO not found — run seed-exam-variants.ts')

  const evt = await prisma.medicalEvent.findFirst({
    where: { status: { in: ['IN_PROGRESS', 'CHECKED_IN', 'VALIDATING'] } },
    orderBy: { createdAt: 'desc' },
    include: { eventTests: true, exam: true, verdict: true, worker: true },
  })
  if (!evt) throw new Error('No active event found')

  const examTest = evt.eventTests.find((t) => /examen med/i.test(t.testNameSnapshot))
  if (examTest) {
    await prisma.eventTest.update({
      where: { id: examTest.id },
      data: { testId: flow.id, testNameSnapshot: flow.name, status: 'IN_PROGRESS' },
    })
  } else {
    await prisma.eventTest.create({
      data: {
        eventId: evt.id,
        testId: flow.id,
        testNameSnapshot: flow.name,
        status: 'IN_PROGRESS',
      },
    })
  }

  const somaData = {
    peso_kg: '80',
    talla_m: '1.75',
    imc: '26.1',
    ta_sistolica: '120',
    ta_diastolica: '80',
    fc_min: '72',
    fr_min: '16',
    temp_c: '36.5',
    perimetro_cintura_cm: '90',
    perimetro_cadera_cm: '95',
    soma_completed: true,
    vitals_completed: true,
  }

  const eyeData = {
    ojo_derecho_sin_correccion: '20/20',
    ojo_izquierdo_sin_correccion: '20/20',
    agudeza_completed: true,
  }

  const physicalData = {
    aptitud: 'APTO',
    impresion_diagnostica: 'Paciente sano para trabajo industrial',
    exam_variant: 'FLOWSERVE',
    variant_extensions: { FLOWSERVE: FLOWSERVE_EXT },
    exploracion: { neurologico: 'Normal', cardiovascular: 'Normal' },
    app: { texto: 'Negados' },
    ahf: {},
    apnp: {},
    historia_ocupacional: { narrativa: 'Sin antecedentes relevantes' },
  }

  if (evt.exam) {
    await prisma.medicalExam.update({
      where: { eventId: evt.id },
      data: {
        somatometryData: somaData,
        vitalSignsData: somaData,
        eyeAcuityData: eyeData,
        physicalExamData: physicalData,
        weight: 80,
        height: 1.75,
        bloodPressure: '120/80',
        heartRate: 72,
      },
    })
  } else {
    await prisma.medicalExam.create({
      data: {
        eventId: evt.id,
        somatometryData: somaData,
        vitalSignsData: somaData,
        eyeAcuityData: eyeData,
        physicalExamData: physicalData,
        weight: 80,
        height: 1.75,
        bloodPressure: '120/80',
        heartRate: 72,
      },
    })
  }

  const admin = await prisma.user.findFirst({
    where: { email: 'admin@ami.com' },
  })
  if (!admin) throw new Error('admin@ami.com not found')

  if (!evt.verdict) {
    await prisma.medicalVerdict.create({
      data: {
        eventId: evt.id,
        finalDiagnosis: 'APTO para trabajo industrial',
        recommendations: 'Uso de EPP según área',
        validatorId: admin.id,
        signedAt: new Date(),
        signatureHash: 'e2e-demo-hash',
      },
    })
  }

  console.log(
    JSON.stringify(
      {
        eventId: evt.id,
        worker: evt.worker?.fullName,
        url: `http://localhost:3000/events/${evt.id}`,
        pdfUrl: `http://localhost:3000/api/pdf/examen-medico/${evt.id}`,
        flowserveTest: flow.name,
      },
      null,
      2,
    ),
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
