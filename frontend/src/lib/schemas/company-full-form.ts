/**
 * @file Zod schemas: Ficha Cliente v2 (ARCH-20260623-03)
 * @id IMPL-20260623-02
 * @backup context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 *
 * Validación consolidada del formulario extenso de auto-alta (10 secciones).
 * Las server actions y el cliente validan con estos mismos schemas para
 * evitar duplicación de reglas de negocio.
 *
 * Reglas:
 *   - El cliente solo valida UX; el server side es la fuente de verdad.
 *   - El RFC se valida con regex SAT mexicano (3-4 letras + 6 dígitos + 3 alfanuméricos).
 *   - El CP debe ser exactamente 5 dígitos numéricos.
 *   - El teléfono debe tener al menos 7 caracteres (mínimo operativo).
 *   - Los archivos obligatorios validan tamaño máximo server-side.
 */
import { z } from 'zod'

// --------------------------------------------------------------------------
// Constantes de tamaño (en bytes) — Sección 9 (documentos)
// --------------------------------------------------------------------------
/** Máx 3 MB — Constancia RFC, Identificación */
export const MAX_FILE_SIZE_3MB = 3 * 1024 * 1024
/** Máx 2 MB — Comprobante de domicilio */
export const MAX_FILE_SIZE_2MB = 2 * 1024 * 1024
/** Máx 4 MB — Opinión positiva SAT */
export const MAX_FILE_SIZE_4MB = 4 * 1024 * 1024
/** Máx 10 MB — Acta constitutiva / Otra documentación */
export const MAX_FILE_SIZE_10MB = 10 * 1024 * 1024

/** Tamaño global máximo aceptado (cubre el caso "Otra documentación" = 10MB). */
export const MAX_FILE_SIZE_GLOBAL = MAX_FILE_SIZE_10MB

/** Extensiones permitidas en documentos adjuntos (Sección 9). */
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  'gif',
  'jpg',
  'jpeg',
  'png',
  'pdf',
  'doc',
  'docx',
  'zip',
] as const

// --------------------------------------------------------------------------
// Catálogos permitidos
// --------------------------------------------------------------------------
/** Claves SAT c_ClaveUso soportadas por el enum CfdiUso (subset operativo). */
export const CFDI_USO_VALUES = [
  'G01', 'G02', 'G03',
  'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10',
  'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20',
  'P01', 'S01', 'CP01', 'CN01',
] as const

/** Métodos de pago soportados. */
export const METODO_PAGO_VALUES = ['PUE', 'PPD'] as const

/** Días de la semana para entrega física. */
export const DIAS_ENTREGA_VALUES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

// --------------------------------------------------------------------------
// Schemas por sección
// --------------------------------------------------------------------------

/** Sección 1: Información General y Fiscal. */
export const FiscalSchema = z.object({
  fecha: z.string().min(1, 'Fecha requerida'),
  razonSocial: z.string().min(1, 'Razón Social requerida').max(255),
  rfc: z
    .string()
    .min(1, 'RFC requerido')
    .regex(
      /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/,
      'RFC inválido (formato SAT: 3-4 letras, 6 dígitos, 3 alfanuméricos)'
    ),
  giro: z.string().min(1, 'Giro requerido').max(255),
  domicilio: z.string().min(1, 'Domicilio requerido').max(255),
  colonia: z.string().min(1, 'Colonia requerida').max(255),
  estado: z.string().min(1, 'Estado requerido'),
  municipio: z.string().min(1, 'Municipio requerido').max(255),
  pais: z.string().default('México'),
  cp: z
    .string()
    .regex(/^\d{5}$/, 'CP debe ser 5 dígitos numéricos'),
  usoCFDI: z.enum(CFDI_USO_VALUES, {
    error: 'Uso de CFDI inválido',
  }),
  metodoPago: z.enum(METODO_PAGO_VALUES, {
    error: 'Método de Pago inválido',
  }),
})

/** Sección 2: Datos Bancarios (opcional). */
export const BancarioSchema = z
  .object({
    banco: z.string().max(120).optional().or(z.literal('')),
    cuenta: z.string().max(40).optional().or(z.literal('')),
  })
  .optional()

/** Schema reutilizable para representante legal, RH, cuentas por pagar. */
export const PersonaContactoSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(120),
  apellidos: z.string().min(1, 'Apellidos requeridos').max(120),
  puesto: z.string().min(1, 'Puesto requerido').max(120),
  telefono: z
    .string()
    .min(7, 'Teléfono debe tener al menos 7 caracteres')
    .max(40),
  extension: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Email inválido'),
})

/** Sección 6: Facturación y envío de XML. */
export const FacturacionSchema = z.object({
  correoXml: z.string().email('Email XML inválido'),
  correoComplemento: z.string().email('Email complemento inválido').optional().or(z.literal('')),
  procesoFacturacion: z.string().max(2000).optional().or(z.literal('')),
})

/** Sección 7: Entrega Factura Física (opcional). */
export const EntregaFisicaSchema = z
  .object({
    dias: z.array(z.enum(DIAS_ENTREGA_VALUES)).optional(),
    horaRecepcion: z.string().regex(/^([01]\d|2[0-3])$/, 'Hora inválida (00-23)').optional().or(z.literal('')),
    minutoRecepcion: z.string().regex(/^[0-5]\d$/, 'Minuto inválido (00-59)').optional().or(z.literal('')),
    contactoRecibe: z.string().max(2000).optional().or(z.literal('')),
  })
  .optional()

/** Sección 8: Referencias comerciales (opcional, hasta 3). */
export const ReferenciaComercialSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(255),
  rfc: z.string().max(13).optional().or(z.literal('')),
  telefono: z.string().max(40).optional().or(z.literal('')),
  celular: z.string().max(40).optional().or(z.literal('')),
})

export const ReferenciasSchema = z
  .array(ReferenciaComercialSchema)
  .max(3, 'Máximo 3 referencias comerciales')
  .optional()

/** Documento adjunto (Sección 9). Validamos metadata; el binario viaja aparte. */
export const DocumentoAdjuntoSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(255),
  seccion: z.enum([
    'constanciaFiscal',
    'identificacionRepLegal',
    'comprobanteDomicilio',
    'opinionSat',
    'actaConstitutiva',
    'otraDocumentacion',
  ]),
  key: z.string().min(1, 'Key de bucket requerida'),
  fileUrl: z.string().min(1, 'URL de archivo requerida'),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE_GLOBAL, `Archivo excede el tamaño máximo permitido (${MAX_FILE_SIZE_GLOBAL / (1024 * 1024)} MB)`),
  mime: z.string().min(1).max(120),
  extension: z.enum(ALLOWED_DOCUMENT_EXTENSIONS, {
    error: 'Extensión de archivo no permitida',
  }),
})

/** Payload completo del formulario extenso (10 secciones). */
export const CompanyFullFormPayloadSchema = z.object({
  fiscal: FiscalSchema,
  bancario: BancarioSchema,
  repLegal: PersonaContactoSchema,
  rh: PersonaContactoSchema,
  cuentasPagar: PersonaContactoSchema,
  facturacion: FacturacionSchema,
  entregaFisica: EntregaFisicaSchema,
  referencias: ReferenciasSchema,
  documentos: z
    .array(DocumentoAdjuntoSchema)
    .min(5, 'Se requieren al menos 5 documentos obligatorios'),
  terminosAceptados: z.boolean().refine((v) => v === true, {
    message: 'Debe aceptar los términos y condiciones',
  }),
  /**
   * IMPL-20260624-01: Canal de origen del submit.
   * 'VENDOR_LINK' → link generado por vendedor (default retrocompatible).
   * 'PUBLIC_DIRECT' → submit desde ruta pública /solicitar-alta sin token.
   * El server action fuerza el valor según la ruta; este campo es informativo.
   */
  channel: z.enum(['VENDOR_LINK', 'PUBLIC_DIRECT']).optional(),
})

// --------------------------------------------------------------------------
// Tipos inferidos
// --------------------------------------------------------------------------
export type FiscalData = z.infer<typeof FiscalSchema>
export type BancarioData = z.infer<typeof BancarioSchema>
export type PersonaContactoData = z.infer<typeof PersonaContactoSchema>
export type FacturacionData = z.infer<typeof FacturacionSchema>
export type EntregaFisicaData = z.infer<typeof EntregaFisicaSchema>
export type ReferenciaComercialData = z.infer<typeof ReferenciaComercialSchema>
export type DocumentoAdjuntoData = z.infer<typeof DocumentoAdjuntoSchema>
export type CompanyFullFormPayload = z.infer<typeof CompanyFullFormPayloadSchema>

// --------------------------------------------------------------------------
// Helpers de validación adicional (server-side)
// --------------------------------------------------------------------------

/** Verifica que el RFC no esté registrado en otra Company. */
export async function assertRfcNotRegistered(
  rfc: string,
  prismaCompanyFindUnique: (args: { where: { rfc: string } }) => Promise<{ id: string } | null>,
  excludeCompanyId?: string
): Promise<{ duplicate: boolean; existingCompanyId?: string }> {
  const found = await prismaCompanyFindUnique({ where: { rfc } })
  if (!found) return { duplicate: false }
  if (excludeCompanyId && found.id === excludeCompanyId) return { duplicate: false }
  return { duplicate: true, existingCompanyId: found.id }
}

/** Verifica que un vendedor esté activo. */
export async function assertUserIsActive(
  userId: string,
  prismaUserFindUnique: (args: { where: { id: string } }) => Promise<{ isActive: boolean; role: string } | null>
): Promise<{ ok: true } | { ok: false; reason: 'NOT_FOUND' | 'INACTIVE' | 'NOT_SELLER' }> {
  const user = await prismaUserFindUnique({ where: { id: userId } })
  if (!user) return { ok: false, reason: 'NOT_FOUND' }
  if (user.role !== 'VENDEDOR' && user.role !== 'ADMIN') return { ok: false, reason: 'NOT_SELLER' }
  if (!user.isActive) return { ok: false, reason: 'INACTIVE' }
  return { ok: true }
}
