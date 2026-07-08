/**
 * @file Tabla del worklist: un estudio con sus analitos + inputs + acciones.
 * @id IMPL-20260707-16 — Slice C Resultados.
 */
"use client";

import { useState } from "react";
import { getStatusColor, getStatusLabel, validateValueAgainstRange } from "@/lib/lab-result-utils";
import type { LabResultStatus } from "@/lib/validations/lab-result";

export interface WorklistAnalyte {
  analyteId: string;
  code: string;
  name: string;
  dataType: string;
  orderIndex: number;
  defaultUnitId: string | null;
  defaultUnitSymbol: string | null;
  rangeMin: number | null;
  rangeMax: number | null;
  rangeText: string | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  existingResultId: string | null;
  existingValueText: string | null;
  existingValueNumber: number | null;
  existingStatus: LabResultStatus | null;
}

export interface WorklistItem {
  labOrderItemId: string;
  medicalTestId: string;
  medicalTestCode: string;
  medicalTestName: string;
  analytes: WorklistAnalyte[];
}

interface Props {
  item: WorklistItem;
  busy: boolean;
  onBulkSave: (items: Array<{
    labOrderItemId: string;
    analyteId: string;
    valueText?: string | null;
    valueNumber?: number | null;
  }>) => Promise<void>;
  onTransition: (
    resultId: string,
    action: "report" | "authorize" | "validate" | "invalidate",
    reason?: string
  ) => Promise<void>;
}

interface DraftValue {
  text: string;
  number: string;
}

export function WorklistTable({ item, busy, onBulkSave, onTransition }: Props) {
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});
  const [showInvalidateFor, setShowInvalidateFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function getDraft(a: WorklistAnalyte): DraftValue {
    if (drafts[a.analyteId]) return drafts[a.analyteId];
    return {
      text: a.existingValueText ?? "",
      number: a.existingValueNumber?.toString() ?? "",
    };
  }

  function setDraft(a: WorklistAnalyte, value: DraftValue) {
    setDrafts((d) => ({ ...d, [a.analyteId]: value }));
  }

  function buildPayloads() {
    const payloads: Array<{
      labOrderItemId: string;
      analyteId: string;
      valueText?: string | null;
      valueNumber?: number | null;
    }> = [];
    for (const a of item.analytes) {
      const d = getDraft(a);
      if (a.dataType === "NUMERIC") {
        if (d.number === "" || d.number === undefined) continue;
        const num = Number(d.number);
        if (isNaN(num)) continue;
        payloads.push({
          labOrderItemId: item.labOrderItemId,
          analyteId: a.analyteId,
          valueNumber: num,
        });
      } else {
        if (d.text === "" || d.text === undefined) continue;
        payloads.push({
          labOrderItemId: item.labOrderItemId,
          analyteId: a.analyteId,
          valueText: d.text,
        });
      }
    }
    return payloads;
  }

  async function handleSave() {
    const payloads = buildPayloads();
    await onBulkSave(payloads);
    setDrafts({});
  }

  function colorFor(a: WorklistAnalyte): string {
    const d = getDraft(a);
    if (a.dataType === "NUMERIC" && d.number) {
      const num = Number(d.number);
      if (!isNaN(num)) {
        const f = validateValueAgainstRange(num, null, {
          valueMin: a.rangeMin,
          valueMax: a.rangeMax,
          criticalLow: a.criticalLow,
          criticalHigh: a.criticalHigh,
        });
        if (f.isCritical) return "border-red-500 bg-red-50";
        if (f.isOutOfRange) return "border-amber-500 bg-amber-50";
        return "border-emerald-500 bg-emerald-50";
      }
    }
    return "border-slate-300 bg-white";
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            {item.medicalTestCode} — {item.medicalTestName}
          </h3>
          <p className="text-xs text-slate-500">{item.analytes.length} analito(s)</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          Guardar captura
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2 text-left">Clave</th>
            <th className="px-3 py-2 text-left">Analito</th>
            <th className="px-3 py-2 text-left">Rango</th>
            <th className="px-3 py-2 text-left">Valor</th>
            <th className="px-3 py-2 text-left">Estado</th>
            <th className="px-3 py-2 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {item.analytes.map((a) => {
            const d = getDraft(a);
            return (
              <tr key={a.analyteId}>
                <td className="px-3 py-2 font-mono text-xs text-slate-700">{a.code}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{a.name}</div>
                  <div className="text-xs text-slate-500">
                    {a.dataType} · {a.defaultUnitSymbol ?? "—"}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600 font-mono">
                  {a.rangeMin !== null && a.rangeMax !== null
                    ? `${a.rangeMin}–${a.rangeMax}`
                    : a.rangeText ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {a.dataType === "NUMERIC" ? (
                    <input
                      type="number"
                      step="0.01"
                      value={d.number}
                      onChange={(e) => setDraft(a, { ...d, number: e.target.value })}
                      disabled={busy || a.existingStatus === "INVALIDATED"}
                      className={`w-28 border rounded px-2 py-1 text-sm font-mono ${colorFor(a)}`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={d.text}
                      onChange={(e) => setDraft(a, { ...d, text: e.target.value })}
                      disabled={busy || a.existingStatus === "INVALIDATED"}
                      className="w-32 border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {a.existingStatus ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(
                        a.existingStatus
                      )}`}
                    >
                      {getStatusLabel(a.existingStatus)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Sin captura</span>
                  )}
                </td>
                <td className="px-3 py-2 space-x-1">
                  {a.existingResultId && a.existingStatus === "PENDING" && (
                    <button
                      type="button"
                      onClick={() => onTransition(a.existingResultId!, "report")}
                      disabled={busy}
                      className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      R
                    </button>
                  )}
                  {a.existingResultId && a.existingStatus === "REPORTED" && (
                    <button
                      type="button"
                      onClick={() => onTransition(a.existingResultId!, "authorize")}
                      disabled={busy}
                      className="px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                    >
                      A
                    </button>
                  )}
                  {a.existingResultId && a.existingStatus === "AUTHORIZED" && (
                    <button
                      type="button"
                      onClick={() => onTransition(a.existingResultId!, "validate")}
                      disabled={busy}
                      className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                    >
                      V
                    </button>
                  )}
                  {a.existingResultId && a.existingStatus !== "INVALIDATED" && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowInvalidateFor(
                          showInvalidateFor === a.existingResultId ? null : a.existingResultId!
                        )
                      }
                      disabled={busy}
                      className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                    >
                      X
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showInvalidateFor && (
        <div className="border-t border-slate-200 px-4 py-3 bg-red-50">
          <label className="block text-xs font-medium text-red-800 mb-1">
            Motivo de invalidación (mín 5 caracteres)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Muestra hemolizada"
              className="flex-1 border border-red-300 rounded px-2 py-1 text-sm bg-white"
            />
            <button
              type="button"
              onClick={async () => {
                await onTransition(showInvalidateFor, "invalidate", reason);
                setReason("");
                setShowInvalidateFor(null);
              }}
              disabled={busy || reason.length < 5}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInvalidateFor(null);
                setReason("");
              }}
              className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-3 py-1 rounded text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}