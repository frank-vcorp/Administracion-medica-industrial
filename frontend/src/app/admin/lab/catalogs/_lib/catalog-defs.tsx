/**
 * @file Definición de los 8 catálogos LIS — columnas, formulario, sortBy.
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 * @backup context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md
 *
 * Single source of truth que consume CatalogTable y CatalogForm.
 */
import { z } from "zod";
import {
  labClassificationSchema,
  labContainerSchema,
  labDepartmentSchema,
  labIndicationSchema,
  labMethodSchema,
  labProcessAreaSchema,
  labSampleSchema,
  labUnitSchema,
  type LabCatalogMod,
} from "@/lib/validations/lab-catalog";

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------
export type ColumnDef = {
  key: string;
  label: string;
  /** Render del valor (string simple si se omite). */
  render?: (value: unknown) => string | React.ReactNode;
  /** Permite ordenar por esta columna (default: true). */
  sortable?: boolean;
};

export type FieldType = "text" | "textarea" | "select" | "number" | "color";

export type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  rows?: number;
  /** Permite una pista visible (tooltip/ayuda). */
  help?: string;
};

export type CatalogDef = {
  code: LabCatalogMod;
  label: string;
  description: string;
  tableColumns: ColumnDef[];
  formFields: FieldDef[];
  zodSchema: z.ZodTypeAny;
  sortBy: string;
  /** Llave primaria textual mostrada (e.g., "symbol" o "code"). */
  idDisplayKey: string;
};

// ---------------------------------------------------------------------------
// Definiciones individuales
// ---------------------------------------------------------------------------
export const unidadesDef: CatalogDef = {
  code: "unidades",
  label: "Unidades",
  description: "Unidades de medida (mg/dL, mmol/L, %, U/L, etc.)",
  idDisplayKey: "symbol",
  sortBy: "symbol",
  zodSchema: labUnitSchema,
  tableColumns: [
    { key: "symbol", label: "Símbolo" },
    { key: "name", label: "Nombre" },
    {
      key: "system",
      label: "Sistema",
      render: (v) =>
        v === "SI" ? (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">SI</span>
        ) : (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">CONV</span>
        ),
    },
    { key: "active", label: "Activo", render: (v) => (v ? "✓" : "—") },
  ],
  formFields: [
    { key: "symbol", label: "Símbolo", placeholder: "mg/dL", type: "text", required: true },
    { key: "name", label: "Nombre", placeholder: "Miligramos por decilitro", type: "text", required: true },
    {
      key: "system",
      label: "Sistema",
      type: "select",
      required: true,
      options: [
        { value: "SI", label: "SI (Sistema Internacional)" },
        { value: "CONVENTIONAL", label: "Convencional" },
      ],
    },
  ],
};

export const muestrasDef: CatalogDef = {
  code: "muestras",
  label: "Muestras",
  description: "Tipo de muestra biológica (Sangre, Orina, Heces, etc.)",
  idDisplayKey: "code",
  sortBy: "code",
  zodSchema: labSampleSchema,
  tableColumns: [
    { key: "code", label: "Código" },
    { key: "name", label: "Nombre" },
    { key: "preservation", label: "Conservación" },
    { key: "minVolume", label: "Vol. mínimo" },
    { key: "active", label: "Activo", render: (v) => (v ? "✓" : "—") },
  ],
  formFields: [
    { key: "code", label: "Código", placeholder: "SANGRE", type: "text", required: true },
    { key: "name", label: "Nombre", placeholder: "Sangre venosa", type: "text", required: true },
    { key: "preservation", label: "Conservación", placeholder: "Refrigerada 4°C", type: "text" },
    { key: "minVolume", label: "Volumen mínimo", placeholder: "5 mL", type: "text" },
  ],
};

export const recipientesDef: CatalogDef = {
  code: "recipientes",
  label: "Recipientes",
  description: "Recipiente / tubo de toma de muestra",
  idDisplayKey: "code",
  sortBy: "code",
  zodSchema: labContainerSchema,
  tableColumns: [
    { key: "code", label: "Código" },
    { key: "name", label: "Nombre" },
    { key: "color", label: "Color" },
    { key: "cap", label: "Tapa" },
    { key: "active", label: "Activo", render: (v) => (v ? "✓" : "—") },
  ],
  formFields: [
    { key: "code", label: "Código", placeholder: "TUBO_LILA", type: "text", required: true },
    { key: "name", label: "Nombre", placeholder: "Tubo tapa lila (EDTA)", type: "text", required: true },
    { key: "color", label: "Color", placeholder: "Lila", type: "text" },
    { key: "cap", label: "Tapa", placeholder: "Hemogard lila", type: "text" },
  ],
};

export const metodologiasDef: CatalogDef = {
  code: "metodologias",
  label: "Metodologías",
  description: "Metodología analítica (Química seca, ELISA, etc.)",
  idDisplayKey: "code",
  sortBy: "code",
  zodSchema: labMethodSchema,
  tableColumns: [
    { key: "code", label: "Código" },
    { key: "name", label: "Nombre" },
    { key: "principle", label: "Principio" },
    { key: "active", label: "Activo", render: (v) => (v ? "✓" : "—") },
  ],
  formFields: [
    { key: "code", label: "Código", placeholder: "QUIMICA_SECA", type: "text", required: true },
    { key: "name", label: "Nombre", placeholder: "Química seca", type: "text", required: true },
    {
      key: "principle",
      label: "Principio técnico",
      placeholder: "Espectrofotometría de reflectancia",
      type: "textarea",
      rows: 2,
    },
  ],
};

export const lugaresProcesoDef: CatalogDef = {
  code: "lugares_proceso",
  label: "Lugares de proceso",
  description: "Lugar físico donde se procesa (Hematología, Química Clínica, etc.)",
  idDisplayKey: "code",
  sortBy: "code",
  zodSchema: labProcessAreaSchema,
  tableColumns: [
    { key: "code", label: "Código" },
    { key: "name", label: "Nombre" },
    { key: "departmentId", label: "Depto. ID" },
    { key: "active", label: "Activo", render: (v) => (v ? "✓" : "—") },
  ],
  formFields: [
    { key: "code", label: "Código", placeholder: "HEM", type: "text", required: true },
    { key: "name", label: "Nombre", placeholder: "Hematología rutina", type: "text", required: true },
    { key: "departmentId", label: "ID Departamento (opcional)", placeholder: "uuid", type: "text" },
  ],
};

export const clasificacionesDef: CatalogDef = {
  code: "clasificaciones",
  label: "Clasificaciones",
  description: "Clasificación de resultado (Normal, Patrón A, Crítico, etc.)",
  idDisplayKey: "code",
  sortBy: "sortOrder",
  zodSchema: labClassificationSchema,
  tableColumns: [
    { key: "code", label: "Código" },
    { key: "name", label: "Nombre" },
    {
      key: "color",
      label: "Color",
      render: (v) =>
        typeof v === "string" && v ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded border border-slate-300" style={{ background: v }} />
            <span className="text-xs font-mono">{v}</span>
          </span>
        ) : (
          "—"
        ),
    },
    { key: "sortOrder", label: "Orden" },
    { key: "active", label: "Activo", render: (v) => (v ? "✓" : "—") },
  ],
  formFields: [
    { key: "code", label: "Código", placeholder: "NORMAL", type: "text", required: true },
    { key: "name", label: "Nombre", placeholder: "Normal", type: "text", required: true },
    { key: "color", label: "Color (hex)", placeholder: "#00FF00", type: "color" },
    { key: "sortOrder", label: "Orden", placeholder: "0", type: "number" },
  ],
};

export const indicacionesDef: CatalogDef = {
  code: "indicaciones",
  label: "Indicaciones",
  description: "Indicación / preparación del paciente (Ayuno 8h, Recolecta 24h, etc.)",
  idDisplayKey: "code",
  sortBy: "code",
  zodSchema: labIndicationSchema,
  tableColumns: [
    { key: "code", label: "Código" },
    { key: "text", label: "Texto" },
    { key: "active", label: "Activo", render: (v) => (v ? "✓" : "—") },
  ],
  formFields: [
    { key: "code", label: "Código", placeholder: "AYUNO_8H", type: "text", required: true },
    { key: "text", label: "Texto", placeholder: "Ayuno de 8 horas", type: "text", required: true },
  ],
};

export const departamentosDef: CatalogDef = {
  code: "departamentos",
  label: "Departamentos",
  description: "Departamento de laboratorio (agrupa lugares de proceso)",
  idDisplayKey: "code",
  sortBy: "code",
  zodSchema: labDepartmentSchema,
  tableColumns: [
    { key: "code", label: "Código" },
    { key: "name", label: "Nombre" },
    { key: "active", label: "Activo", render: (v) => (v ? "✓" : "—") },
  ],
  formFields: [
    { key: "code", label: "Código", placeholder: "HEM", type: "text", required: true },
    { key: "name", label: "Nombre", placeholder: "Hematología", type: "text", required: true },
  ],
};

// ---------------------------------------------------------------------------
// Mapa code → def
// ---------------------------------------------------------------------------
export const CATALOG_DEFS: Record<LabCatalogMod, CatalogDef> = {
  unidades: unidadesDef,
  muestras: muestrasDef,
  recipientes: recipientesDef,
  metodologias: metodologiasDef,
  lugares_proceso: lugaresProcesoDef,
  clasificaciones: clasificacionesDef,
  indicaciones: indicacionesDef,
  departamentos: departamentosDef,
};

export function getCatalogDef(mod: LabCatalogMod): CatalogDef {
  return CATALOG_DEFS[mod];
}