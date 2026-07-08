/**
 * @file Editor de un LabReferenceRange individual.
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción — E.
 */
"use client";

import { useState } from "react";

interface Range {
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
}

interface Props {
  range: Range;
  onUpdate: (patch: {
    sex?: "M" | "F" | "A";
    valueMin?: number | null;
    valueMax?: number | null;
    criticalLow?: number | null;
    criticalHigh?: number | null;
    isCritical?: boolean;
  }) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}

export function LabReferenceRangeEditor({ range, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{
    sex: "M" | "F" | "A";
    valueMin: string;
    valueMax: string;
    criticalLow: string;
    criticalHigh: string;
    isCritical: boolean;
  }>({
    sex: (range.sex as "M" | "F" | "A") ?? "A",
    valueMin: range.valueMin != null ? String(range.valueMin) : "",
    valueMax: range.valueMax != null ? String(range.valueMax) : "",
    criticalLow: range.criticalLow != null ? String(range.criticalLow) : "",
    criticalHigh: range.criticalHigh != null ? String(range.criticalHigh) : "",
    isCritical: range.isCritical,
  });

  function handleSave() {
    onUpdate({
      sex: form.sex,
      valueMin: form.valueMin ? Number(form.valueMin) : null,
      valueMax: form.valueMax ? Number(form.valueMax) : null,
      criticalLow: form.criticalLow ? Number(form.criticalLow) : null,
      criticalHigh: form.criticalHigh ? Number(form.criticalHigh) : null,
      isCritical: form.isCritical,
    });
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded bg-slate-50 border border-slate-200 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1">
          <span className="font-mono font-semibold text-slate-700">{range.sex}</span>
          <span className="text-slate-500">
            edad: {range.ageMinMonths ?? "0"}–{range.ageMaxMonths ?? "∞"} meses
          </span>
          {range.textValue !== null && range.textValue !== undefined ? (
            <span className="font-medium text-slate-800">texto: {range.textValue}</span>
          ) : (
            <span className="text-slate-700">
              rango: <span className="font-mono">{range.valueMin ?? "—"}</span>
              {" – "}
              <span className="font-mono">{range.valueMax ?? "—"}</span>
              {range.unitCode && <span className="text-slate-500 ml-1">{range.unitCode}</span>}
            </span>
          )}
          {range.isCritical && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
              ⚠️ crítico
            </span>
          )}
          {range.criticalLow != null && (
            <span className="text-[10px] text-red-600">crit↓ {range.criticalLow}</span>
          )}
          {range.criticalHigh != null && (
            <span className="text-[10px] text-red-600">crit↑ {range.criticalHigh}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-blue-700 hover:text-blue-900 underline text-[11px]"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete()}
            className="text-red-600 hover:text-red-800 text-[11px]"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded bg-white border border-blue-200 text-xs">
      <select
        value={form.sex}
        onChange={(e) => setForm({ ...form, sex: e.target.value as "M" | "F" | "A" })}
        className="border border-slate-300 rounded px-1 py-0.5"
      >
        <option value="A">A</option>
        <option value="M">M</option>
        <option value="F">F</option>
      </select>
      <input
        type="number"
        step="any"
        placeholder="min"
        value={form.valueMin}
        onChange={(e) => setForm({ ...form, valueMin: e.target.value })}
        className="w-20 border border-slate-300 rounded px-1 py-0.5"
      />
      <span>–</span>
      <input
        type="number"
        step="any"
        placeholder="max"
        value={form.valueMax}
        onChange={(e) => setForm({ ...form, valueMax: e.target.value })}
        className="w-20 border border-slate-300 rounded px-1 py-0.5"
      />
      <input
        type="number"
        step="any"
        placeholder="crit low"
        value={form.criticalLow}
        onChange={(e) => setForm({ ...form, criticalLow: e.target.value })}
        className="w-20 border border-slate-300 rounded px-1 py-0.5"
      />
      <input
        type="number"
        step="any"
        placeholder="crit high"
        value={form.criticalHigh}
        onChange={(e) => setForm({ ...form, criticalHigh: e.target.value })}
        className="w-20 border border-slate-300 rounded px-1 py-0.5"
      />
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={form.isCritical}
          onChange={(e) => setForm({ ...form, isCritical: e.target.checked })}
        />
        crítico
      </label>
      <button
        type="button"
        onClick={handleSave}
        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded"
      >
        Guardar
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded"
      >
        Cancelar
      </button>
    </div>
  );
}