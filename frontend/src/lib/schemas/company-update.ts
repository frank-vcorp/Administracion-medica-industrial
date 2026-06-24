/**
 * @file Zod schemas: Actualización de datos completos de empresa (ARCH-20260624-03).
 * @id IMPL-20260624-03
 * @backup context/SPECs/SPEC_ARCH-20260624-03-EDICION-DATOS-COMPLETOS-EMPRESA.md
 *
 * Schemas de validación para dos vías de edición de datos de empresa:
 *   - Sub-A: submit externo (link público) sobre Company existente.
 *           Valida estructura completa + optimistic locking.
 *   - Sub-B: edición interna por ADMIN.
 *           Valida secciones individuales + optimistic locking.
 *
 * Reglas:
 *   - El cliente solo valida UX; el server side (actions y service) es la fuente de verdad.
 *   - El RFC se valida con regex SAT mexicano (3-4 letras + 6 dígitos + 3 alfanuméricos).
 *   - El CP debe ser exactamente 5 dígitos numéricos.
 *   - `expectedUpdatedAt` es obligatorio para Sub-B (optimistic locking).
 *
 * NO se incluye validación de unicidad de RFC contra BD aquí — eso se hace en el service
 * (assertRfcNotRegistered) que tiene acceso a Prisma.
 */
import { z } from 'zod'
import {
  FiscalSchema,
  PersonaContactoSchema,
  ReferenciaComercialSchema,
  DIAS_ENTREGA_VALUES,
  ALLOWED_DOCUMENT_EXTENSIONS,
} from '@/lib/schemas/company-full-form'

// --------------------------------------------------------------------------
// Regex SAT (re-exportado para uso en otros lugares)
// --------------------------------------------------------------------------
/** RFC mexicano: 3-4 letras (A-Z & Ñ) + 6 dígitos + 3 alfanuméricos. */
export const RFC_REGEX = /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/
/** CP México: exactamente 5 dígitos. */
export const CP_REGEX = /^\d{5}$/

// --------------------------------------------------------------------------
// Sub-B: schemas por sección (edición interna)
// --------------------------------------------------------------------------

/** Datos básicos de la Company (siempre editables). */
export const updateCompanyBasicSchema = z.object({
  name: z.string().min(1, 'Razón Social requerida').max(255),
  rfc: z
    .string()
    .regex(RFC_REGEX, 'RFC inválido (formato SAT)')
    .nullable()
    .optional(),
  address: z.string().max(500).nullable().optional(),
  contactName: z.string().max(255).nullable().optional(),
  email: z.string().email('Email inválido').nullable().optional(),
  phone: z.string().min(7, 'Teléfono debe tener al menos 7 caracteres').max(40).nullable().optional(),
})

/** Datos fiscales (extiende FiscalSchema del formulario extenso). */
export const updateFiscalSchema = FiscalSchema

/** Representante legal. */
export const updateRepLegalSchema = PersonaContactoSchema

/** RH / Seguridad / Compras. */
export const updateRhSchema = PersonaContactoSchema

/** Cuentas por pagar. */
export const updateCuentasPagarSchema = PersonaContactoSchema

/** Facturación y envío de XML. */
export const updateFacturacionSchema = z.object({
  correoXml: z.string().email('Email XML inválido'),
  correoComplemento: z.string().email('Email complemento inválido').optional().or(z.literal('')),
  procesoFacturacion: z.string().max(2000).optional().or(z.literal('')),
})

/** Entrega física. */
export const updateEntregaFisicaSchema = z
  .object({
    dias: z.array(z.enum(DIAS_ENTREGA_VALUES)).optional(),
    horaRecepcion: z.string().regex(/^([01]\d|2[0-3])$/, 'Hora inválida (00-23)').optional().or(z.literal('')),
    minutoRecepcion: z.string().regex(/^[0-5]\d$/, 'Minuto inválido (00-59)').optional().or(z.literal('')),
    contactoRecibe: z.string().max(2000).optional().or(z.literal('')),
  })
  .optional()

/** Referencias comerciales (array opcional, máximo 3). */
export const updateReferenciasSchema = z
  .array(ReferenciaComercialSchema)
  .max(3, 'Máximo 3 referencias comerciales')
  .optional()

/** Documentos adjuntos (metadata; binarios se suben aparte). */
export const updateDocumentoAdjuntoSchema = z.object({
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
  size: z.number().int().positive(),
  mime: z.string().min(1).max(120),
  extension: z.enum(ALLOWED_DOCUMENT_EXTENSIONS, {
    error: 'Extensión de archivo no permitida',
  }),
})

// --------------------------------------------------------------------------
// Schema consolidado para updateCompanyAction (Sub-B)
// --------------------------------------------------------------------------

/**
 * Payload completo de edición interna (Sub-B).
 * - `expectedUpdatedAt` es OBLIGATORIO (optimistic locking).
 * - Cada sección es opcional: solo se actualizan las que vienen presentes.
 * - Al menos una sección debe estar presente para evitar updates vacíos.
 */
export const updateCompanySchema = z
  .object({
    expectedUpdatedAt: z.string().datetime({
      message: 'expectedUpdatedAt debe ser ISO 8601 (optimistic locking)',
    }),
    basic: updateCompanyBasicSchema.partial().optional(),
    fiscalData: updateFiscalSchema.optional(),
    repLegalData: updateRepLegalSchema.optional(),
    rhData: updateRhSchema.optional(),
    cuentasPagarData: updateCuentasPagarSchema.optional(),
    facturacionData: updateFacturacionSchema.optional(),
    entregaFisicaData: updateEntregaFisicaSchema,
    referenciasData: updateReferenciasSchema,
    documentos: z.array(updateDocumentoAdjuntoSchema).optional(),
  })
  .refine(
    (data) => {
      // Al menos una sección debe estar presente.
      return (
        data.basic !== undefined ||
        data.fiscalData !== undefined ||
        data.repLegalData !== undefined ||
        data.rhData !== undefined ||
        data.cuentasPagarData !== undefined ||
        data.facturacionData !== undefined ||
        data.entregaFisicaData !== undefined ||
        data.referenciasData !== undefined ||
        data.documentos !== undefined
      )
    },
    {
      message: 'Debe incluir al menos una sección para actualizar',
    }
  )

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type UpdateCompanyBasicInput = z.infer<typeof updateCompanyBasicSchema>

// --------------------------------------------------------------------------
// Códigos de error (estables, exportados para tests y consumers)
// --------------------------------------------------------------------------
export const UPDATE_COMPANY_ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'INVALID_PAYLOAD',
  'NOT_FOUND',
  'CONCURRENT_UPDATE',
  'RFC_DUPLICATE',
  'TARGET_COMPANY_PENDING',
  'TARGET_COMPANY_GONE',
] as const

export type UpdateCompanyErrorCode = (typeof UPDATE_COMPANY_ERROR_CODES)[number]