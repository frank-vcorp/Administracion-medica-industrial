/**
 * @file Tabla editable de estudios en una LabOrder.
 * @id IMPL-20260701-03 — Slice B Recepción.
 *
 * Estado controlado por padre: items + onChange.
 * Cálculo de importe reutiliza calculateItemAmount() del helper puro.
 *
 * IMPL-20260706-02: refactor visual a paleta AMI.
 */
"use client";

import { calculateItemAmount } from "@/lib/lab-order-totals";
import type { LabOrderItemInput } from "@/lib/validations/lab-order";
import { LabOrderAutocomplete, type AutocompleteItem } from "./LabOrderAutocomplete";
import { searchLabTestsAction } from "@/actions/lab-order.actions";
import { useState } from "react";

interface Props {
  items: LabOrderItemInput[];
  onChange: (items: LabOrderItemInput[]) => void;
  readOnly?: boolean;
}

interface DisplayTest extends AutocompleteItem {
  id: string;
  code: string;
  alternateCode?: string | null;
  name: string;
  price: number;
}

const NUM_INPUT =
  "w-full px-2 py-1 border border-slate-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500";

export function LabOrderStudiesTable({ items, onChange, readOnly }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  function updateItem(idx: number, patch: Partial<LabOrderItemInput>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function addTest(test: DisplayTest) {
    const exists = items.some((i) => i.medicalTestId === test.id);
    if (exists) {
      setShowPicker(false);
      return;
    }
    const nextItem: LabOrderItemInput = {
      medicalTestId: test.id,
      price: Number(test.price ?? 0),
      discountAmount: 0,
      discountPct: 0,
    };
    onChange([...items, nextItem]);
    setShowPicker(false);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <h3 className="font-semibold text-sm text-slate-800">
          Estudios ({items.length})
        </h3>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            + Agregar estudio
          </button>
        )}
      </div>

      {showPicker && !readOnly && (
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <LabOrderAutocomplete<DisplayTest>
            label="Buscar estudio"
            placeholder="Clave, C.Alt o nombre..."
            value={null}
            onChange={(test) => {
              if (test) addTest(test);
            }}
            fetchAction={async (q) => (await searchLabTestsAction(q)) as DisplayTest[]}
            displayValue={(t) => `${t.code} — ${t.name}`}
            renderItem={(t) => (
              <span>
                <strong className="text-slate-800">{t.code}</strong>{" "}
                {t.alternateCode ? `(${t.alternateCode}) ` : ""}
                — {t.name}{" "}
                <em className="text-slate-500">
                  ${Number(t.price ?? 0).toFixed(2)}
                </em>
              </span>
            )}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Clave
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Estudio
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Precio
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Dcto $
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Dcto %
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Importe
              </th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500 italic">
                  Sin estudios. Agrega al menos uno.
                </td>
              </tr>
            )}
            {items.map((item, idx) => {
              const amount = calculateItemAmount(
                item.price,
                item.discountAmount ?? 0,
                item.discountPct ?? 0
              );
              return (
                <tr key={`${item.medicalTestId}-${idx}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-600 text-xs">
                    {item.medicalTestId}
                  </td>
                  <td className="px-3 py-2 text-slate-500 italic">
                    {/* nombre mostrado por autocomplete al agregar */}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.price}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateItem(idx, { price: Number(e.target.value) || 0 })
                      }
                      className={`${NUM_INPUT} w-20`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.discountAmount}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateItem(idx, { discountAmount: Number(e.target.value) || 0 })
                      }
                      className={`${NUM_INPUT} w-16`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={item.discountPct}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateItem(idx, { discountPct: Number(e.target.value) || 0 })
                      }
                      className={`${NUM_INPUT} w-14`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">
                    ${amount.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-600 hover:text-red-800 px-1"
                        title="Quitar"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}