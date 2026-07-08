/**
 * @file Tests para schemas Zod de LabResult.
 * @id IMPL-20260707-16 — Slice C Resultados.
 */
import { describe, expect, it } from "vitest";
import {
  bulkCreateLabResultSchema,
  createLabResultItemSchema,
  linkLabOrderItemEventTestSchema,
  transitionLabResultSchema,
  updateLabResultSchema,
} from "@/lib/validations/lab-result";

const baseItem = {
  labOrderItemId: "item-1",
  analyteId: "an-1",
  valueNumber: 14.5,
};

describe("lab-result validation", () => {
  it("[happy] acepta item con valueNumber", () => {
    const parsed = createLabResultItemSchema.safeParse(baseItem);
    expect(parsed.success).toBe(true);
  });

  it("[happy] acepta item con valueText", () => {
    const parsed = createLabResultItemSchema.safeParse({
      ...baseItem,
      valueNumber: undefined,
      valueText: "Positivo",
    });
    expect(parsed.success).toBe(true);
  });

  it("[error] rechaza item sin valueText ni valueNumber", () => {
    const parsed = createLabResultItemSchema.safeParse({
      labOrderItemId: "item-1",
      analyteId: "an-1",
    });
    expect(parsed.success).toBe(false);
  });

  it("[error] rechaza valueText con >500 chars", () => {
    const parsed = createLabResultItemSchema.safeParse({
      ...baseItem,
      valueNumber: undefined,
      valueText: "x".repeat(501),
    });
    expect(parsed.success).toBe(false);
  });

  it("[happy] bulkCreateLabResultSchema acepta lista no vacía", () => {
    const parsed = bulkCreateLabResultSchema.safeParse({
      items: [baseItem, { ...baseItem, analyteId: "an-2" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("[error] bulkCreateLabResultSchema rechaza lista vacía", () => {
    const parsed = bulkCreateLabResultSchema.safeParse({ items: [] });
    expect(parsed.success).toBe(false);
  });

  it("[happy] updateLabResultSchema acepta parcial", () => {
    const parsed = updateLabResultSchema.safeParse({
      valueNumber: 15.2,
      observations: "capturado",
    });
    expect(parsed.success).toBe(true);
  });

  it("[happy] transitionLabResultSchema acepta report sin motivo", () => {
    const parsed = transitionLabResultSchema.safeParse({ action: "report" });
    expect(parsed.success).toBe(true);
  });

  it("[error] transitionLabResultSchema rechaza invalidate sin motivo", () => {
    const parsed = transitionLabResultSchema.safeParse({ action: "invalidate" });
    expect(parsed.success).toBe(false);
  });

  it("[error] transitionLabResultSchema rechaza invalidate con motivo <5 chars", () => {
    const parsed = transitionLabResultSchema.safeParse({
      action: "invalidate",
      reason: "ab",
    });
    expect(parsed.success).toBe(false);
  });

  it("[happy] transitionLabResultSchema acepta invalidate con motivo válido", () => {
    const parsed = transitionLabResultSchema.safeParse({
      action: "invalidate",
      reason: "Muestra hemolizada",
    });
    expect(parsed.success).toBe(true);
  });

  it("[error] linkLabOrderItemEventTestSchema rechaza itemId vacío", () => {
    const parsed = linkLabOrderItemEventTestSchema.safeParse({ itemId: "" });
    expect(parsed.success).toBe(false);
  });
});