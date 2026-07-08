/**
 * @file Botón "Ejecutar seed de 5 estudios típicos" — Server Action call.
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción — E.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { seedTypicalTestsAction } from "@/actions/study.actions";

export function LabCatalogSeedButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await seedTypicalTestsAction();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const d = res.data;
    setMessage(
      `Seed OK: ${d.seeded} estudios, ${d.analytes} analitos, ${d.referenceRanges} rangos.`
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || pending}
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
      >
        {busy || pending ? "Sembrando..." : "🌱 Ejecutar seed (5 estudios)"}
      </button>
      {message && (
        <p className="text-[10px] text-emerald-700">{message}</p>
      )}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}