/**
 * @file Tests para helpers de LabResult.
 * @id IMPL-20260707-16 — Slice C Resultados.
 */
import { describe, expect, it } from "vitest";
import {
  calculateAgeInMonths,
  canTransition,
  formatRange,
  getStatusColor,
  getStatusLabel,
  validateValueAgainstRange,
} from "@/lib/lab-result-utils";
import type { LabResultStatus } from "@/lib/validations/lab-result";

describe("lab-result-utils", () => {
  describe("validateValueAgainstRange", () => {
    it("[happy] valor dentro de rango → normal", () => {
      const r = validateValueAgainstRange(14, null, { valueMin: 12, valueMax: 17 });
      expect(r.isOutOfRange).toBe(false);
      expect(r.isCritical).toBe(false);
    });

    it("[error] valor por encima del rango → out-of-range", () => {
      const r = validateValueAgainstRange(20, null, { valueMin: 12, valueMax: 17 });
      expect(r.isOutOfRange).toBe(true);
    });

    it("[error] valor por debajo del rango → out-of-range", () => {
      const r = validateValueAgainstRange(8, null, { valueMin: 12, valueMax: 17 });
      expect(r.isOutOfRange).toBe(true);
    });

    it("[critical] valor <= criticalLow → crítico", () => {
      const r = validateValueAgainstRange(3, null, {
        valueMin: 12,
        valueMax: 17,
        criticalLow: 5,
      });
      expect(r.isCritical).toBe(true);
    });

    it("[text] valor de texto matchea textValue", () => {
      const r = validateValueAgainstRange(null, "Positivo", {
        textValue: "Positivo",
      });
      expect(r.matchedText).toBe(true);
    });
  });

  describe("calculateAgeInMonths", () => {
    it("[happy] fecha 2 años 7 meses → 31 meses", () => {
      const bd = new Date(2023, 0, 1);
      const sd = new Date(2025, 7, 1);
      expect(calculateAgeInMonths(bd, sd)).toBe(31);
    });

    it("[edge] fecha futura → 0 meses", () => {
      const bd = new Date(2026, 0, 1);
      const sd = new Date(2025, 0, 1);
      expect(calculateAgeInMonths(bd, sd)).toBe(0);
    });

    it("[edge] birthDate null → null", () => {
      const r = calculateAgeInMonths(null);
      expect(r).toBe(null);
    });
  });

  describe("status helpers", () => {
    it("getStatusLabel mapea todos los estados", () => {
      const statuses: LabResultStatus[] = [
        "PENDING",
        "REPORTED",
        "AUTHORIZED",
        "VALIDATED",
        "INVALIDATED",
      ];
      for (const s of statuses) {
        expect(getStatusLabel(s)).toBeTruthy();
        expect(getStatusColor(s)).toContain("bg-");
      }
    });

    it("canTransition respeta tabla legal", () => {
      expect(canTransition("PENDING", "REPORTED")).toBe(true);
      expect(canTransition("PENDING", "VALIDATED")).toBe(false);
      expect(canTransition("INVALIDATED", "PENDING")).toBe(false);
    });
  });

  describe("formatRange", () => {
    it("renderiza rangos por sexo", () => {
      const s = formatRange([
        { sex: "M", valueMin: 13, valueMax: 17 },
        { sex: "F", valueMin: 12, valueMax: 16 },
      ]);
      expect(s).toContain("M: 13-17");
      expect(s).toContain("F: 12-16");
    });

    it("renderiza '—' sin rangos", () => {
      expect(formatRange([])).toBe("—");
    });
  });
});