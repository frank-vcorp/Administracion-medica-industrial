/**
 * @file Tests Zod para los 8 schemas de catálogos LIS.
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 * @backup context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md
 *
 * Verifica happy path + casos edge (campo vacío, enum inválido, campo
 * requerido faltante). Single source of truth debe pasar también en backend
 * (backend/app/schemas/lab_catalogs.py).
 */
import { describe, it, expect } from "vitest";
import {
  labUnitSchema,
  labSampleSchema,
  labContainerSchema,
  labMethodSchema,
  labProcessAreaSchema,
  labDepartmentSchema,
  labClassificationSchema,
  labIndicationSchema,
  labCatalogModSchema,
  resolveLabMod,
  isValidLabMod,
  LAB_CATALOG_MODS,
} from "./lab-catalog";

describe("lab-catalog Zod schemas", () => {
  // ---- labUnit ----
  it("labUnitSchema acepta input válido", () => {
    expect(
      labUnitSchema.safeParse({ symbol: "mg/dL", name: "Miligramos", system: "CONVENTIONAL" }).success
    ).toBe(true);
  });
  it("labUnitSchema rechaza symbol vacío", () => {
    expect(labUnitSchema.safeParse({ symbol: "", name: "X", system: "CONVENTIONAL" }).success).toBe(false);
  });
  it("labUnitSchema rechaza system inválido", () => {
    expect(labUnitSchema.safeParse({ symbol: "x", name: "X", system: "INVALID" }).success).toBe(false);
  });

  // ---- labSample ----
  it("labSampleSchema acepta input válido (sólo requeridos)", () => {
    expect(labSampleSchema.safeParse({ code: "SANGRE", name: "Sangre" }).success).toBe(true);
  });
  it("labSampleSchema rechaza falta de name", () => {
    expect(labSampleSchema.safeParse({ code: "X" }).success).toBe(false);
  });
  it("labSampleSchema acepta con campos opcionales", () => {
    expect(
      labSampleSchema.safeParse({
        code: "ORINA",
        name: "Orina",
        preservation: "Refrigerada 4°C",
        minVolume: "10 mL",
        defaultContainerId: null,
      }).success
    ).toBe(true);
  });

  // ---- labContainer ----
  it("labContainerSchema acepta input mínimo", () => {
    expect(labContainerSchema.safeParse({ code: "Tubo Lila", name: "Tubo tapa lila" }).success).toBe(true);
  });
  it("labContainerSchema acepta con color y cap", () => {
    expect(
      labContainerSchema.safeParse({
        code: "X",
        name: "X",
        color: "#9b59b6",
        cap: "Tapa lila",
      }).success
    ).toBe(true);
  });

  // ---- labMethod ----
  it("labMethodSchema acepta input mínimo", () => {
    expect(labMethodSchema.safeParse({ code: "ELISA", name: "ELISA" }).success).toBe(true);
  });
  it("labMethodSchema acepta con principio", () => {
    expect(
      labMethodSchema.safeParse({ code: "X", name: "X", principle: "Inmunoensayo" }).success
    ).toBe(true);
  });

  // ---- labProcessArea ----
  it("labProcessAreaSchema acepta sin departmentId", () => {
    expect(labProcessAreaSchema.safeParse({ code: "X", name: "X" }).success).toBe(true);
  });
  it("labProcessAreaSchema acepta con departmentId opcional", () => {
    expect(
      labProcessAreaSchema.safeParse({ code: "X", name: "X", departmentId: "uuid-abc" }).success
    ).toBe(true);
  });

  // ---- labDepartment ----
  it("labDepartmentSchema acepta input válido", () => {
    expect(labDepartmentSchema.safeParse({ code: "HEM", name: "Hematología" }).success).toBe(true);
  });
  it("labDepartmentSchema rechaza sin code", () => {
    expect(labDepartmentSchema.safeParse({ name: "X" }).success).toBe(false);
  });

  // ---- labClassification ----
  it("labClassificationSchema acepta con sortOrder", () => {
    expect(
      labClassificationSchema.safeParse({ code: "NORMAL", name: "Normal", sortOrder: 1 }).success
    ).toBe(true);
  });
  it("labClassificationSchema acepta color hex #RRGGBB", () => {
    expect(
      labClassificationSchema.safeParse({
        code: "X",
        name: "X",
        color: "#27ae60",
        sortOrder: 1,
      }).success
    ).toBe(true);
  });
  it("labClassificationSchema rechaza color no-hex", () => {
    expect(
      labClassificationSchema.safeParse({
        code: "X",
        name: "X",
        color: "rojo",
        sortOrder: 1,
      }).success
    ).toBe(false);
  });

  // ---- labIndication ----
  it("labIndicationSchema acepta input válido", () => {
    expect(labIndicationSchema.safeParse({ code: "AYUNO_8H", text: "Ayuno 8h" }).success).toBe(true);
  });
  it("labIndicationSchema rechaza text vacío", () => {
    expect(labIndicationSchema.safeParse({ code: "X", text: "" }).success).toBe(false);
  });
});

describe("lab-catalog mod helpers", () => {
  it("labCatalogModSchema acepta un mod válido", () => {
    expect(labCatalogModSchema.safeParse("unidades").success).toBe(true);
  });
  it("labCatalogModSchema rechaza mod desconocido", () => {
    expect(labCatalogModSchema.safeParse("inventado").success).toBe(false);
  });
  it("resolveLabMod devuelve 'unidades' cuando mod es null/undefined", () => {
    expect(resolveLabMod(null)).toBe("unidades");
    expect(resolveLabMod(undefined)).toBe("unidades");
    expect(resolveLabMod("")).toBe("unidades");
  });
  it("resolveLabMod conserva mod válido", () => {
    expect(resolveLabMod("muestras")).toBe("muestras");
  });
  it("resolveLabMod redirige mod inválido a 'unidades'", () => {
    expect(resolveLabMod("foo")).toBe("unidades");
  });
  it("isValidLabMod devuelve true sólo para mods conocidos", () => {
    expect(isValidLabMod("unidades")).toBe(true);
    expect(isValidLabMod("no-existe")).toBe(false);
    expect(isValidLabMod(null)).toBe(false);
  });
  it("LAB_CATALOG_MODS contiene los 8 mods esperados", () => {
    expect(LAB_CATALOG_MODS).toHaveLength(8);
    expect(LAB_CATALOG_MODS).toContain("unidades");
    expect(LAB_CATALOG_MODS).toContain("departamentos");
  });
});