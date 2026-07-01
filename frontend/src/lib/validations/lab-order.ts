/**
 * @file Schemas Zod para LabOrder (Slice B NOVA absorción).
 * @id IMPL-20260701-03 — Slice B Recepción (ARCH-20260701-03).
 * @backup context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
 *
 * Single source of truth cliente/servidor para validación de admisión.
 * Réplica 1:1 de backend/app/schemas/lab_orders.py.
 * Cambios en uno deben replicarse en el otro.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const labOrderStatusSchema = z.enum([
  "DRAFT",
  "SAVED",
  "SAMPLE_TAKEN",
  "IN_PROCESS",
  "COMPLETED",
  "CANCELLED",
]);
export type LabOrderStatus = z.infer<typeof labOrderStatusSchema>;

export const labOrderUrgencySchema = z.enum(["NORMAL", "URGENT"]);
export const labOrderConfidentialitySchema = z.enum(["NORMAL", "CONFIDENTIAL"]);
export const labOrderLanguageSchema = z.enum(["es", "en"]);

// ---------------------------------------------------------------------------
// LabOrderItem
// ---------------------------------------------------------------------------
export const labOrderItemInputSchema = z.object({
  medicalTestId: z.string().min(1, "medicalTestId obligatorio"),
  price: z.number().min(0, "price no puede ser negativo"),
  discountAmount: z.number().min(0, "discountAmount no puede ser negativo").default(0),
  discountPct: z.number().min(0).max(100, "discountPct máximo 100").default(0),
});
export type LabOrderItemInput = z.infer<typeof labOrderItemInputSchema>;

// ---------------------------------------------------------------------------
// LabOrder base
// ---------------------------------------------------------------------------
export const createLabOrderSchema = z.object({
  workerId: z.string().min(1, "workerId obligatorio"),
  medicalEventId: z.string().min(1).optional().nullable(),
  companyId: z.string().min(1).optional().nullable(),
  classificationId: z.string().min(1).optional().nullable(),
  doctorName: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .max(120, "Máximo 120 caracteres"),
  doctorClave: z.string().max(40).optional().nullable(),
  patientDiscountPct: z.number().min(0).max(100).default(0),
  doctorDiscountPct: z.number().min(0).max(100).default(0),
  doctorCommissionPct: z.number().min(0).max(100).default(0),
  companyDiscountPct: z.number().min(0).max(100).default(0),
  urgency: labOrderUrgencySchema.default("NORMAL"),
  confidentiality: labOrderConfidentialitySchema.default("NORMAL"),
  homeSample: z.boolean().default(false),
  sendResultsByEmail: z.boolean().default(false),
  generateInvoice: z.boolean().default(false),
  language: labOrderLanguageSchema.default("es"),
  deliveryDate: z.string().optional().nullable(),
  deliveryTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato HH:MM")
    .optional()
    .nullable(),
  observations: z.string().max(2000).optional().nullable(),
  isCourtesy: z.boolean().default(false),
  courtesyType: z.string().max(120).optional().nullable(),
  items: z
    .array(labOrderItemInputSchema)
    .min(1, "Debe agregar al menos un estudio"),
});
export type CreateLabOrderInput = z.infer<typeof createLabOrderSchema>;

export const updateLabOrderSchema = createLabOrderSchema.partial();
export type UpdateLabOrderInput = z.infer<typeof updateLabOrderSchema>;

// ---------------------------------------------------------------------------
// Soft-delete payload
// ---------------------------------------------------------------------------
export const cancelLabOrderSchema = z.object({
  motivo: z.string().min(3, "Mínimo 3 caracteres").max(500, "Máximo 500 caracteres"),
});
export type CancelLabOrderInput = z.infer<typeof cancelLabOrderSchema>;

// ---------------------------------------------------------------------------
// Helpers de búsqueda (para autocomplete)
// ---------------------------------------------------------------------------
export const workerSearchResultSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  code: z.string(),
  age: z.number().optional().nullable(),
  companyName: z.string().optional().nullable(),
});
export type WorkerSearchResult = z.infer<typeof workerSearchResultSchema>;

export const doctorSearchResultSchema = z.object({
  name: z.string(),
  clave: z.string().optional().nullable(),
});
export type DoctorSearchResult = z.infer<typeof doctorSearchResultSchema>;

export const companySearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  rfc: z.string().optional().nullable(),
});
export type CompanySearchResult = z.infer<typeof companySearchResultSchema>;

export const labTestSearchResultSchema = z.object({
  id: z.string(),
  code: z.string(),
  alternateCode: z.string().optional().nullable(),
  name: z.string(),
  price: z.number().default(0),
});
export type LabTestSearchResult = z.infer<typeof labTestSearchResultSchema>;
