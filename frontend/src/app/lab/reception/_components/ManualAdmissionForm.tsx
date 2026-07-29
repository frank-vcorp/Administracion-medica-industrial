/**
 * @file Fallback de admisión manual para /lab/reception?mode=manual.
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción (ARCH-20260707-17) — B-v2.
 *
 * Wrapper delgado sobre LabOrderForm (que ya soporta admisión completa).
 * Usado cuando el paciente NO tiene papeleta (walk-in externo).
 */
"use client";

import Link from "next/link";
import { LabOrderForm } from "./LabOrderForm";

interface Props {
  orderId?: string;
}

export function ManualAdmissionForm({ orderId }: Props) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong>Modo admisión manual.</strong>{" "}
        Use este formulario solo para pacientes sin papeleta previa (walk-in externo).
        Para admisiones automáticas use la{" "}
        <Link href="/lab/reception" className="underline">
          bandeja de papeletas
        </Link>
        .
      </div>
      <LabOrderForm orderId={orderId} />
    </div>
  );
}