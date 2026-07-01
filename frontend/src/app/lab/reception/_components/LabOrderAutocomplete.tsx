/**
 * @file Componente autocomplete reusable — debounce + click-outside.
 * @id IMPL-20260701-03 — Slice B Recepción.
 * @backup context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
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
  useEffect(() => {
    if (value) {
      setQuery(displayValue ? displayValue(value) : String(value.id));
    } else {
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <label className="block text-xs font-medium text-gray-700 mb-1">
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
        className={`w-full px-2 py-1.5 border rounded text-sm ${
          inputClassName || ""
        }`}
      />
      {open && (
        <ul className="absolute z-20 w-full bg-white border rounded mt-1 max-h-60 overflow-auto shadow-lg">
          {loading && (
            <li className="px-2 py-1 text-xs text-gray-500">Buscando...</li>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <li className="px-2 py-1 text-xs text-gray-500">{emptyMessage}</li>
          )}
          {results.map((item, idx) => (
            <li
              key={item.id != null ? String(item.id) : `ac-${idx}`}
              className="px-2 py-1.5 text-sm cursor-pointer hover:bg-blue-50"
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
