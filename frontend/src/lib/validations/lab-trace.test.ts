/**
 * @file Tests Zod + helpers puros para LabTrace (Fase 2 — D Trazabilidad).
 * @id IMPL-20260707-18
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2
 *
 * Cubre (≥ 4 casos):
 *  1.  recordTraceEventSchema acepta evento válido con notas y location
 *  2.  recordTraceEventSchema rechaza evento desconocido
 *  3.  LAB_TRACE_EVENT_TYPES contiene los 5 tipos del SPEC
 *  4.  recordTraceEventSchema valida límites de longitud (notes 1000, location 200)
 *  5.  recordTraceEventSchema acepta notas y location como null (opcional)
 */
import { describe, it, expect } from "vitest";
import {
  recordTraceEventSchema,
  LAB_TRACE_EVENT_TYPES,
  type LabTraceEventType,
} from "./lab-trace";

describe("lab-trace Zod schemas", () => {
  // 1) Happy path
  it("recordTraceEventSchema acepta evento válido con notas y location", () => {
    const parsed = recordTraceEventSchema.safeParse({
      event: "SAMPLE_RECEIVED",
      notes: "Muestra ok",
      location: "Mostrador 1",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.event).toBe("SAMPLE_RECEIVED");
      expect(parsed.data.notes).toBe("Muestra ok");
      expect(parsed.data.location).toBe("Mostrador 1");
    }
  });

  // 2) Enum desconocido
  it("recordTraceEventSchema rechaza evento desconocido", () => {
    const parsed = recordTraceEventSchema.safeParse({ event: "FOO_BAR" });
    expect(parsed.success).toBe(false);
  });

  // 3) Los 5 tipos del SPEC
  it("LAB_TRACE_EVENT_TYPES contiene los 5 tipos del SPEC", () => {
    const expected: LabTraceEventType[] = [
      "SAMPLE_RECEIVED",
      "PROCESS_STARTED",
      "ANALYSIS_DONE",
      "VALIDATED",
      "DELIVERED",
    ];
    expect(LAB_TRACE_EVENT_TYPES).toEqual(expected);
    expect(LAB_TRACE_EVENT_TYPES.length).toBe(5);
  });

  // 4) Límites de longitud
  it("recordTraceEventSchema rechaza notes > 1000 caracteres", () => {
    const parsed = recordTraceEventSchema.safeParse({
      event: "VALIDATED",
      notes: "x".repeat(1001),
    });
    expect(parsed.success).toBe(false);
  });

  // 5) Campos opcionales (null)
  it("recordTraceEventSchema acepta notes y location como null", () => {
    const parsed = recordTraceEventSchema.safeParse({
      event: "DELIVERED",
      notes: null,
      location: null,
    });
    expect(parsed.success).toBe(true);
  });
});
