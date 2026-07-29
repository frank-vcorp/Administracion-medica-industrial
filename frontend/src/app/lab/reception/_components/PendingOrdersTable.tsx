/**
 * @file Tabla de papeletas pendientes (bandeja).
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción (ARCH-20260707-17) — B-v2.
 *
 * Server Component que muestra la bandeja y un botón "Crear admisión"
 * que navega a /lab/reception/[medicalEventId] para admisión auto-llenada.
 */
"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  autoGenerateLabOrderAction,
  getPendingLabOrdersAction,
  type PendingOrderRow,
} from "@/actions/pending-order.actions";

interface Props {
  initialBranchId?: string | null;
}

export function PendingOrdersTable({ initialBranchId }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<PendingOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function reload() {
    setLoading(true);
    setError(null);
    const res = await getPendingLabOrdersAction(initialBranchId);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRows(res.data.rows);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarga inicial al cambiar sucursal.
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBranchId]);

  async function handleQuickGenerate(row: PendingOrderRow) {
    setBusyId(row.medicalEventId);
    const res = await autoGenerateLabOrderAction({ medicalEventId: row.medicalEventId });
    setBusyId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Refrescar bandeja y navegar a admisión con el id
    startTransition(() => {
      router.push(`/lab/reception/${row.medicalEventId}?orderId=${res.data.labOrderId}`);
    });
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-sm text-slate-500">
        Cargando bandeja de papeletas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        Error: {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-sm text-slate-600">
          🎉 No hay papeletas pendientes con muestras de laboratorio.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Las papeletas aparecerán aquí cuando el consultorio marque
          <span className="font-mono mx-1">SAMPLE_TAKEN</span>
          en un EventTest de categoría Laboratorio.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <h3 className="font-semibold text-sm text-slate-800">
          Bandeja ({rows.length})
        </h3>
        <button
          type="button"
          onClick={reload}
          className="text-xs text-blue-700 hover:text-blue-900 underline"
        >
          Refrescar
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-slate-600">
              <th className="px-3 py-2 font-medium">Papeleta</th>
              <th className="px-3 py-2 font-medium">Paciente</th>
              <th className="px-3 py-2 font-medium">Empresa</th>
              <th className="px-3 py-2 font-medium">Médico</th>
              <th className="px-3 py-2 font-medium">Estudios Lab</th>
              <th className="px-3 py-2 font-medium">Sucursal</th>
              <th className="px-3 py-2 font-medium text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.medicalEventId} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-slate-700">
                  <Link
                    href={`/events/${row.medicalEventId}`}
                    className="text-blue-700 hover:text-blue-900 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    #{row.folio}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{row.workerName}</div>
                  <div className="text-slate-500 font-mono">{row.workerCode}</div>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {row.companyName || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2 text-slate-600">{row.doctorName}</td>
                <td className="px-3 py-2">
                  <ul className="space-y-0.5">
                    {row.eventTests.map((et) => (
                      <li key={et.id} className="text-slate-700">
                        <span className="font-medium">
                          {et.medicalTestCode || et.testNameSnapshot}
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {row.branchName || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-col gap-1 items-end">
                    <Link
                      href={`/lab/reception/${row.medicalEventId}`}
                      className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Crear admisión
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleQuickGenerate(row)}
                      disabled={busyId === row.medicalEventId || pending}
                      className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-slate-700 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      {busyId === row.medicalEventId ? "Generando..." : "Generar LabOrder (rápido)"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}