/**
 * @file Tabla editable de estudios en una LabOrder.
 * @id IMPL-20260701-03 — Slice B Recepción.
 *
 * Estado controlado por padre: items + onChange.
 * Cálculo de importe reutiliza calculateItemAmount() del helper puro.
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
    <div className="border rounded bg-white">
      <div className="px-3 py-2 border-b flex items-center justify-between bg-gray-50">
        <h3 className="font-semibold text-sm">Estudios ({items.length})</h3>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Agregar estudio
          </button>
        )}
      </div>

      {showPicker && !readOnly && (
        <div className="p-3 border-b bg-yellow-50">
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
                <strong>{t.code}</strong> {t.alternateCode ? `(${t.alternateCode}) ` : ""}
                — {t.name} <em className="text-gray-500">${Number(t.price ?? 0).toFixed(2)}</em>
              </span>
            )}
          />
        </div>
      )}

      <table className="w-full text-xs">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-1 text-left">Clave</th>
            <th className="px-2 py-1 text-left">Estudio</th>
            <th className="px-2 py-1 text-right">Precio</th>
            <th className="px-2 py-1 text-right">Dcto $</th>
            <th className="px-2 py-1 text-right">Dcto %</th>
            <th className="px-2 py-1 text-right">Importe</th>
            <th className="px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-2 py-3 text-center text-gray-500 italic">
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
              <tr key={`${item.medicalTestId}-${idx}`} className="border-t">
                <td className="px-2 py-1 font-mono">{item.medicalTestId}</td>
                <td className="px-2 py-1">{/* nombre mostrado por autocomplete al agregar */}</td>
                <td className="px-2 py-1 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.price}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateItem(idx, { price: Number(e.target.value) || 0 })
                    }
                    className="w-20 px-1 py-0.5 border rounded text-right"
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.discountAmount}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateItem(idx, { discountAmount: Number(e.target.value) || 0 })
                    }
                    className="w-16 px-1 py-0.5 border rounded text-right"
                  />
                </td>
                <td className="px-2 py-1 text-right">
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
                    className="w-14 px-1 py-0.5 border rounded text-right"
                  />
                </td>
                <td className="px-2 py-1 text-right font-semibold">
                  ${amount.toFixed(2)}
                </td>
                <td className="px-2 py-1 text-center">
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-red-600 hover:text-red-800"
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
  );
}
