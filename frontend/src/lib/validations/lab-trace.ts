/**
 * @file Schemas Zod para LabTraceEvent (Fase 2 NOVA absorción — D Trazabilidad).
 * @id IMPL-20260707-18
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 2)
 *
 * Réplica 1:1 del enum en backend/app/schemas/lab_trace.py.
 * Cambios aquí deben replicarse en backend.
 */
import { z } from "zod";
import { zFreeTextMaxNullable, zFreeTextMaxOptional } from "@/lib/text/zod-free-text";

// ---------------------------------------------------------------------------
// Enum de eventos
// ---------------------------------------------------------------------------
export const labTraceEventTypeSchema = z.enum([
  "SAMPLE_RECEIVED",
  "PROCESS_STARTED",
  "ANALYSIS_DONE",
  "VALIDATED",
  "DELIVERED",
]);
export type LabTraceEventType = z.infer<typeof labTraceEventTypeSchema>;

export const LAB_TRACE_EVENT_TYPES: LabTraceEventType[] = [
  "SAMPLE_RECEIVED",
  "PROCESS_STARTED",
  "ANALYSIS_DONE",
  "VALIDATED",
  "DELIVERED",
];

// ---------------------------------------------------------------------------
// Record (POST)
// ---------------------------------------------------------------------------
export const recordTraceEventSchema = z.object({
  event: labTraceEventTypeSchema,
  notes: zFreeTextMaxNullable(1000),
  location: zFreeTextMaxOptional(200),
});
export type RecordTraceEventInput = z.infer<typeof recordTraceEventSchema>;
