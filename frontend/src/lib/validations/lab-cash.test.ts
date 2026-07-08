/**
 * @file Tests Zod para Fase 3 NOVA — F (PDF) + G (Caja, Cortesías).
 * @id IMPL-20260708-19
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 3)
 *
 * Cubre (≥ 4 casos):
 *  1.  registerPaymentSchema acepta input válido
 *  2.  registerPaymentSchema rechaza amount <= 0
 *  3.  registerPaymentSchema rechaza método desconocido
 *  4.  PAYMENT_METHODS contiene los 5 métodos del enum
 *  5.  markCourtesySchema valida longitud del motivo
 *  6.  cashClosingQuerySchema acepta fechas opcionales
 */
import { describe, it, expect } from "vitest";
import {
  registerPaymentSchema,
  markCourtesySchema,
  cashClosingQuerySchema,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "./lab-cash";

describe("lab-cash Zod schemas", () => {
  // 1) Happy path
  it("registerPaymentSchema acepta input válido", () => {
    const parsed = registerPaymentSchema.safeParse({
      amount: 150.5,
      method: "CASH",
      reference: null,
      currency: "MXN",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(150.5);
      expect(parsed.data.method).toBe("CASH");
      expect(parsed.data.currency).toBe("MXN");
    }
  });

  // 2) amount <= 0
  it("registerPaymentSchema rechaza amount <= 0", () => {
    const parsed = registerPaymentSchema.safeParse({
      amount: 0,
      method: "CASH",
    });
    expect(parsed.success).toBe(false);
  });

  it("registerPaymentSchema rechaza amount negativo", () => {
    const parsed = registerPaymentSchema.safeParse({
      amount: -50,
      method: "CARD",
    });
    expect(parsed.success).toBe(false);
  });

  // 3) método desconocido
  it("registerPaymentSchema rechaza método desconocido", () => {
    const parsed = registerPaymentSchema.safeParse({
      amount: 100,
      method: "BITCOIN",
    });
    expect(parsed.success).toBe(false);
  });

  // 4) Los 5 métodos del enum
  it("PAYMENT_METHODS contiene los 5 métodos del enum PaymentMethod", () => {
    const expected: PaymentMethod[] = ["CASH", "CARD", "TRANSFER", "CHECK", "OTHER"];
    expect(PAYMENT_METHODS).toEqual(expected);
    expect(PAYMENT_METHODS.length).toBe(5);
  });

  it("PAYMENT_METHOD_LABEL tiene label para cada método", () => {
    for (const m of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABEL[m]).toBeTruthy();
    }
    expect(PAYMENT_METHOD_LABEL.CASH).toBe("Efectivo");
    expect(PAYMENT_METHOD_LABEL.CARD).toBe("Tarjeta");
  });

  // 5) Courtesy motivo
  it("markCourtesySchema acepta motivo de 3+ caracteres", () => {
    const parsed = markCourtesySchema.safeParse({ reason: "VIP corporativo" });
    expect(parsed.success).toBe(true);
  });

  it("markCourtesySchema rechaza motivo muy corto (< 3 chars)", () => {
    const parsed = markCourtesySchema.safeParse({ reason: "no" });
    expect(parsed.success).toBe(false);
  });

  it("markCourtesySchema rechaza motivo > 500 chars", () => {
    const parsed = markCourtesySchema.safeParse({ reason: "x".repeat(501) });
    expect(parsed.success).toBe(false);
  });

  // 6) Cash closing query
  it("cashClosingQuerySchema acepta fechas opcionales (undefined)", () => {
    const parsed = cashClosingQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  it("cashClosingQuerySchema acepta fechas opcionales (null)", () => {
    const parsed = cashClosingQuerySchema.safeParse({
      dateFrom: null,
      dateTo: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("cashClosingQuerySchema acepta fechas ISO", () => {
    const parsed = cashClosingQuerySchema.safeParse({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-07",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dateFrom).toBe("2026-07-01");
      expect(parsed.data.dateTo).toBe("2026-07-07");
    }
  });
});