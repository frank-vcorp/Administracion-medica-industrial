/**
 * @file Simulación de payload "Servicios Robles" para validar el schema del
 *       formulario de auto-alta. Demuestra cómo se envían los datos desde la UI
 *       al backend (sin necesidad de navegador real).
 * @id FIX-ARCH-20260624-DEMO
 *
 * USO:
 *   cd frontend && npx tsx scripts/demo-servicios-robles.ts
 *
 * Resultado esperado:
 *   - Si el schema es válido: ✓ "Servicios Robles" pasaría validación Zod
 *   - Si hay errores: lista exacta de qué campos faltan/son inválidos
 *
 * Esto NO persiste en DB. Solo valida la estructura contra CompanyFullFormPayloadSchema.
 */
import {
  CompanyFullFormPayloadSchema,
  CFDI_USO_VALUES,
  METODO_PAGO_VALUES,
} from '../src/lib/schemas/company-full-form'

const serviciosRoblesPayload = {
  // ============================================================
  // SECCIÓN 1: Información Fiscal
  // ============================================================
  fiscal: {
    fecha: new Date().toISOString(),
    razonSocial: 'Servicios Robles S.A. de C.V.',
    rfc: 'SRO250101AB3', // RFC válido: 3 letras + 6 dígitos (250101 = fecha 25-01-01) + 3 alfanuméricos
    giro: 'Servicios Industriales',
    // FIX-ARCH-20260624-05: domicilio en 3 campos.
    domicilioCalle: 'Av. Industrias 1234',
    domicilioInterior: '5',
    domicilioExterior: '',
    colonia: 'Parque Industrial Querétaro',
    estado: 'Querétaro',
    municipio: 'Querétaro',
    pais: 'México',
    cp: '76220',
    usoCFDI: 'G03', // Gastos en general
    metodoPago: 'PUE', // Pago en una sola exhibición
  },

  // ============================================================
  // SECCIÓN 2: Datos Bancarios (opcional)
  // ============================================================
  bancario: {
    banco: 'BBVA México',
    cuenta: '01234567890123456789',
  },

  // ============================================================
  // SECCIÓN 3: Representante Legal
  // ============================================================
  repLegal: {
    nombre: 'Juan Carlos',
    apellidos: 'Robles Mendoza',
    puesto: 'Director General',
    telefono: '4421234567',
    extension: '101',
    email: 'juan.robles@serviciosrobles.com.mx',
  },

  // ============================================================
  // SECCIÓN 4: Responsable de RH
  // ============================================================
  rh: {
    nombre: 'María Elena',
    apellidos: 'García Pérez',
    puesto: 'Gerente de Recursos Humanos',
    telefono: '4421234568',
    extension: '102',
    email: 'rh@serviciosrobles.com.mx',
  },

  // ============================================================
  // SECCIÓN 5: Cuentas por Pagar
  // ============================================================
  cuentasPagar: {
    nombre: 'Roberto',
    apellidos: 'Hernández López',
    puesto: 'Jefe de Cuentas por Pagar',
    telefono: '4421234569',
    extension: '103',
    email: 'cxp@serviciosrobles.com.mx',
  },

  // ============================================================
  // SECCIÓN 6: Facturación / XML
  // ============================================================
  facturacion: {
    correoXml: 'facturacion@serviciosrobles.com.mx',
    correoComplemento: 'pagos@serviciosrobles.com.mx',
    procesoFacturacion:
      'Recepción de facturas, validación con orden de compra, programación de pago a 15 días.',
  },

  // ============================================================
  // SECCIÓN 7: Entrega Física (opcional)
  // ============================================================
  entregaFisica: {
    dias: ['L', 'M', 'X', 'J', 'V'], // Lunes a Viernes
    // FIX-ARCH-20260624-05: rango horario De/A.
    horaDe: '09',
    minutoDe: '00',
    horaA: '14',
    minutoA: '00',
    // FIX-ARCH-20260624-05: contacto estructurado.
    contactoRecibe: {
      nombre: 'María García',
      telefono: '4421234500',
      celular: '4425556677',
    },
  },

  // ============================================================
  // SECCIÓN 8: Referencias Comerciales (opcional, hasta 3)
  // ============================================================
  referencias: [
    {
      nombre: 'Industrias del Bajío S.A.',
      rfc: 'IBA150525XY1',
      telefono: '4429876543',
      celular: '4425551234',
    },
    {
      nombre: 'Refacciones Automotrices Querétaro',
      rfc: 'RAQ201208AB2',
      telefono: '4425559988',
      celular: '4425557766',
    },
    {
      nombre: 'Servicios Logísticos del Centro',
      rfc: 'SLC180310CD3',
      telefono: '4424445566',
      celular: '4425553344',
    },
  ],

  // ============================================================
  // SECCIÓN 9: Documentos Adjuntos (5 obligatorios)
  // ============================================================
  documentos: [
    {
      nombre: 'constancia_fiscal_servicios_robles.pdf',
      seccion: 'constanciaFiscal',
      key: 'companies/demo/constanciaFiscal/constancia_fiscal_servicios_robles.pdf',
      fileUrl: '/api/files/companies/demo/constanciaFiscal/constancia_fiscal_servicios_robles.pdf',
      size: 245678, // ~240 KB
      mime: 'application/pdf',
      extension: 'pdf',
    },
    {
      nombre: 'ine_representante_legal.pdf',
      seccion: 'identificacionRepLegal',
      key: 'companies/demo/identificacionRepLegal/ine_representante_legal.pdf',
      fileUrl: '/api/files/companies/demo/identificacionRepLegal/ine_representante_legal.pdf',
      size: 198432, // ~194 KB
      mime: 'application/pdf',
      extension: 'pdf',
    },
    {
      nombre: 'comprobante_domicilio.pdf',
      seccion: 'comprobanteDomicilio',
      key: 'companies/demo/comprobanteDomicilio/comprobante_domicilio.pdf',
      fileUrl: '/api/files/companies/demo/comprobanteDomicilio/comprobante_domicilio.pdf',
      size: 156789, // ~153 KB
      mime: 'application/pdf',
      extension: 'pdf',
    },
    {
      nombre: 'opinion_positiva_sat.pdf',
      seccion: 'opinionSat',
      key: 'companies/demo/opinionSat/opinion_positiva_sat.pdf',
      fileUrl: '/api/files/companies/demo/opinionSat/opinion_positiva_sat.pdf',
      size: 312456, // ~305 KB
      mime: 'application/pdf',
      extension: 'pdf',
    },
    {
      nombre: 'acta_constitutiva.pdf',
      seccion: 'actaConstitutiva',
      key: 'companies/demo/actaConstitutiva/acta_constitutiva.pdf',
      fileUrl: '/api/files/companies/demo/actaConstitutiva/acta_constitutiva.pdf',
      size: 856432, // ~836 KB
      mime: 'application/pdf',
      extension: 'pdf',
    },
  ],

  // ============================================================
  // SECCIÓN 10: Aceptación de términos
  // ============================================================
  terminosAceptados: true,

  // ============================================================
  // IMPL-20260624-01: canal (lo fuerza el server según la ruta)
  // ============================================================
  channel: 'PUBLIC_DIRECT' as const,
}

console.log('🔍 Validando payload de "Servicios Robles S.A. de C.V." contra CompanyFullFormPayloadSchema...\n')

const result = CompanyFullFormPayloadSchema.safeParse(serviciosRoblesPayload)

if (result.success) {
  console.log('✅ ¡Payload válido! "Servicios Robles" pasaría la validación Zod del backend.')
  console.log('\nResumen del registro:')
  console.log(`  Razón Social: ${result.data.fiscal.razonSocial}`)
  console.log(`  RFC:          ${result.data.fiscal.rfc}`)
  console.log(`  Domicilio:    ${result.data.fiscal.domicilioCalle}${result.data.fiscal.domicilioInterior ? ` Int. ${result.data.fiscal.domicilioInterior}` : ''}, ${result.data.fiscal.colonia}`)
  console.log(`  CP:           ${result.data.fiscal.cp} | ${result.data.fiscal.municipio}, ${result.data.fiscal.estado}`)
  console.log(`  Rep. Legal:   ${result.data.repLegal.nombre} ${result.data.repLegal.apellidos} <${result.data.repLegal.email}>`)
  console.log(`  RH:           ${result.data.rh.nombre} ${result.data.rh.apellidos} <${result.data.rh.email}>`)
  console.log(`  CxP:          ${result.data.cuentasPagar.nombre} ${result.data.cuentasPagar.apellidos} <${result.data.cuentasPagar.email}>`)
  console.log(`  Docs:         ${result.data.documentos.length} archivos (5 obligatorios)`)
  console.log(`  Referencias:  ${result.data.referencias?.length ?? 0} comerciales`)
  console.log(`  Entrega:      ${result.data.entregaFisica ? `${result.data.entregaFisica.dias?.length ?? 0} días` : 'no requiere'}`)
  console.log(`  Términos:     ${result.data.terminosAceptados ? 'aceptados ✓' : 'NO aceptados ✗'}`)
  console.log('\n--- Para persistir en DB: ---')
  console.log(`  POST /api/v1/submitPublicCompanySelfRegistration`)
  console.log(`  → Server crea Company con origen=AUTO_ALTA, estado=PENDIENTE_REVISION`)
  console.log(`  → Crea CompanySelfRegistration con channel='PUBLIC_DIRECT'`)
  console.log(`  → Crea AuditLog con action='CREATE'`)
  console.log(`  → Retorna { ok: true, companyId: <uuid> }`)
} else {
  console.log('❌ Payload INVÁLIDO. Errores de validación:')
  for (const issue of result.error.issues) {
    console.log(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

console.log(`\nℹ️  Catálogos usados: ${CFDI_USO_VALUES.length} CFDI, ${METODO_PAGO_VALUES.length} métodos de pago`)
