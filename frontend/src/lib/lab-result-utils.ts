/**
 * @file Helpers puros para LabResult (Slice C NOVA absorción).
 * @id IMPL-20260707-16 — Slice C Resultados.
 *
 * Single source of truth cliente/servidor. El backend Python
 * (backend/app/services/lab_result_service.py) tiene réplicas.
 */
import type { LabResultStatus } from "@/lib/validations/lab-result";

// ---------------------------------------------------------------------------
// Range validation — replica 1:1 de validate_value_against_range (Python)
// ---------------------------------------------------------------------------
export interface RangeValidationResult {
  isOutOfRange: boolean;
  isCritical: boolean;
  matchedText: boolean;
}

export function validateValueAgainstRange(
  value: number | null | undefined,
  valueText: string | null | undefined,
  range: {
    valueMin?: number | null;
    valueMax?: number | null;
    criticalLow?: number | null;
    criticalHigh?: number | null;
    textValue?: string | null;
  }
): RangeValidationResult {
  let isOutOfRange = false;
  let isCritical = false;
  let matchedText = false;

  if (value !== null && value !== undefined) {
    if (range.valueMin !== null && range.valueMin !== undefined && value < range.valueMin) {
      isOutOfRange = true;
    }
    if (range.valueMax !== null && range.valueMax !== undefined && value > range.valueMax) {
      isOutOfRange = true;
    }
    if (range.criticalLow !== null && range.criticalLow !== undefined && value <= range.criticalLow) {
      isCritical = true;
    }
    if (range.criticalHigh !== null && range.criticalHigh !== undefined && value >= range.criticalHigh) {
      isCritical = true;
    }
  } else if (valueText !== null && valueText !== undefined && range.textValue) {
    matchedText = valueText.toLowerCase().trim() === range.textValue.toLowerCase().trim();
  }

  return { isOutOfRange, isCritical, matchedText };
}

// ---------------------------------------------------------------------------
// Age calculation — replica 1:1 de calculate_age_in_months (Python)
// ---------------------------------------------------------------------------
export function calculateAgeInMonths(
  birthDate: string | Date | null | undefined,
  sampleDate?: string | Date
): number | null {
  if (!birthDate) return null;
  const bd = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  const sd = sampleDate
    ? typeof sampleDate === "string"
      ? new Date(sampleDate)
      : sampleDate
    : new Date();
  if (isNaN(bd.getTime()) || isNaN(sd.getTime())) return null;
  let months = (sd.getFullYear() - bd.getFullYear()) * 12 + (sd.getMonth() - bd.getMonth());
  if (sd.getDate() < bd.getDate()) months -= 1;
  return Math.max(0, months);
}

// ---------------------------------------------------------------------------
// Status display helpers
// ---------------------------------------------------------------------------
export function getStatusColor(status: LabResultStatus): string {
  switch (status) {
    case "PENDING":
      return "bg-slate-100 text-slate-700 border-slate-300";
    case "REPORTED":
      return "bg-blue-100 text-blue-700 border-blue-300";
    case "AUTHORIZED":
      return "bg-indigo-100 text-indigo-700 border-indigo-300";
    case "VALIDATED":
      return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "INVALIDATED":
      return "bg-red-100 text-red-700 border-red-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-300";
  }
}

export function getStatusLabel(status: LabResultStatus): string {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "REPORTED":
      return "Reportado";
    case "AUTHORIZED":
      return "Autorizado";
    case "VALIDATED":
      return "Validado";
    case "INVALIDATED":
      return "Inválido";
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Range display helper — para mostrar "M: 13-17, F: 12-16" en la tabla
// ---------------------------------------------------------------------------
export function formatRange(
  ranges: Array<{
    sex: "M" | "F" | "A";
    valueMin?: number | null;
    valueMax?: number | null;
    textValue?: string | null;
  }>
): string {
  if (!ranges || ranges.length === 0) return "—";
  const parts: string[] = [];
  for (const r of ranges) {
    if (r.sex === "A") continue;
    if (r.valueMin !== null && r.valueMin !== undefined && r.valueMax !== null && r.valueMax !== undefined) {
      parts.push(`${r.sex}: ${r.valueMin}-${r.valueMax}`);
    } else if (r.textValue) {
      parts.push(`${r.sex}: ${r.textValue}`);
    }
  }
  if (parts.length === 0) {
    const r = ranges.find((x) => x.sex === "A");
    if (r && r.valueMin !== null && r.valueMin !== undefined && r.valueMax !== null && r.valueMax !== undefined) {
      return `${r.valueMin}-${r.valueMax}`;
    }
    if (r && r.textValue) return r.textValue;
  }
  return parts.join(", ") || "—";
}

// ---------------------------------------------------------------------------
// Calcula isOutOfRange + isCritical desde un value+range (útil en cliente)
// ---------------------------------------------------------------------------
export function calculateOutOfRange(
  value: number | null | undefined,
  range: {
    valueMin?: number | null;
    valueMax?: number | null;
    criticalLow?: number | null;
    criticalHigh?: number | null;
  }
): { isOutOfRange: boolean; isCritical: boolean } {
  const r = validateValueAgainstRange(value, null, range);
  return { isOutOfRange: r.isOutOfRange, isCritical: r.isCritical };
}

// ---------------------------------------------------------------------------
// Helpers de transición legal
// ---------------------------------------------------------------------------
export const LEGAL_NEXT_STATUSES: Record<LabResultStatus, LabResultStatus[]> = {
  PENDING: ["REPORTED", "INVALIDATED"],
  REPORTED: ["AUTHORIZED", "INVALIDATED"],
  AUTHORIZED: ["VALIDATED", "INVALIDATED"],
  VALIDATED: ["INVALIDATED"],
  INVALIDATED: [],
};

export function canTransition(from: LabResultStatus, to: LabResultStatus): boolean {
  return LEGAL_NEXT_STATUSES[from]?.includes(to) ?? false;
}