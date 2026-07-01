/**
 * @file Schemas Zod para los 8 mods de catálogos LIS.
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 * @backup context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md
 *
 * Single source of truth para validación cliente y servidor.
 * Cualquier cambio debe replicarse en backend/app/schemas/lab_catalogs.py.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Enum sistema de unidades
// ---------------------------------------------------------------------------
export const labUnitSystemSchema = z.enum(["SI", "CONVENTIONAL"]);
export type LabUnitSystem = z.infer<typeof labUnitSystemSchema>;

// ---------------------------------------------------------------------------
// 8 schemas base (uno por mod) — Create
// ---------------------------------------------------------------------------
export const labUnitSchema = z.object({
  symbol: z.string().min(1, "Símbolo obligatorio").max(20, "Máx 20 caracteres"),
  name: z.string().min(1, "Nombre obligatorio").max(120, "Máx 120 caracteres"),
  system: labUnitSystemSchema,
});
export type LabUnitInput = z.infer<typeof labUnitSchema>;

export const labSampleSchema = z.object({
  code: z.string().min(1, "Código obligatorio").max(32, "Máx 32 caracteres"),
  name: z.string().min(1, "Nombre obligatorio").max(120, "Máx 120 caracteres"),
  defaultContainerId: z.string().optional().nullable(),
  preservation: z.string().max(120, "Máx 120 caracteres").optional().nullable(),
  minVolume: z.string().max(32, "Máx 32 caracteres").optional().nullable(),
});
export type LabSampleInput = z.infer<typeof labSampleSchema>;

export const labContainerSchema = z.object({
  code: z.string().min(1, "Código obligatorio").max(32, "Máx 32 caracteres"),
  name: z.string().min(1, "Nombre obligatorio").max(120, "Máx 120 caracteres"),
  color: z.string().max(32, "Máx 32 caracteres").optional().nullable(),
  cap: z.string().max(64, "Máx 64 caracteres").optional().nullable(),
});
export type LabContainerInput = z.infer<typeof labContainerSchema>;

export const labMethodSchema = z.object({
  code: z.string().min(1, "Código obligatorio").max(32, "Máx 32 caracteres"),
  name: z.string().min(1, "Nombre obligatorio").max(120, "Máx 120 caracteres"),
  principle: z.string().max(255, "Máx 255 caracteres").optional().nullable(),
});
export type LabMethodInput = z.infer<typeof labMethodSchema>;

export const labProcessAreaSchema = z.object({
  code: z.string().min(1, "Código obligatorio").max(32, "Máx 32 caracteres"),
  name: z.string().min(1, "Nombre obligatorio").max(120, "Máx 120 caracteres"),
  departmentId: z.string().optional().nullable(),
});
export type LabProcessAreaInput = z.infer<typeof labProcessAreaSchema>;

export const labDepartmentSchema = z.object({
  code: z.string().min(1, "Código obligatorio").max(32, "Máx 32 caracteres"),
  name: z.string().min(1, "Nombre obligatorio").max(120, "Máx 120 caracteres"),
});
export type LabDepartmentInput = z.infer<typeof labDepartmentSchema>;

export const labClassificationSchema = z.object({
  code: z.string().min(1, "Código obligatorio").max(32, "Máx 32 caracteres"),
  name: z.string().min(1, "Nombre obligatorio").max(120, "Máx 120 caracteres"),
  color: z
    .string()
    .max(16, "Máx 16 caracteres")
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, "Color debe ser hex #RGB, #RRGGBB o #RRGGBBAA")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => undefined)),
  sortOrder: z.number().int().min(0).optional().default(0),
});
export type LabClassificationInput = z.infer<typeof labClassificationSchema>;

export const labIndicationSchema = z.object({
  code: z.string().min(1, "Código obligatorio").max(32, "Máx 32 caracteres"),
  text: z.string().min(1, "Texto obligatorio").max(500, "Máx 500 caracteres"),
});
export type LabIndicationInput = z.infer<typeof labIndicationSchema>;

// ---------------------------------------------------------------------------
// Discriminador de mods
// ---------------------------------------------------------------------------
export const LAB_CATALOG_MODS = [
  "unidades",
  "muestras",
  "recipientes",
  "metodologias",
  "lugares_proceso",
  "clasificaciones",
  "indicaciones",
  "departamentos",
] as const;

export type LabCatalogMod = (typeof LAB_CATALOG_MODS)[number];

export const labCatalogModSchema = z.enum(LAB_CATALOG_MODS);

export function isValidLabMod(mod: string | undefined | null): mod is LabCatalogMod {
  return !!mod && (LAB_CATALOG_MODS as readonly string[]).includes(mod);
}

export function resolveLabMod(mod: string | undefined | null): LabCatalogMod {
  return isValidLabMod(mod) ? (mod as LabCatalogMod) : "unidades";
}

// ---------------------------------------------------------------------------
// Schema → mapa por mod (usado por el frontend y los server actions)
// ---------------------------------------------------------------------------
export const LAB_SCHEMA_BY_MOD: Record<LabCatalogMod, z.ZodTypeAny> = {
  unidades: labUnitSchema,
  muestras: labSampleSchema,
  recipientes: labContainerSchema,
  metodologias: labMethodSchema,
  lugares_proceso: labProcessAreaSchema,
  clasificaciones: labClassificationSchema,
  indicaciones: labIndicationSchema,
  departamentos: labDepartmentSchema,
};

// ---------------------------------------------------------------------------
// DataTables — request/response tipados
// ---------------------------------------------------------------------------
export const dataTablesRequestSchema = z.object({
  mod: labCatalogModSchema,
  draw: z.number().int().min(0).default(1),
  start: z.number().int().min(0).default(0),
  length: z.number().int().min(1).max(100).default(25),
  search: z.string().optional().default(""),
  order: z
    .object({ column: z.number().int().min(0).default(0), dir: z.enum(["asc", "desc"]).default("asc") })
    .optional()
    .default({ column: 0, dir: "asc" }),
});
export type DataTablesRequest = z.infer<typeof dataTablesRequestSchema>;

export const dataTablesResponseSchema = z.object({
  draw: z.number().int(),
  recordsTotal: z.number().int(),
  recordsFiltered: z.number().int(),
  data: z.array(z.record(z.string(), z.unknown())),
});
export type DataTablesResponse = z.infer<typeof dataTablesResponseSchema>;