/**
 * @file Editor de analitos de un MedicalTest (con rangos anidados).
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción — E.
 *
 * Cliente Component. Permite agregar, editar y eliminar analitos y rangos.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAnalyteAction,
  createReferenceRangeAction,
  deleteAnalyteAction,
  deleteReferenceRangeAction,
  updateAnalyteAction,
  updateReferenceRangeAction,
} from "@/actions/study.actions";
import { LabReferenceRangeEditor } from "./LabReferenceRangeEditor";

interface AnalyteInput {
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
}

interface Props {
  testId: string;
  initialAnalytes: AnalyteInput[];
}

export function LabAnalyteEditor({ testId, initialAnalytes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [analytes, setAnalytes] = useState<AnalyteInput[]>(initialAnalytes);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  type RangePatch = {
    sex?: "M" | "F" | "A";
    valueMin?: number | null;
    valueMax?: number | null;
    criticalLow?: number | null;
    criticalHigh?: number | null;
    isCritical?: boolean;
  };

  // Form para nuevo analito
  const [newAnalyte, setNewAnalyte] = useState({
    code: "",
    name: "",
    orderIndex: analytes.length + 1,
    dataType: "NUMERIC" as "NUMERIC" | "TEXT" | "ENUM",
    defaultUnitCode: "",
  });

  async function handleCreateAnalyte() {
    setError(null);
    setMessage(null);
    const res = await createAnalyteAction({
      medicalTestId: testId,
      code: newAnalyte.code.trim(),
      name: newAnalyte.name.trim(),
      orderIndex: newAnalyte.orderIndex,
      dataType: newAnalyte.dataType,
      defaultUnitCode: newAnalyte.defaultUnitCode.trim() || null,
      active: true,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessage(`Analito ${res.data.code} creado.`);
    setNewAnalyte({
      code: "",
      name: "",
      orderIndex: analytes.length + 2,
      dataType: "NUMERIC",
      defaultUnitCode: "",
    });
    startTransition(() => router.refresh());
  }

  async function handleDeleteAnalyte(id: string) {
    if (!confirm("¿Eliminar analito y todos sus rangos?")) return;
    setError(null);
    const res = await deleteAnalyteAction(id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAnalytes((prev) => prev.filter((a) => a.id !== id));
    setMessage("Analito eliminado.");
    startTransition(() => router.refresh());
  }

  async function handleUpdateAnalyteName(id: string, name: string) {
    const res = await updateAnalyteAction(id, { name });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAnalytes((prev) =>
      prev.map((a) => (a.id === id ? { ...a, name } : a))
    );
    startTransition(() => router.refresh());
  }

  async function handleAddRange(analyteId: string, range: {
    sex: "M" | "F" | "A";
    ageMinMonths?: number | null;
    ageMaxMonths?: number | null;
    valueMin?: number | null;
    valueMax?: number | null;
    textValue?: string | null;
    unitCode?: string | null;
    criticalLow?: number | null;
    criticalHigh?: number | null;
    isCritical?: boolean;
  }) {
    const res = await createReferenceRangeAction({
      analyteId,
      sex: range.sex,
      ageMinMonths: range.ageMinMonths ?? null,
      ageMaxMonths: range.ageMaxMonths ?? null,
      valueMin: range.valueMin ?? null,
      valueMax: range.valueMax ?? null,
      textValue: range.textValue ?? null,
      unitCode: range.unitCode ?? null,
      criticalLow: range.criticalLow ?? null,
      criticalHigh: range.criticalHigh ?? null,
      isCritical: range.isCritical ?? false,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessage("Rango agregado.");
    startTransition(() => router.refresh());
  }

  async function handleDeleteRange(rangeId: string, analyteId: string) {
    const res = await deleteReferenceRangeAction(rangeId);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAnalytes((prev) =>
      prev.map((a) =>
        a.id === analyteId
          ? { ...a, referenceRanges: a.referenceRanges.filter((r) => r.id !== rangeId) }
          : a
      )
    );
    setMessage("Rango eliminado.");
    startTransition(() => router.refresh());
  }

  async function handleUpdateRange(
    rangeId: string,
    analyteId: string,
    patch: RangePatch
  ) {
    const res = await updateReferenceRangeAction(rangeId, patch);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAnalytes((prev) =>
      prev.map((a) =>
        a.id === analyteId
          ? {
              ...a,
              referenceRanges: a.referenceRanges.map((r) =>
                r.id === rangeId ? { ...r, ...patch } : r
              ),
            }
          : a
      )
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {/* Lista de analitos existentes */}
      <div className="space-y-3">
        {analytes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-sm text-slate-500">
            No hay analitos definidos para este estudio.
          </div>
        ) : (
          analytes.map((a) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-mono font-semibold text-slate-800">{a.code}</span>
                  <input
                    type="text"
                    defaultValue={a.name}
                    onBlur={(e) => {
                      if (e.target.value !== a.name) {
                        handleUpdateAnalyteName(a.id, e.target.value);
                      }
                    }}
                    className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    {a.dataType}
                  </span>
                  {a.defaultUnitCode && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {a.defaultUnitCode}
                    </span>
                  )}
                  {!a.active && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                      Inactivo
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAnalyte(a.id)}
                  className="text-red-600 hover:text-red-800 text-xs px-2 py-1"
                  disabled={pending}
                >
                  Eliminar
                </button>
              </div>

              {/* Rangos */}
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Rangos de referencia ({a.referenceRanges.length})
                </p>
                <ul className="space-y-2">
                  {a.referenceRanges.map((r) => (
                    <li key={r.id}>
                      <LabReferenceRangeEditor
                        range={r}
                        onUpdate={(patch) => handleUpdateRange(r.id, a.id, patch)}
                        onDelete={() => handleDeleteRange(r.id, a.id)}
                      />
                    </li>
                  ))}
                </ul>
                <RangeAdder onAdd={(r) => handleAddRange(a.id, r)} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form para nuevo analito */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-slate-800 mb-3">+ Agregar analito</p>
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-2">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Code</label>
            <input
              type="text"
              value={newAnalyte.code}
              onChange={(e) => setNewAnalyte({ ...newAnalyte, code: e.target.value })}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="HGB"
            />
          </div>
          <div className="col-span-4">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Nombre</label>
            <input
              type="text"
              value={newAnalyte.name}
              onChange={(e) => setNewAnalyte({ ...newAnalyte, name: e.target.value })}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Hemoglobina"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Orden</label>
            <input
              type="number"
              min={0}
              value={newAnalyte.orderIndex}
              onChange={(e) => setNewAnalyte({ ...newAnalyte, orderIndex: Number(e.target.value) || 0 })}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Tipo</label>
            <select
              value={newAnalyte.dataType}
              onChange={(e) =>
                setNewAnalyte({
                  ...newAnalyte,
                  dataType: e.target.value as "NUMERIC" | "TEXT" | "ENUM",
                })
              }
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="NUMERIC">NUMERIC</option>
              <option value="TEXT">TEXT</option>
              <option value="ENUM">ENUM</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-medium text-slate-700 mb-1">Unidad</label>
            <input
              type="text"
              value={newAnalyte.defaultUnitCode}
              onChange={(e) => setNewAnalyte({ ...newAnalyte, defaultUnitCode: e.target.value })}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="g/dL"
            />
          </div>
          <div className="col-span-1">
            <button
              type="button"
              onClick={handleCreateAnalyte}
              disabled={!newAnalyte.code || !newAnalyte.name || pending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RangeAdderProps {
  onAdd: (r: {
    sex: "M" | "F" | "A";
    ageMinMonths: number | null;
    ageMaxMonths: number | null;
    valueMin: number | null;
    valueMax: number | null;
    textValue: string | null;
    unitCode: string | null;
    criticalLow: number | null;
    criticalHigh: number | null;
    isCritical: boolean;
  }) => void;
}

function RangeAdder({ onAdd }: RangeAdderProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    sex: "A" as "M" | "F" | "A",
    ageMinMonths: "",
    ageMaxMonths: "",
    valueMin: "",
    valueMax: "",
    textValue: "",
    unitCode: "",
    criticalLow: "",
    criticalHigh: "",
    isCritical: false,
  });

  function reset() {
    setForm({
      sex: "A",
      ageMinMonths: "",
      ageMaxMonths: "",
      valueMin: "",
      valueMax: "",
      textValue: "",
      unitCode: "",
      criticalLow: "",
      criticalHigh: "",
      isCritical: false,
    });
  }

  function handleSubmit() {
    onAdd({
      sex: form.sex,
      ageMinMonths: form.ageMinMonths ? Number(form.ageMinMonths) : null,
      ageMaxMonths: form.ageMaxMonths ? Number(form.ageMaxMonths) : null,
      valueMin: form.valueMin ? Number(form.valueMin) : null,
      valueMax: form.valueMax ? Number(form.valueMax) : null,
      textValue: form.textValue || null,
      unitCode: form.unitCode || null,
      criticalLow: form.criticalLow ? Number(form.criticalLow) : null,
      criticalHigh: form.criticalHigh ? Number(form.criticalHigh) : null,
      isCritical: form.isCritical,
    });
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-blue-700 hover:text-blue-900 underline"
      >
        + Agregar rango
      </button>
    );
  }

  return (
    <div className="mt-2 border border-slate-200 rounded p-3 bg-slate-50">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-1">
          <label className="block text-[10px] font-medium text-slate-700 mb-0.5">Sexo</label>
          <select
            value={form.sex}
            onChange={(e) => setForm({ ...form, sex: e.target.value as "M" | "F" | "A" })}
            className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs"
          >
            <option value="A">A</option>
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-slate-700 mb-0.5">Edad min (meses)</label>
          <input
            type="number"
            value={form.ageMinMonths}
            onChange={(e) => setForm({ ...form, ageMinMonths: e.target.value })}
            className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-slate-700 mb-0.5">Edad max (meses)</label>
          <input
            type="number"
            value={form.ageMaxMonths}
            onChange={(e) => setForm({ ...form, ageMaxMonths: e.target.value })}
            className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-slate-700 mb-0.5">Valor min</label>
          <input
            type="number"
            step="any"
            value={form.valueMin}
            onChange={(e) => setForm({ ...form, valueMin: e.target.value })}
            className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-medium text-slate-700 mb-0.5">Valor max</label>
          <input
            type="number"
            step="any"
            value={form.valueMax}
            onChange={(e) => setForm({ ...form, valueMax: e.target.value })}
            className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs"
          />
        </div>
        <div className="col-span-1">
          <label className="block text-[10px] font-medium text-slate-700 mb-0.5">Crítico</label>
          <input
            type="checkbox"
            checked={form.isCritical}
            onChange={(e) => setForm({ ...form, isCritical: e.target.checked })}
            className="mt-1"
          />
        </div>
        <div className="col-span-2 flex gap-1 items-end">
          <button
            type="button"
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-xs font-medium"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => { reset(); setOpen(false); }}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded text-xs"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}