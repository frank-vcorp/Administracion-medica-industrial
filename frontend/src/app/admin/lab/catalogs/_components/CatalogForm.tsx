/**
 * @file Form modal para crear/editar un ítem de catálogo LIS.
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 */
"use client";

import { useState } from "react";
import {
  createLabCatalogAction,
  updateLabCatalogAction,
} from "@/actions/lab-catalog.actions";
import { type LabCatalogMod } from "@/lib/validations/lab-catalog";
import type { CatalogDef, FieldDef } from "../_lib/catalog-defs";

type Item = Record<string, unknown>;

export default function CatalogForm({
  mod,
  def,
  mode,
  initialValues,
  onClose,
  onSaved,
}: {
  mod: LabCatalogMod;
  def: CatalogDef;
  mode: "create" | "edit";
  initialValues?: Item;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial: Item =
    initialValues ??
    def.formFields.reduce((acc, f) => {
      acc[f.key] = f.type === "number" ? "" : "";
      return acc;
    }, {} as Item);

  const [values, setValues] = useState<Item>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setErrors({});

    // Validación cliente con el Zod schema del mod (solo para feedback inmediato).
    const parsed = def.zodSchema.safeParse(values);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path && !errs[path]) errs[path] = issue.message;
      }
      setErrors(errs);
      setSubmitting(false);
      return;
    }

    const payload = parsed.data as Record<string, unknown>;
    const action = mode === "create"
      ? createLabCatalogAction({ mod, values: payload })
      : updateLabCatalogAction({ mod, id: String(initialValues?.id), values: payload });

    const result = await action;
    setSubmitting(false);
    if (result.ok) {
      onSaved();
    } else {
      setSubmitError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-800">
          {mode === "create" ? `Nuevo ${def.label.replace(/s$/, "").toLowerCase()}` : `Editar ${def.label.replace(/s$/, "").toLowerCase()}`}
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {def.formFields.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              value={values[f.key]}
              error={errors[f.key]}
              onChange={(v) => setField(f.key, v)}
            />
          ))}

          {submitError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const baseInput =
    "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50";
  const errText = error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null;

  if (field.type === "select") {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500"> *</span>}
        </label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
          required={field.required}
        >
          <option value="" disabled>
            Seleccione…
          </option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.help && <p className="text-xs text-slate-500 mt-1">{field.help}</p>}
        {errText}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500"> *</span>}
        </label>
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={field.rows ?? 3}
          className={baseInput}
          placeholder={field.placeholder}
          required={field.required}
        />
        {field.help && <p className="text-xs text-slate-500 mt-1">{field.help}</p>}
        {errText}
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500"> *</span>}
        </label>
        <input
          type="number"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={baseInput}
          placeholder={field.placeholder}
          required={field.required}
        />
        {field.help && <p className="text-xs text-slate-500 mt-1">{field.help}</p>}
        {errText}
      </div>
    );
  }

  if (field.type === "color") {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500"> *</span>}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={(value as string) ?? "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-12 border border-slate-300 rounded-md cursor-pointer"
          />
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`${baseInput} flex-1`}
            placeholder="#00FF00"
          />
        </div>
        {field.help && <p className="text-xs text-slate-500 mt-1">{field.help}</p>}
        {errText}
      </div>
    );
  }

  // default: text
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={baseInput}
        placeholder={field.placeholder}
        required={field.required}
      />
      {field.help && <p className="text-xs text-slate-500 mt-1">{field.help}</p>}
      {errText}
    </div>
  );
}