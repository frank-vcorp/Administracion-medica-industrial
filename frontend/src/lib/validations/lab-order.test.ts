/**
 * @file Tests para schemas Zod de LabOrder.
 * @id IMPL-20260701-03 — Slice B Recepción.
 */
import { describe, expect, it } from "vitest";
import {
  cancelLabOrderSchema,
  createLabOrderSchema,
  labOrderItemInputSchema,
  updateLabOrderSchema,
} from "@/lib/validations/lab-order";

const baseValidItem = {
  medicalTestId: "test-001",
  price: 250,
  discountAmount: 0,
  discountPct: 0,
};

const baseValidOrder = {
  workerId: "worker-001",
  doctorName: "Dr. Pérez",
  items: [baseValidItem],
};

describe("lab-order validation", () => {
  it("[happy] createLabOrderSchema acepta entrada mínima válida", () => {
    const parsed = createLabOrderSchema.safeParse(baseValidOrder);
    expect(parsed.success).toBe(true);
  });

  it("[happy] defaults se aplican (urgency, confidentiality, language, booleanos)", () => {
    const parsed = createLabOrderSchema.safeParse(baseValidOrder);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.urgency).toBe("NORMAL");
      expect(parsed.data.confidentiality).toBe("NORMAL");
      expect(parsed.data.language).toBe("es");
      expect(parsed.data.homeSample).toBe(false);
      expect(parsed.data.sendResultsByEmail).toBe(false);
      expect(parsed.data.generateInvoice).toBe(false);
      expect(parsed.data.isCourtesy).toBe(false);
    }
  });

  it("[error] rechaza items vacío", () => {
    const parsed = createLabOrderSchema.safeParse({
      ...baseValidOrder,
      items: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("[error] rechaza discountPct > 100 en item", () => {
    const parsed = createLabOrderSchema.safeParse({
      ...baseValidOrder,
      items: [{ ...baseValidItem, discountPct: 150 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("[error] rechaza doctorName con < 2 caracteres", () => {
    const parsed = createLabOrderSchema.safeParse({
      ...baseValidOrder,
      doctorName: "X",
    });
    expect(parsed.success).toBe(false);
  });

  it("[error] rechaza deliveryTime con formato inválido", () => {
    const parsed = createLabOrderSchema.safeParse({
      ...baseValidOrder,
      deliveryTime: "not-a-time",
    });
    expect(parsed.success).toBe(false);
  });

  it("[error] rechaza item con price negativo", () => {
    const parsed = createLabOrderSchema.safeParse({
      ...baseValidOrder,
      items: [{ ...baseValidItem, price: -10 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("[happy] updateLabOrderSchema acepta parcial", () => {
    const parsed = updateLabOrderSchema.safeParse({
      urgency: "URGENT",
      observations: "Paciente prioritario",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.urgency).toBe("URGENT");
      expect(parsed.data.observations).toBe("Paciente prioritario");
    }
  });

  it("[happy] labOrderItemInputSchema acepta sin discount* (defaults)", () => {
    const parsed = labOrderItemInputSchema.safeParse({
      medicalTestId: "test-002",
      price: 100,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.discountAmount).toBe(0);
      expect(parsed.data.discountPct).toBe(0);
    }
  });

  it("[error] cancelLabOrderSchema rechaza motivo < 3 caracteres", () => {
    const parsed = cancelLabOrderSchema.safeParse({ motivo: "ok" });
    expect(parsed.success).toBe(false);
  });
});
