/**
 * @file Componente autocomplete reusable — debounce + click-outside.
 * @id IMPL-20260701-03 — Slice B Recepción.
 * @backup context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
 *
 * IMPL-20260706-02: refactor visual a paleta AMI.
 */
"use client";

import { useEffect, useRef, useState } from "react";

export type AutocompleteItem = {
  id?: string | number;
  [k: string]: unknown;
};

export interface LabOrderAutocompleteProps<T extends AutocompleteItem> {
  label: string;
  placeholder: string;
  value: T | null;
  onChange: (item: T | null) => void;
  fetchAction: (q: string) => Promise<T[]>;
  renderItem: (item: T) => React.ReactNode;
  /** Texto que se muestra en el input tras seleccionar (si no, renderItem). */
  displayValue?: (item: T) => string;
  inputClassName?: string;
  emptyMessage?: string;
}

export function LabOrderAutocomplete<T extends AutocompleteItem>({
  label,
  placeholder,
  value,
  onChange,
  fetchAction,
  renderItem,
  displayValue,
  inputClassName,
  emptyMessage = "Sin resultados",
}: LabOrderAutocompleteProps<T>) {
  const [query, setQuery] = useState<string>(
    value ? (displayValue ? displayValue(value) : String(value.id)) : ""
  );
  const [results, setResults] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sincroniza input si cambia `value` desde afuera
  /* eslint-disable react-hooks/set-state-in-effect -- sincronía controlada con valor externo (controlled input pattern). */
  /* eslint-disable react-hooks/exhaustive-deps -- `displayValue` es prop estable; se re-evalúa intencionalmente solo ante cambio de `value`. */
  useEffect(() => {
    if (value) {
      setQuery(displayValue ? displayValue(value) : String(value.id));
    } else {
      setQuery("");
    }
  }, [value]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const r = await fetchAction(q);
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, fetchAction]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          inputClassName || ""
        }`}
      />
      {open && (
        <ul className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg mt-1 max-h-60 overflow-auto shadow-lg">
          {loading && (
            <li className="px-3 py-2 text-xs text-slate-500">Buscando...</li>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <li className="px-3 py-2 text-xs text-slate-500">{emptyMessage}</li>
          )}
          {results.map((item, idx) => (
            <li
              key={item.id != null ? String(item.id) : `ac-${idx}`}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 text-slate-700"
              onClick={() => {
                onChange(item);
                setQuery(
                  displayValue ? displayValue(item) : renderItem(item)?.toString() || ""
                );
                setOpen(false);
              }}
            >
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}