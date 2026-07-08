/**
 * @file Resumen de LabResults para un EventTest específico.
 * @id IMPL-20260707-18 — Fase 2 — C-update (vinculación LabResult ↔ EventTest).
 * @backup context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 2B)
 *
 * Server Component: lista todos los LabResults cuyo eventTestId coincide
 * con el del EventTest. Muestra analito, valor, unidad, estado, flag
 * de fuera de rango / crítico.
 */
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getStatusColor, getStatusLabel } from "@/lib/lab-result-utils";

interface Props {
  eventTestId: string;
}

export async function LabResultsSummary({ eventTestId }: Props) {
  const results = await prisma.labResult.findMany({
    where: { eventTestId },
    orderBy: { createdAt: "desc" },
    include: {
      analyte: { select: { code: true, name: true, dataType: true } },
      unit: { select: { symbol: true } },
      labOrderItem: {
        include: {
          labOrder: { select: { id: true, folio: true, status: true } },
        },
      },
    },
  });

  if (results.length === 0) {
    return (
      <p className="text-[11px] text-slate-500 italic pl-1">
        Sin resultados capturados aún.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5 pl-1">
      {results.map((r) => {
        const order = r.labOrderItem?.labOrder;
        const value =
          r.valueNumber !== null && r.valueNumber !== undefined
            ? String(r.valueNumber)
            : r.valueText ?? "—";
        return (
          <li
            key={r.id}
            className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] flex flex-wrap items-center gap-2"
          >
            <span className="font-mono text-slate-700">
              {r.analyte?.code ?? "—"}
            </span>
            <span className="text-slate-500 truncate max-w-[140px]">
              {r.analyte?.name}
            </span>
            <span className="font-mono text-slate-800">
              {value}
              {r.unit?.symbol && (
                <span className="text-slate-400 ml-0.5">{r.unit.symbol}</span>
              )}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] ${getStatusColor(
                r.status
              )}`}
            >
              {getStatusLabel(r.status)}
            </span>
            {r.isCritical && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] bg-red-100 text-red-800 border-red-300">
                Crítico
              </span>
            )}
            {r.isOutOfRange && !r.isCritical && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                Fuera de rango
              </span>
            )}
            {order && (
              <Link
                href={`/lab/results/${order.id}`}
                className="ml-auto text-blue-700 hover:text-blue-900 font-medium"
              >
                Folio {order.folio ?? "s/folio"} →
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
