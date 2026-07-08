/**
 * @file Validaciones Zod para Fase 1 — B-v2 (bandeja papeletas) + E (catálogo estudios).
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción (ARCH-20260707-17).
 *
 * Replica los schemas Pydantic del backend para validación client-side
 * y server-side en server actions (que llaman a Prisma directo).
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Categoría "Laboratorio" — id confirmado en DB
// (context/SPECs/CONF-20260707-01-FLUJO-NOVA.md §2.1)
// ---------------------------------------------------------------------------
export const LAB_CATEGORY_ID = "64d3f863";

// ---------------------------------------------------------------------------
// B-v2 — Bandeja de papeletas
// ---------------------------------------------------------------------------
export const pendingEventTestSchema = z.object({
  id: z.string().min(1),
  testNameSnapshot: z.string(),
  medicalTestId: z.string().nullable().optional(),
  medicalTestCode: z.string().nullable().optional(),
  status: z.string(),
  selectedOption: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});

export const pendingOrderRowSchema = z.object({
  medicalEventId: z.string(),
  folio: z.string().nullable().optional(),
  workerId: z.string(),
  workerName: z.string(),
  workerCode: z.string(),
  companyName: z.string().nullable().optional(),
  doctorName: z.string(),
  intakeCreatedByUserId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  branchName: z.string().nullable().optional(),
  eventStatus: z.string(),
  eventCreatedAt: z.string().nullable().optional(),
  eventTests: z.array(pendingEventTestSchema),
  existingDraftLabOrderId: z.string().nullable().optional(),
  existingDraftLabOrderFolio: z.number().nullable().optional(),
});

export const pendingOrdersResponseSchema = z.object({
  branchId: z.string().nullable().optional(),
  categoryId: z.string(),
  total: z.number(),
  rows: z.array(pendingOrderRowSchema),
});

export type PendingEventTest = z.infer<typeof pendingEventTestSchema>;
export type PendingOrderRow = z.infer<typeof pendingOrderRowSchema>;
export type PendingOrdersResponse = z.infer<typeof pendingOrdersResponseSchema>;

// Re-exportar tipos de Zod → tipos Prisma-friendly
export type { PendingEventTest as PendingEventTestType, PendingOrderRow as PendingOrderRowType };

// ---------------------------------------------------------------------------
// E — Catálogo avanzado (MedicalTest + analitos + rangos)
// ---------------------------------------------------------------------------
export const labAnalyteDataTypeSchema = z.enum(["NUMERIC", "TEXT", "ENUM"]);
export type LabAnalyteDataType = z.infer<typeof labAnalyteDataTypeSchema>;

export const labSexSchema = z.enum(["M", "F", "A"]);
export type LabSex = z.infer<typeof labSexSchema>;

export const labCatalogReferenceRangeSchema = z.object({
  id: z.string(),
  sex: labSexSchema.default("A"),
  ageMinMonths: z.number().nullable().optional(),
  ageMaxMonths: z.number().nullable().optional(),
  valueMin: z.number().nullable().optional(),
  valueMax: z.number().nullable().optional(),
  textValue: z.string().nullable().optional(),
  unitCode: z.string().nullable().optional(),
  criticalLow: z.number().nullable().optional(),
  criticalHigh: z.number().nullable().optional(),
  isCritical: z.boolean().default(false),
});
export type LabCatalogReferenceRange = z.infer<typeof labCatalogReferenceRangeSchema>;

export const labCatalogAnalyteSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  orderIndex: z.number().default(0),
  dataType: labAnalyteDataTypeSchema.default("NUMERIC"),
  defaultUnitCode: z.string().nullable().optional(),
  active: z.boolean().default(true),
  referenceRanges: z.array(labCatalogReferenceRangeSchema).default([]),
});
export type LabCatalogAnalyte = z.infer<typeof labCatalogAnalyteSchema>;

export const labCatalogTestSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  categoryId: z.string(),
  novaClave: z.string().nullable().optional(),
  daysToResult: z.number().nullable().optional(),
  isProfile: z.boolean().default(false),
  isPackage: z.boolean().default(false),
  analytes: z.array(labCatalogAnalyteSchema).default([]),
});
export type LabCatalogTest = z.infer<typeof labCatalogTestSchema>;

export const labCatalogResponseSchema = z.object({
  categoryId: z.string(),
  total: z.number(),
  rows: z.array(labCatalogTestSchema),
});
export type LabCatalogResponse = z.infer<typeof labCatalogResponseSchema>;

// CRUD inputs ---------------------------------------------------------------
export const labAnalyteCreateSchema = z.object({
  medicalTestId: z.string().min(1),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  orderIndex: z.number().int().min(0).default(0),
  dataType: labAnalyteDataTypeSchema.default("NUMERIC"),
  defaultUnitCode: z.string().nullable().optional(),
  active: z.boolean().default(true),
});
export type LabAnalyteCreateInput = z.infer<typeof labAnalyteCreateSchema>;

export const labAnalyteUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  orderIndex: z.number().int().min(0).optional(),
  dataType: labAnalyteDataTypeSchema.optional(),
  defaultUnitCode: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export type LabAnalyteUpdateInput = z.infer<typeof labAnalyteUpdateSchema>;

export const labReferenceRangeCreateSchema = z.object({
  analyteId: z.string().min(1),
  sex: labSexSchema.default("A"),
  ageMinMonths: z.number().int().min(0).nullable().optional(),
  ageMaxMonths: z.number().int().min(0).nullable().optional(),
  valueMin: z.number().nullable().optional(),
  valueMax: z.number().nullable().optional(),
  textValue: z.string().max(200).nullable().optional(),
  unitCode: z.string().nullable().optional(),
  criticalLow: z.number().nullable().optional(),
  criticalHigh: z.number().nullable().optional(),
  isCritical: z.boolean().default(false),
});
export type LabReferenceRangeCreateInput = z.infer<typeof labReferenceRangeCreateSchema>;

export const labReferenceRangeUpdateSchema = z.object({
  sex: labSexSchema.optional(),
  ageMinMonths: z.number().int().min(0).nullable().optional(),
  ageMaxMonths: z.number().int().min(0).nullable().optional(),
  valueMin: z.number().nullable().optional(),
  valueMax: z.number().nullable().optional(),
  textValue: z.string().max(200).nullable().optional(),
  unitCode: z.string().nullable().optional(),
  criticalLow: z.number().nullable().optional(),
  criticalHigh: z.number().nullable().optional(),
  isCritical: z.boolean().optional(),
});
export type LabReferenceRangeUpdateInput = z.infer<typeof labReferenceRangeUpdateSchema>;

// Auto-generate (trigger explícito) ------------------------------------------
export const autoGenerateLabOrderSchema = z.object({
  medicalEventId: z.string().min(1),
});
export type AutoGenerateLabOrderInput = z.infer<typeof autoGenerateLabOrderSchema>;

export const autoGenerateLabOrderResponseSchema = z.object({
  medicalEventId: z.string(),
  labOrderId: z.string(),
  folio: z.number().nullable().optional(),
  status: z.string(),
  itemsCount: z.number(),
  alreadyExisted: z.boolean(),
});
export type AutoGenerateLabOrderResponse = z.infer<typeof autoGenerateLabOrderResponseSchema>;

// Mark sample taken ----------------------------------------------------------
export const markSampleTakenSchema = z.object({
  notes: z.string().max(500).optional().nullable(),
});
export type MarkSampleTakenInput = z.infer<typeof markSampleTakenSchema>;

export const markSampleTakenResponseSchema = z.object({
  eventTestId: z.string(),
  status: z.string(),
  triggeredLabOrder: autoGenerateLabOrderResponseSchema.nullable().optional(),
  alreadyTaken: z.boolean(),
});
export type MarkSampleTakenResponse = z.infer<typeof markSampleTakenResponseSchema>;

// Seed result ---------------------------------------------------------------
export const seedResultSchema = z.object({
  status: z.string(),
  seeded: z.number(),
  analytes: z.number(),
  referenceRanges: z.number(),
  note: z.string().optional().default(""),
});
export type SeedResult = z.infer<typeof seedResultSchema>;