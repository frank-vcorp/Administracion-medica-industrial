/**
 * Test directo del servicio submitPublicCompanySelfRegistration.
 * Bypassea la UI y llama directamente al service layer para confirmar
 * que el Server Function LLEGA a la DB.
 *
 * @id TEST-20260624-SERVICIOS-ROBLES
 */
import { PrismaClient } from "@prisma/client"
import { writeFileSync } from "fs"

const prisma = new PrismaClient()

const payload = {
  fiscal: {
    fecha: new Date().toISOString(),
    razonSocial: "Servicios Robles S.A. de C.V.",
    rfc: "SRO250101AB3",
    giro: "Servicios Industriales",
    // FIX-ARCH-20260624-05: domicilio en 3 campos.
    domicilioCalle: "Av. Industrias 1234",
    domicilioInterior: "5",
    domicilioExterior: "",
    colonia: "Parque Industrial Querétaro",
    estado: "Querétaro",
    municipio: "Querétaro",
    pais: "México",
    cp: "76220",
    usoCFDI: "G03",
    metodoPago: "PUE",
  },
  bancario: {
    banco: "BBVA México",
    cuenta: "01234567890123456789",
  },
  repLegal: {
    nombre: "Juan Carlos",
    apellidos: "Robles Mendoza",
    puesto: "Director General",
    telefono: "4421234567",
    extension: "101",
    email: "juan.robles@serviciosrobles.com.mx",
  },
  rh: {
    nombre: "María Elena",
    apellidos: "García Pérez",
    puesto: "Gerente de Recursos Humanos",
    telefono: "4421234568",
    extension: "102",
    email: "rh@serviciosrobles.com.mx",
  },
  cuentasPagar: {
    nombre: "Roberto",
    apellidos: "Hernández López",
    puesto: "Jefe de Cuentas por Pagar",
    telefono: "4421234569",
    extension: "103",
    email: "cxp@serviciosrobles.com.mx",
  },
  facturacion: {
    correoXml: "facturacion@serviciosrobles.com.mx",
    correoComplemento: "pagos@serviciosrobles.com.mx",
    procesoFacturacion: "Recepción de facturas, validación con orden de compra, programación de pago a 15 días.",
  },
  entregaFisica: {
    dias: ["L", "M", "X", "J", "V"],
    // FIX-ARCH-20260624-05: rango horario De/A.
    horaDe: "09",
    minutoDe: "00",
    horaA: "14",
    minutoA: "00",
    // FIX-ARCH-20260624-05: contacto estructurado.
    contactoRecibe: {
      nombre: "María García",
      telefono: "4421234500",
      celular: "4425556677",
    },
  },
  referencias: undefined,
  documentos: [
    {
      nombre: "constancia_fiscal.pdf",
      seccion: "constanciaFiscal",
      key: "companies/public/test-servicios-robles/constanciaFiscal/constancia_fiscal.pdf",
      fileUrl: "/api/files/companies/public/test-servicios-robles/constanciaFiscal/constancia_fiscal.pdf",
      size: 125,
      mime: "application/pdf",
      extension: "pdf",
    },
    {
      nombre: "ine.pdf",
      seccion: "identificacionRepLegal",
      key: "companies/public/test-servicios-robles/identificacionRepLegal/ine.pdf",
      fileUrl: "/api/files/companies/public/test-servicios-robles/identificacionRepLegal/ine.pdf",
      size: 125,
      mime: "application/pdf",
      extension: "pdf",
    },
    {
      nombre: "comprobante.pdf",
      seccion: "comprobanteDomicilio",
      key: "companies/public/test-servicios-robles/comprobanteDomicilio/comprobante.pdf",
      fileUrl: "/api/files/companies/public/test-servicios-robles/comprobanteDomicilio/comprobante.pdf",
      size: 125,
      mime: "application/pdf",
      extension: "pdf",
    },
    {
      nombre: "opinion.pdf",
      seccion: "opinionSat",
      key: "companies/public/test-servicios-robles/opinionSat/opinion.pdf",
      fileUrl: "/api/files/companies/public/test-servicios-robles/opinionSat/opinion.pdf",
      size: 125,
      mime: "application/pdf",
      extension: "pdf",
    },
    {
      nombre: "acta.pdf",
      seccion: "actaConstitutiva",
      key: "companies/public/test-servicios-robles/actaConstitutiva/acta.pdf",
      fileUrl: "/api/files/companies/public/test-servicios-robles/actaConstitutiva/acta.pdf",
      size: 125,
      mime: "application/pdf",
      extension: "pdf",
    },
  ],
  terminosAceptados: true as const,
}

async function run() {
  console.log("=== TEST DIRECTO: invocando submitCompanySelfRegistrationCore ===\n")

  // 1. Verificar empresas con RFC "SRO250101AB3" antes
  const before = await prisma.company.findFirst({ where: { rfc: "SRO250101AB3" } })
  console.log(`Antes: ¿Existe SRO250101AB3?  ${before ? `SÍ (id=${before.id})` : "NO"}`)

  // 2. Validar schema Zod (import dinámico)
  const { CompanyFullFormPayloadSchema } = await import("../src/lib/schemas/company-full-form")
  const parsed = CompanyFullFormPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    console.error("❌ Zod validation FAILED:")
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`)
    }
    process.exit(1)
  }
  console.log(`✓ Zod validation OK (${parsed.success})`)

  // 3. Invocar el servicio directamente
  console.log("\nInvocando submitPublicCompanySelfRegistration(...)...")
  const mod = await import("../src/services/company.service")
  const result = await mod.submitPublicCompanySelfRegistration(parsed.data)

  console.log("\nResultado:", JSON.stringify(result, null, 2))

  if (result.ok) {
    console.log(`\n🎉 ¡Company creada con ID ${result.companyId}!`)
    // Re-verificar en DB
    const after = await prisma.company.findUnique({ where: { id: result.companyId } })
    if (after) {
      console.log(`\nVerificación DB:`)
      console.log(`  Nombre:    ${after.name}`)
      console.log(`  RFC:       ${after.rfc}`)
      console.log(`  Estado:    ${after.estado}`)
      console.log(`  Origen:    ${after.origen}`)
      console.log(`  createdAt: ${after.createdAt}`)
    }

    // Verificar CompanySelfRegistration
    const selfReg = await prisma.companySelfRegistration.findFirst({
      where: { submittedCompanyId: result.companyId },
    })
    if (selfReg) {
      console.log(`\nCompanySelfRegistration:`)
      console.log(`  channel:     ${selfReg.channel}`)
      console.log(`  status:      ${selfReg.status}`)
      console.log(`  expiresAt:   ${selfReg.expiresAt}`)
    }

    // Verificar AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entity: "Company", entityId: result.companyId, action: "CREATE" },
    })
    console.log(`\nAuditLog CREATE: ${audit ? "✓ existe" : "✗ no existe"}`)
  } else {
    console.log(`\n❌ ${result.code}: ${result.error}`)
  }

  await prisma.$disconnect()
}

run().catch(async (e) => {
  console.error("\nERROR FATAL:", e)
  await prisma.$disconnect()
  process.exit(1)
})
