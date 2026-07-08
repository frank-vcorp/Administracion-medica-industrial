/**
 * @file Server Actions para Fase 1 — E catálogo avanzado de estudios.
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción (ARCH-20260707-17).
 *
 * CRUD de LabAnalyte + LabReferenceRange + seed de 5 estudios típicos.
 * Server actions usan Prisma directo (mismo patrón que lab-order.actions.ts).
 */
"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import {
  type LabAnalyteCreateInput,
  labAnalyteCreateSchema,
  type LabAnalyteUpdateInput,
  labAnalyteUpdateSchema,
  type LabCatalogResponse,
  LAB_CATEGORY_ID,
  type LabReferenceRangeCreateInput,
  labReferenceRangeCreateSchema,
  type LabReferenceRangeUpdateInput,
  labReferenceRangeUpdateSchema,
  type SeedResult,
} from "@/lib/validations/study";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

async function _requireAdmin(): Promise<{ userId: string; role: string } | null> {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const userId = session?.user?.id;
    if (!session?.user || !userId) return null;
    const allowed = ["ADMIN", "LAB_ANALYST", "LAB_VALIDATOR"];
    if (!allowed.includes(role ?? "")) return null;
    return { userId, role: role ?? "ADMIN" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers de unidades — buscar/crear LabUnit por code
// ---------------------------------------------------------------------------
async function _resolveUnitId(code: string | null | undefined): Promise<string | null> {
  if (!code) return null;
  const u = await prisma.labUnit.findFirst({
    where: { symbol: { equals: code, mode: "insensitive" } },
    select: { id: true },
  });
  return u?.id ?? null;
}

// ---------------------------------------------------------------------------
// 1) GET — Catálogo de estudios de Laboratorio
// ---------------------------------------------------------------------------
export async function getLabCatalogAction(
  search?: string | null
): Promise<ActionResult<LabCatalogResponse>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const where = search
      ? {
          categoryId: LAB_CATEGORY_ID,
          OR: [
            { code: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : { categoryId: LAB_CATEGORY_ID };

    const tests = await prisma.medicalTest.findMany({
      where,
      include: {
        analytes: {
          include: {
            referenceRanges: true,
            defaultUnit: { select: { symbol: true } },
          },
          orderBy: [{ orderIndex: "asc" }, { code: "asc" }],
        },
      },
      orderBy: { code: "asc" },
    });

    const rows = tests.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      categoryId: t.categoryId,
      novaClave: t.novaClave ?? null,
      daysToResult: t.daysToResult ?? null,
      isProfile: t.isProfile,
      isPackage: t.isPackage,
      analytes: t.analytes.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        orderIndex: a.orderIndex,
        dataType: a.dataType,
        defaultUnitCode: a.defaultUnit?.symbol ?? null,
        active: a.active,
        referenceRanges: a.referenceRanges.map((r) => ({
          id: r.id,
          sex: r.sex,
          ageMinMonths: r.ageMinMonths ?? null,
          ageMaxMonths: r.ageMaxMonths ?? null,
          valueMin: r.valueMin ?? null,
          valueMax: r.valueMax ?? null,
          textValue: r.textValue ?? null,
          unitCode: null as string | null,
          criticalLow: r.criticalLow ?? null,
          criticalHigh: r.criticalHigh ?? null,
          isCritical: r.isCritical,
        })),
      })),
    }));

    return {
      ok: true,
      data: {
        categoryId: LAB_CATEGORY_ID,
        total: rows.length,
        rows,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

// ---------------------------------------------------------------------------
// 2) GET — Estudio individual con sus analitos y rangos
// ---------------------------------------------------------------------------
export async function getLabCatalogTestAction(
  testId: string
): Promise<
  ActionResult<{
    id: string;
    code: string;
    name: string;
    categoryId: string;
    novaClave: string | null;
    daysToResult: number | null;
    isProfile: boolean;
    isPackage: boolean;
    analytes: Array<{
      id: string;
      code: string;
      name: string;
      orderIndex: number;
      dataType: string;
      defaultUnitCode: string | null;
      active: boolean;
      referenceRanges: Array<{
        id: string;
        sex: string;
        ageMinMonths: number | null;
        ageMaxMonths: number | null;
        valueMin: number | null;
        valueMax: number | null;
        textValue: string | null;
        unitCode: string | null;
        criticalLow: number | null;
        criticalHigh: number | null;
        isCritical: boolean;
      }>;
    }>;
  }>
> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const t = await prisma.medicalTest.findUnique({
      where: { id: testId },
      include: {
        analytes: {
          include: {
            referenceRanges: { include: { unit: { select: { symbol: true } } } },
            defaultUnit: { select: { symbol: true } },
          },
          orderBy: [{ orderIndex: "asc" }, { code: "asc" }],
        },
      },
    });
    if (!t) return { ok: false, error: "MedicalTest no existe", code: "NOT_FOUND" };

    return {
      ok: true,
      data: {
        id: t.id,
        code: t.code,
        name: t.name,
        categoryId: t.categoryId,
        novaClave: t.novaClave ?? null,
        daysToResult: t.daysToResult ?? null,
        isProfile: t.isProfile,
        isPackage: t.isPackage,
        analytes: t.analytes.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          orderIndex: a.orderIndex,
          dataType: a.dataType,
          defaultUnitCode: a.defaultUnit?.symbol ?? null,
          active: a.active,
          referenceRanges: a.referenceRanges.map((r) => ({
            id: r.id,
            sex: r.sex,
            ageMinMonths: r.ageMinMonths ?? null,
            ageMaxMonths: r.ageMaxMonths ?? null,
            valueMin: r.valueMin ?? null,
            valueMax: r.valueMax ?? null,
            textValue: r.textValue ?? null,
            unitCode: r.unit?.symbol ?? null,
            criticalLow: r.criticalLow ?? null,
            criticalHigh: r.criticalHigh ?? null,
            isCritical: r.isCritical,
          })),
        })),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

// ---------------------------------------------------------------------------
// 3) LabAnalyte CRUD
// ---------------------------------------------------------------------------
export async function createAnalyteAction(
  input: LabAnalyteCreateInput
): Promise<ActionResult<{ id: string; code: string; name: string }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = labAnalyteCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    const test = await prisma.medicalTest.findUnique({ where: { id: parsed.data.medicalTestId } });
    if (!test) return { ok: false, error: "MedicalTest no existe", code: "NOT_FOUND" };

    const existing = await prisma.labAnalyte.findUnique({
      where: {
        medicalTestId_code: {
          medicalTestId: parsed.data.medicalTestId,
          code: parsed.data.code,
        },
      },
    });
    if (existing) {
      return {
        ok: false,
        error: `Ya existe analito con code=${parsed.data.code} en este MedicalTest`,
        code: "DUPLICATE",
      };
    }

    const unitId = await _resolveUnitId(parsed.data.defaultUnitCode ?? null);

    const created = await prisma.labAnalyte.create({
      data: {
        medicalTestId: parsed.data.medicalTestId,
        code: parsed.data.code,
        name: parsed.data.name,
        orderIndex: parsed.data.orderIndex,
        dataType: parsed.data.dataType,
        defaultUnitId: unitId,
        active: parsed.data.active,
      },
    });
    revalidatePath(`/admin/lab/catalog/${parsed.data.medicalTestId}`);
    return {
      ok: true,
      data: { id: created.id, code: created.code, name: created.name },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

export async function updateAnalyteAction(
  analyteId: string,
  input: LabAnalyteUpdateInput
): Promise<ActionResult<{ id: string }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = labAnalyteUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    const existing = await prisma.labAnalyte.findUnique({ where: { id: analyteId } });
    if (!existing) return { ok: false, error: "LabAnalyte no existe", code: "NOT_FOUND" };

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.orderIndex !== undefined) data.orderIndex = parsed.data.orderIndex;
    if (parsed.data.dataType !== undefined) data.dataType = parsed.data.dataType;
    if (parsed.data.active !== undefined) data.active = parsed.data.active;
    if (parsed.data.defaultUnitCode !== undefined) {
      data.defaultUnitId = await _resolveUnitId(parsed.data.defaultUnitCode);
    }

    await prisma.labAnalyte.update({ where: { id: analyteId }, data });
    revalidatePath(`/admin/lab/catalog/${existing.medicalTestId}`);
    return { ok: true, data: { id: analyteId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

export async function deleteAnalyteAction(
  analyteId: string
): Promise<ActionResult<{ id: string }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const existing = await prisma.labAnalyte.findUnique({ where: { id: analyteId } });
    if (!existing) return { ok: false, error: "LabAnalyte no existe", code: "NOT_FOUND" };
    await prisma.labAnalyte.delete({ where: { id: analyteId } });
    revalidatePath(`/admin/lab/catalog/${existing.medicalTestId}`);
    return { ok: true, data: { id: analyteId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

// ---------------------------------------------------------------------------
// 4) LabReferenceRange CRUD
// ---------------------------------------------------------------------------
export async function createReferenceRangeAction(
  input: LabReferenceRangeCreateInput
): Promise<ActionResult<{ id: string }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = labReferenceRangeCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    const analyte = await prisma.labAnalyte.findUnique({
      where: { id: parsed.data.analyteId },
      include: { medicalTest: true },
    });
    if (!analyte) return { ok: false, error: "LabAnalyte no existe", code: "NOT_FOUND" };

    const unitId = await _resolveUnitId(parsed.data.unitCode ?? null);

    const created = await prisma.labReferenceRange.create({
      data: {
        analyteId: parsed.data.analyteId,
        sex: parsed.data.sex,
        ageMinMonths: parsed.data.ageMinMonths ?? null,
        ageMaxMonths: parsed.data.ageMaxMonths ?? null,
        valueMin: parsed.data.valueMin ?? null,
        valueMax: parsed.data.valueMax ?? null,
        textValue: parsed.data.textValue ?? null,
        unitId,
        criticalLow: parsed.data.criticalLow ?? null,
        criticalHigh: parsed.data.criticalHigh ?? null,
        isCritical: parsed.data.isCritical,
      },
    });
    revalidatePath(`/admin/lab/catalog/${analyte.medicalTestId}`);
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

export async function updateReferenceRangeAction(
  rangeId: string,
  input: LabReferenceRangeUpdateInput
): Promise<ActionResult<{ id: string }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  const parsed = labReferenceRangeUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Validación: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      code: "VALIDATION",
    };
  }
  try {
    const existing = await prisma.labReferenceRange.findUnique({
      where: { id: rangeId },
      include: { analyte: true },
    });
    if (!existing) return { ok: false, error: "LabReferenceRange no existe", code: "NOT_FOUND" };

    const data: Record<string, unknown> = {};
    if (parsed.data.sex !== undefined) data.sex = parsed.data.sex;
    if (parsed.data.ageMinMonths !== undefined) data.ageMinMonths = parsed.data.ageMinMonths;
    if (parsed.data.ageMaxMonths !== undefined) data.ageMaxMonths = parsed.data.ageMaxMonths;
    if (parsed.data.valueMin !== undefined) data.valueMin = parsed.data.valueMin;
    if (parsed.data.valueMax !== undefined) data.valueMax = parsed.data.valueMax;
    if (parsed.data.textValue !== undefined) data.textValue = parsed.data.textValue;
    if (parsed.data.criticalLow !== undefined) data.criticalLow = parsed.data.criticalLow;
    if (parsed.data.criticalHigh !== undefined) data.criticalHigh = parsed.data.criticalHigh;
    if (parsed.data.isCritical !== undefined) data.isCritical = parsed.data.isCritical;
    if (parsed.data.unitCode !== undefined) {
      data.unitId = await _resolveUnitId(parsed.data.unitCode);
    }

    await prisma.labReferenceRange.update({ where: { id: rangeId }, data });
    revalidatePath(`/admin/lab/catalog/${existing.analyte.medicalTestId}`);
    return { ok: true, data: { id: rangeId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

export async function deleteReferenceRangeAction(
  rangeId: string
): Promise<ActionResult<{ id: string }>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const existing = await prisma.labReferenceRange.findUnique({
      where: { id: rangeId },
      include: { analyte: true },
    });
    if (!existing) return { ok: false, error: "LabReferenceRange no existe", code: "NOT_FOUND" };
    await prisma.labReferenceRange.delete({ where: { id: rangeId } });
    revalidatePath(`/admin/lab/catalog/${existing.analyte.medicalTestId}`);
    return { ok: true, data: { id: rangeId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

// ---------------------------------------------------------------------------
// 5) Seed de 5 estudios típicos
// ---------------------------------------------------------------------------
export async function seedTypicalTestsAction(): Promise<ActionResult<SeedResult>> {
  const guard = await _requireAdmin();
  if (!guard) return { ok: false, error: "UNAUTHORIZED", code: "AUTH" };
  try {
    const studies = _seedStudiesDefinition();
    let seededTests = 0;
    let seededAnalytes = 0;
    let seededRanges = 0;

    for (const study of studies) {
      const existing = await prisma.medicalTest.findUnique({ where: { code: study.code } });
      let testId: string;
      if (!existing) {
        const created = await prisma.medicalTest.create({
          data: {
            code: study.code,
            name: study.name,
            categoryId: LAB_CATEGORY_ID,
            options: [],
            novaClave: study.novaClave ?? null,
            daysToResult: study.daysToResult ?? 1,
            isProfile: study.isProfile ?? false,
            isPackage: study.isPackage ?? false,
          },
        });
        testId = created.id;
        seededTests += 1;
      } else {
        testId = existing.id;
      }

      for (const analyteDef of study.analytes) {
        const analyte = await prisma.labAnalyte.findUnique({
          where: {
            medicalTestId_code: {
              medicalTestId: testId,
              code: analyteDef.code,
            },
          },
        });
        let analyteId: string;
        if (!analyte) {
          const defaultUnitId = await _resolveUnitId(analyteDef.defaultUnitCode ?? null);
          const created = await prisma.labAnalyte.create({
            data: {
              medicalTestId: testId,
              code: analyteDef.code,
              name: analyteDef.name,
              orderIndex: analyteDef.orderIndex ?? 0,
              dataType: analyteDef.dataType ?? "NUMERIC",
              defaultUnitId,
              active: true,
            },
          });
          analyteId = created.id;
          seededAnalytes += 1;
        } else {
          analyteId = analyte.id;
        }

        for (const rng of analyteDef.ranges ?? []) {
          const existingRanges = await prisma.labReferenceRange.findMany({
            where: { analyteId, sex: rng.sex },
          });
          const ageMin = rng.ageMinMonths ?? null;
          const ageMax = rng.ageMaxMonths ?? null;
          const already = existingRanges.some(
            (r) => r.ageMinMonths === ageMin && r.ageMaxMonths === ageMax
          );
          if (already) continue;
          const unitId = await _resolveUnitId(rng.unitCode ?? null);
          await prisma.labReferenceRange.create({
            data: {
              analyteId,
              sex: rng.sex,
              ageMinMonths: ageMin,
              ageMaxMonths: ageMax,
              valueMin: rng.valueMin ?? null,
              valueMax: rng.valueMax ?? null,
              textValue: rng.textValue ?? null,
              unitId,
              criticalLow: rng.criticalLow ?? null,
              criticalHigh: rng.criticalHigh ?? null,
              isCritical: rng.isCritical ?? false,
            },
          });
          seededRanges += 1;
        }
      }
    }

    revalidatePath("/admin/lab/catalog");
    return {
      ok: true,
      data: {
        status: "success",
        seeded: seededTests,
        analytes: seededAnalytes,
        referenceRanges: seededRanges,
        note: "Seed idempotente: ya existentes se omiten sin error.",
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      code: "INTERNAL",
    };
  }
}

// ---------------------------------------------------------------------------
// Definición del seed — espejada del backend (5 estudios × 6-8 analitos)
// ---------------------------------------------------------------------------
function _seedStudiesDefinition(): Array<{
  code: string;
  name: string;
  novaClave?: string;
  daysToResult?: number;
  isProfile?: boolean;
  isPackage?: boolean;
  analytes: Array<{
    code: string;
    name: string;
    orderIndex?: number;
    dataType?: "NUMERIC" | "TEXT" | "ENUM";
    defaultUnitCode?: string;
    ranges?: Array<{
      sex: "M" | "F" | "A";
      ageMinMonths?: number;
      ageMaxMonths?: number;
      valueMin?: number;
      valueMax?: number;
      textValue?: string;
      unitCode?: string;
      criticalLow?: number;
      criticalHigh?: number;
      isCritical?: boolean;
    }>;
  }>;
}> {
  return [
    {
      code: "BH",
      name: "Biometría Hemática",
      novaClave: "BH",
      daysToResult: 1,
      analytes: [
        {
          code: "HGB", name: "Hemoglobina", orderIndex: 1, defaultUnitCode: "g/dL",
          ranges: [
            { sex: "M", ageMinMonths: 216, valueMin: 13.5, valueMax: 17.5, unitCode: "g/dL", criticalLow: 8.0, criticalHigh: 20.0 },
            { sex: "F", ageMinMonths: 216, valueMin: 12.0, valueMax: 16.0, unitCode: "g/dL", criticalLow: 8.0, criticalHigh: 20.0 },
          ],
        },
        {
          code: "HTO", name: "Hematocrito", orderIndex: 2, defaultUnitCode: "%",
          ranges: [
            { sex: "M", ageMinMonths: 216, valueMin: 41, valueMax: 53, unitCode: "%" },
            { sex: "F", ageMinMonths: 216, valueMin: 36, valueMax: 46, unitCode: "%" },
          ],
        },
        {
          code: "LEU", name: "Leucocitos", orderIndex: 3, defaultUnitCode: "x10^3/uL",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 4.0, valueMax: 11.0, unitCode: "x10^3/uL" }],
        },
        {
          code: "PLT", name: "Plaquetas", orderIndex: 4, defaultUnitCode: "x10^3/uL",
          ranges: [
            { sex: "A", ageMinMonths: 216, valueMin: 150, valueMax: 400, unitCode: "x10^3/uL", criticalLow: 50, criticalHigh: 1000 },
          ],
        },
        {
          code: "RBC", name: "Eritrocitos", orderIndex: 5, defaultUnitCode: "x10^6/uL",
          ranges: [
            { sex: "M", ageMinMonths: 216, valueMin: 4.5, valueMax: 5.9, unitCode: "x10^6/uL" },
            { sex: "F", ageMinMonths: 216, valueMin: 4.0, valueMax: 5.2, unitCode: "x10^6/uL" },
          ],
        },
        {
          code: "MCV", name: "Volumen Corpuscular Medio", orderIndex: 6, defaultUnitCode: "fL",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 80, valueMax: 100, unitCode: "fL" }],
        },
        {
          code: "MCH", name: "Hemoglobina Corpuscular Media", orderIndex: 7, defaultUnitCode: "pg",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 27, valueMax: 33, unitCode: "pg" }],
        },
      ],
    },
    {
      code: "QS",
      name: "Química Sanguínea",
      novaClave: "QS",
      daysToResult: 1,
      analytes: [
        { code: "GLU", name: "Glucosa", orderIndex: 1, defaultUnitCode: "mg/dL",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 70, valueMax: 110, unitCode: "mg/dL", criticalLow: 50, criticalHigh: 400 }] },
        { code: "BUN", name: "Urea (BUN)", orderIndex: 2, defaultUnitCode: "mg/dL",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 7, valueMax: 20, unitCode: "mg/dL" }] },
        { code: "CREA", name: "Creatinina", orderIndex: 3, defaultUnitCode: "mg/dL",
          ranges: [
            { sex: "M", ageMinMonths: 216, valueMin: 0.7, valueMax: 1.3, unitCode: "mg/dL" },
            { sex: "F", ageMinMonths: 216, valueMin: 0.6, valueMax: 1.1, unitCode: "mg/dL" },
          ] },
        { code: "URIC", name: "Ácido Úrico", orderIndex: 4, defaultUnitCode: "mg/dL",
          ranges: [
            { sex: "M", ageMinMonths: 216, valueMin: 3.4, valueMax: 7.0, unitCode: "mg/dL" },
            { sex: "F", ageMinMonths: 216, valueMin: 2.4, valueMax: 6.0, unitCode: "mg/dL" },
          ] },
        { code: "TGO", name: "AST / TGO", orderIndex: 5, defaultUnitCode: "U/L",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 5, valueMax: 40, unitCode: "U/L" }] },
        { code: "TGP", name: "ALT / TGP", orderIndex: 6, defaultUnitCode: "U/L",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 7, valueMax: 56, unitCode: "U/L" }] },
        { code: "NA", name: "Sodio", orderIndex: 7, defaultUnitCode: "mEq/L",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 136, valueMax: 145, unitCode: "mEq/L", criticalLow: 120, criticalHigh: 160 }] },
        { code: "K", name: "Potasio", orderIndex: 8, defaultUnitCode: "mEq/L",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 3.5, valueMax: 5.1, unitCode: "mEq/L", criticalLow: 2.5, criticalHigh: 6.5 }] },
      ],
    },
    {
      code: "EGO",
      name: "Examen General de Orina",
      novaClave: "EGO",
      daysToResult: 1,
      analytes: [
        { code: "COLOR", name: "Color", orderIndex: 1, dataType: "TEXT",
          ranges: [{ sex: "A", textValue: "Amarillo" }] },
        { code: "PH", name: "pH", orderIndex: 2,
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 5.0, valueMax: 7.5 }] },
        { code: "DEN", name: "Densidad", orderIndex: 3,
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 1.005, valueMax: 1.030 }] },
        { code: "PROT", name: "Proteínas", orderIndex: 4, dataType: "ENUM",
          ranges: [{ sex: "A", textValue: "Negativo" }] },
        { code: "GLU_OR", name: "Glucosa", orderIndex: 5, dataType: "ENUM",
          ranges: [{ sex: "A", textValue: "Negativo" }] },
        { code: "HB_OR", name: "Sangre (Hemoglobina)", orderIndex: 6, dataType: "ENUM",
          ranges: [{ sex: "A", textValue: "Negativo" }] },
        { code: "LEU_OR", name: "Leucocitos", orderIndex: 7, dataType: "ENUM",
          ranges: [{ sex: "A", textValue: "Negativo" }] },
      ],
    },
    {
      code: "PL",
      name: "Perfil Lipídico",
      novaClave: "PL",
      daysToResult: 1,
      isProfile: true,
      analytes: [
        { code: "COL", name: "Colesterol Total", orderIndex: 1, defaultUnitCode: "mg/dL",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 0, valueMax: 200, unitCode: "mg/dL", criticalHigh: 300 }] },
        { code: "HDL", name: "HDL Colesterol", orderIndex: 2, defaultUnitCode: "mg/dL",
          ranges: [
            { sex: "M", ageMinMonths: 216, valueMin: 40, valueMax: 60, unitCode: "mg/dL" },
            { sex: "F", ageMinMonths: 216, valueMin: 50, valueMax: 70, unitCode: "mg/dL" },
          ] },
        { code: "LDL", name: "LDL Colesterol", orderIndex: 3, defaultUnitCode: "mg/dL",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 0, valueMax: 130, unitCode: "mg/dL", criticalHigh: 250 }] },
        { code: "VLDL", name: "VLDL Colesterol", orderIndex: 4, defaultUnitCode: "mg/dL",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 0, valueMax: 30, unitCode: "mg/dL" }] },
        { code: "TG", name: "Triglicéridos", orderIndex: 5, defaultUnitCode: "mg/dL",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 0, valueMax: 150, unitCode: "mg/dL", criticalHigh: 500 }] },
        { code: "COL_HDL", name: "Índice Col/HDL", orderIndex: 6,
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 0, valueMax: 4.5 }] },
      ],
    },
    {
      code: "TP",
      name: "Tiempos de Coagulación",
      novaClave: "TP",
      daysToResult: 1,
      analytes: [
        { code: "TPROT", name: "Tiempo de Protrombina", orderIndex: 1, defaultUnitCode: "seg",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 11, valueMax: 13.5, unitCode: "seg", criticalHigh: 30 }] },
        { code: "INR", name: "INR", orderIndex: 2,
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 0.8, valueMax: 1.2, criticalHigh: 4.0 }] },
        { code: "TTPA", name: "TTPa", orderIndex: 3, defaultUnitCode: "seg",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 25, valueMax: 35, unitCode: "seg" }] },
        { code: "FIB", name: "Fibrinógeno", orderIndex: 4, defaultUnitCode: "mg/dL",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 200, valueMax: 400, unitCode: "mg/dL", criticalLow: 100, criticalHigh: 700 }] },
        { code: "TP_PCT", name: "Actividad Protrombina (%)", orderIndex: 5, defaultUnitCode: "%",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 70, valueMax: 120, unitCode: "%" }] },
        { code: "DIMD", name: "Dímero D", orderIndex: 6, defaultUnitCode: "ug/mL",
          ranges: [{ sex: "A", ageMinMonths: 216, valueMin: 0, valueMax: 0.5, unitCode: "ug/mL", criticalHigh: 5.0 }] },
      ],
    },
  ];
}