/**
 * @file Vista principal del worklist: tabla de analitos + acciones P/R/A/V.
 * @id IMPL-20260707-16 — Slice C Resultados.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  bulkCreateLabResultsAction,
  getWorklistAction,
  transitionLabResultAction,
} from "@/actions/lab-result.actions";
import { WorklistTable, type WorklistAnalyte } from "./WorklistTable";
import { LabResultAuditTimeline } from "./LabResultAuditTimeline";

interface OrderHeader {
  id: string;
  folio: number | null;
  status: string;
  urgency: string;
  confidentiality: string;
  patientName: string;
  patientCode: string;
  companyName: string | null;
  medicalEventId: string | null;
  doctorName: string;
  createdAt: string | null;
  items: Array<{ id: string; code: string; name: string }>;
}

interface WorklistItem {
  labOrderItemId: string;
  medicalTestId: string;
  medicalTestCode: string;
  medicalTestName: string;
  analytes: WorklistAnalyte[];
}

interface Props {
  orderId: string;
  header: OrderHeader;
}

export function WorklistView({ orderId, header }: Props) {
  const [items, setItems] = useState<WorklistItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async () => {
    const res = await getWorklistAction(orderId);
    if (!res.ok) {
      setError(res.error);
      setItems([]);
      return;
    }
    setItems(res.data.items as WorklistItem[]);
  }, [orderId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga de worklist de lab results.
    refresh();
  }, [refresh, refreshKey]);

  async function handleBulkSave(
    payloads: Array<{
      labOrderItemId: string;
      analyteId: string;
      valueText?: string | null;
      valueNumber?: number | null;
    }>
  ) {
    if (payloads.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await bulkCreateLabResultsAction({ items: payloads });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessage(`${res.data.created} resultado(s) capturado(s).`);
    setRefreshKey((k) => k + 1);
  }

  async function handleTransition(
    resultId: string,
    action: "report" | "authorize" | "validate" | "invalidate",
    reason?: string
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await transitionLabResultAction(resultId, {
      action,
      reason: reason ?? undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessage(`Transición aplicada. Nuevo estado: ${res.data.newStatus}`);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-12 gap-3 text-sm">
          <div className="col-span-6">
            <div className="text-xs text-slate-500">Paciente</div>
            <div className="font-medium text-slate-800">
              {header.patientName} [{header.patientCode}]
            </div>
          </div>
          <div className="col-span-3">
            <div className="text-xs text-slate-500">Médico</div>
            <div className="font-medium text-slate-800">{header.doctorName}</div>
          </div>
          <div className="col-span-3">
            <div className="text-xs text-slate-500">Estado Orden</div>
            <div className="font-medium text-slate-800">{header.status}</div>
          </div>
        </div>
        {header.medicalEventId && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <span className="text-blue-800">
              📎 Vinculado a papeleta AMI:{" "}
              <a
                href={`/events/${header.medicalEventId}`}
                className="font-medium underline hover:text-blue-900"
              >
                {header.medicalEventId.slice(0, 8)}…
              </a>
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {message}
        </div>
      )}

      {items.map((item) => (
        <WorklistTable
          key={item.labOrderItemId}
          item={item}
          busy={busy}
          onBulkSave={handleBulkSave}
          onTransition={handleTransition}
        />
      ))}

      <LabResultAuditTimeline orderId={orderId} refreshKey={refreshKey} />
    </div>
  );
}