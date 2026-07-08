/**
 * @file Schemas Zod para LabResult (Slice C NOVA absorción).
 * @id IMPL-20260707-16 — Slice C Resultados (ARCH-20260707-16).
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICE-C-RESULTADOS.md
 *
 * Réplica 1:1 de backend/app/schemas/lab_results.py.
 * Cambios aquí deben replicarse en backend.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const labResultStatusSchema = z.enum([
  "PENDING",
  "REPORTED",
  "AUTHORIZED",
  "VALIDATED",
  "INVALIDATED",
]);
export type LabResultStatus = z.infer<typeof labResultStatusSchema>;

export const labAnalyteDataTypeSchema = z.enum(["NUMERIC", "TEXT", "ENUM"]);
export type LabAnalyteDataType = z.infer<typeof labAnalyteDataTypeSchema>;

export const labSexSchema = z.enum(["M", "F", "A"]);
export type LabSex = z.infer<typeof labSexSchema>;

export const labResultTransitionActionSchema = z.enum([
  "report",
  "authorize",
  "validate",
  "invalidate",
]);
export type LabResultTransitionAction = z.infer<typeof labResultTransitionActionSchema>;

// ---------------------------------------------------------------------------
// LabResult — create individual (usado internamente por bulk)
// ---------------------------------------------------------------------------
export const createLabResultItemSchema = z
  .object({
    labOrderItemId: z.string().min(1, "labOrderItemId obligatorio"),
    analyteId: z.string().min(1, "analyteId obligatorio"),
    eventTestId: z.string().optional().nullable(),
    valueText: z.string().max(500).optional().nullable(),
    valueNumber: z.number().optional().nullable(),
    unitId: z.string().optional().nullable(),
    observations: z.string().max(2000).optional().nullable(),
    isAbnormal: z.boolean().optional().default(false),
  })
  .refine(
    (d) => d.valueText !== null && d.valueText !== undefined
      ? true
      : d.valueNumber !== null && d.valueNumber !== undefined,
    {
      message: "Debe proporcionar valueText o valueNumber",
      path: ["valueNumber"],
    }
  );
export type CreateLabResultItemInput = z.infer<typeof createLabResultItemSchema>;

// ---------------------------------------------------------------------------
// LabResult — bulk create
// ---------------------------------------------------------------------------
export const bulkCreateLabResultSchema = z.object({
  items: z
    .array(createLabResultItemSchema)
    .min(1, "Debe incluir al menos un resultado")
    .max(200, "Máximo 200 resultados por lote"),
});
export type BulkCreateLabResultInput = z.infer<typeof bulkCreateLabResultSchema>;

// ---------------------------------------------------------------------------
// LabResult — update
// ---------------------------------------------------------------------------
export const updateLabResultSchema = z.object({
  valueText: z.string().max(500).optional().nullable(),
  valueNumber: z.number().optional().nullable(),
  unitId: z.string().optional().nullable(),
  observations: z.string().max(2000).optional().nullable(),
  isAbnormal: z.boolean().optional(),
  eventTestId: z.string().optional().nullable(),
});
export type UpdateLabResultInput = z.infer<typeof updateLabResultSchema>;

// ---------------------------------------------------------------------------
// LabResult — transition
// ---------------------------------------------------------------------------
export const transitionLabResultSchema = z
  .object({
    action: labResultTransitionActionSchema,
    reason: z.string().max(500).optional(),
  })
  .refine(
    (d) => d.action !== "invalidate" || (d.reason && d.reason.length >= 5),
    {
      message: "Invalidar requiere motivo de al menos 5 caracteres",
      path: ["reason"],
    }
  );
export type TransitionLabResultInput = z.infer<typeof transitionLabResultSchema>;

// ---------------------------------------------------------------------------
// Link LabOrderItem ↔ EventTest
// ---------------------------------------------------------------------------
export const linkLabOrderItemEventTestSchema = z.object({
  itemId: z.string().min(1),
  eventTestId: z.string().min(1).nullable().optional(),
});
export type LinkLabOrderItemEventTestInput = z.infer<typeof linkLabOrderItemEventTestSchema>;