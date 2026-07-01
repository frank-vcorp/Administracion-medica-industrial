/**
 * @file Tests para el helper puro de cálculo de totales LabOrder.
 * IMPL-20260701-03 — Slice B NOVA absorción.
 */
import { describe, expect, it } from "vitest";
import { calculateItemAmount, calculateTotals } from "@/lib/lab-order-totals";

describe("lab-order-totals", () => {
  it("caso 1: precio sin descuentos", () => {
    expect(calculateItemAmount(100, 0, 0)).toBe(100);
  });

  it("caso 2: descuento monetario", () => {
    expect(calculateItemAmount(100, 25, 0)).toBe(75);
  });

  it("caso 3: descuento porcentual", () => {
    expect(calculateItemAmount(200, 0, 10)).toBe(180);
  });

  it("caso 4: descuentos mixtos (monetario + %)", () => {
    // 100 - 20 - (100 * 0.10) = 70
    expect(calculateItemAmount(100, 20, 10)).toBe(70);
  });

  it("caso 5: descuentos mixtos en varios items → totales correctos", () => {
    const items = [
      { price: 200, discountAmount: 20, discountPct: 0 }, // 180
      { price: 150, discountAmount: 0, discountPct: 10 },  // 135
      { price: 100, discountAmount: 5, discountPct: 5 },   // 90
    ];
    const totals = calculateTotals(items, 16);
    expect(totals.subtotal).toBe(405);
    expect(totals.iva).toBe(64.8);
    expect(totals.total).toBe(469.8);
  });

  it("caso 6: lista vacía retorna 0", () => {
    const totals = calculateTotals([], 16);
    expect(totals.subtotal).toBe(0);
    expect(totals.iva).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("caso 7: IVA configurable al 0%", () => {
    const totals = calculateTotals([{ price: 100 }], 0);
    expect(totals.subtotal).toBe(100);
    expect(totals.iva).toBe(0);
    expect(totals.total).toBe(100);
  });

  it("caso 8: descuentos no pueden llevar el item a negativo", () => {
    expect(calculateItemAmount(50, 200, 0)).toBe(0);
  });

  it("caso 9: redondeo a 2 decimales", () => {
    // 33.333 * 3 = 99.999
    const totals = calculateTotals(
      [
        { price: 33.33 },
        { price: 33.33 },
        { price: 33.34 },
      ],
      16
    );
    expect(totals.subtotal).toBe(100);
    expect(totals.iva).toBe(16);
    expect(totals.total).toBe(116);
  });
});
