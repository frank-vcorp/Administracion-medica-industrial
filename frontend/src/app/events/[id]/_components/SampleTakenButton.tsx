/**
 * @file Botón "Tomar muestra" por EventTest de categoría Laboratorio.
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción (ARCH-20260707-17) — B-v2.
 *
 * Cliente Component. Muestra el botón solo si el EventTest está en estado
 * PENDING/IN_PROGRESS (no SAMPLE_TAKEN/COMPLETED/CANCELLED).
 * Tras click, marca SAMPLE_TAKEN y muestra confirmación + link a la admisión
 * recién creada por el trigger.
 */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { markSampleTakenAction } from "@/actions/pending-order.actions";

interface Props {
  eventTestId: string;
  eventTestStatus: string;
  medicalEventId: string;
}

export function SampleTakenButton({ eventTestId, eventTestStatus, medicalEventId }: Props) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    triggeredLabOrderId: string | null;
    triggeredFolio: number | null;
  } | null>(null);

  const normalized = String(eventTestStatus ?? "").toUpperCase();
  // Solo permitir si está PENDING (todavía no se tomó muestra)
  const canTake = normalized === "PENDING" || normalized === "IN_PROGRESS";

  if (!canTake) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
        <span aria-hidden>✓</span> Muestra {normalized === "SAMPLE_TAKEN" ? "tomada" : normalized.toLowerCase()}
      </span>
    );
  }

  async function handleClick() {
    setBusy(true);
    setError(null);
    const res = await markSampleTakenAction(eventTestId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult({
      triggeredLabOrderId: res.data.triggeredLabOrder?.labOrderId ?? null,
      triggeredFolio: res.data.triggeredLabOrder?.folio ?? null,
    });
    startTransition(() => {
      // Refrescar la papeleta para que se vean los cambios
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    });
  }

  if (result) {
    if (result.triggeredLabOrderId) {
      return (
        <Link
          href={`/lab/reception/${medicalEventId}?orderId=${result.triggeredLabOrderId}`}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 hover:text-emerald-900 underline"
        >
          ✓ Muestra tomada · LabOrder #{result.triggeredFolio ?? "—"}
        </Link>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
        ✓ Muestra tomada
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || pending}
        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {busy || pending ? "..." : "🧪 Tomar muestra"}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </span>
  );
}