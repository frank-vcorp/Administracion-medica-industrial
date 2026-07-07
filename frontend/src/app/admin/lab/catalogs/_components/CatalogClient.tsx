/**
 * @file Catálogo Client: orquesta CatalogTable + modal crear/editar.
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 *
 * IMPL-20260706-02: banner amarillo reemplazado por InfoBanner neutro (paleta AMI).
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CatalogTable from "./CatalogTable";
import CatalogForm from "./CatalogForm";
import { CATALOG_DEFS, type CatalogDef } from "../_lib/catalog-defs";
import { InfoBanner } from "@/components/shared/InfoBanner";
import {
  type LabCatalogMod,
  LAB_CATALOG_MODS,
} from "@/lib/validations/lab-catalog";

export default function LabCatalogClient({ initialMod }: { initialMod: LabCatalogMod }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mod, setMod] = useState<LabCatalogMod>(initialMod);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [modalState, setModalState] = useState<
    { mode: "create" } | { mode: "edit"; item: Record<string, unknown> } | null
  >(null);

  const def: CatalogDef = CATALOG_DEFS[mod];

  function handleModChange(next: LabCatalogMod) {
    setMod(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("mod", next);
    startTransition(() => {
      router.push(`/admin/lab/catalogs?${params.toString()}`);
    });
  }

  function handleSaved() {
    setModalState(null);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      {/* Banner info — antes era amarillo chillón, ahora neutro AMI */}
      <InfoBanner
        icon={<span aria-hidden>🧪</span>}
        title="Módulo LAB — Slice A — Solo catálogos demo"
      >
        {def.description}. Las tablas operativas (LabOrder, LabResult, etc.) llegan en
        slices B-G.
      </InfoBanner>

      {/* Header con selector de mod y botón Nuevo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Módulo de Laboratorios</h2>
          <p className="text-sm text-slate-500">
            Catálogo actual: <span className="font-medium">{def.label}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600" htmlFor="mod-select">
            Cambiar catálogo:
          </label>
          <select
            id="mod-select"
            value={mod}
            onChange={(e) => handleModChange(e.target.value as LabCatalogMod)}
            disabled={isPending}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {LAB_CATALOG_MODS.map((m) => (
              <option key={m} value={m}>
                {CATALOG_DEFS[m].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setModalState({ mode: "create" })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            + Nuevo
          </button>
        </div>
      </div>

      <CatalogTable
        key={`${mod}-${refreshKey}`}
        mod={mod}
        def={def}
        onEdit={(item) => setModalState({ mode: "edit", item })}
      />

      {modalState && (
        <CatalogForm
          mod={mod}
          def={def}
          mode={modalState.mode}
          initialValues={modalState.mode === "edit" ? modalState.item : undefined}
          onClose={() => setModalState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}