/**
 * @file Sección "Laboratorio" en la papeleta AMI.
 * @id IMPL-20260707-16 — Slice C — integración papeleta ↔ LabOrder.
 *
 * Server Component: lista LabOrders asociadas al MedicalEvent + LabResults
 * con sus analitos, valores, rangos y estado. Link "Crear nueva orden" que
 * pre-llena workerId + medicalEventId en /lab/reception.
 */
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getStatusColor, getStatusLabel } from "@/lib/lab-result-utils";

interface Props {
  medicalEventId: string;
  workerId: string;
}

export async function LabSection({ medicalEventId, workerId }: Props) {
  const labOrders = await prisma.labOrder.findMany({
    where: { medicalEventId },
    include: {
      items: {
        include: {
          medicalTest: { select: { code: true, name: true } },
          results: {
            include: {
              analyte: { select: { code: true, name: true, dataType: true } },
              unit: { select: { symbol: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Laboratorio</h3>
          <p className="text-xs text-slate-500">
            {labOrders.length === 0
              ? "Sin órdenes de laboratorio asociadas"
              : `${labOrders.length} orden(es) asociada(s)`}
          </p>
        </div>
        <Link
          href={`/lab/reception?workerId=${workerId}&medicalEventId=${medicalEventId}`}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        >
          + Nueva orden
        </Link>
      </div>

      {labOrders.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          Aún no hay órdenes. Crea una nueva para empezar.
        </p>
      ) : (
        <ul className="space-y-3">
          {labOrders.map((o) => {
            const totalResults = o.items.reduce(
              (acc, it) => acc + (it.results?.length ?? 0),
              0
            );
            return (
              <li
                key={o.id}
                className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/lab/results/${o.id}`}
                      className="font-medium text-blue-700 hover:text-blue-900"
                    >
                      Folio {o.folio ?? "s/folio"} · {o.doctorName}
                    </Link>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {o.createdAt?.toLocaleString() ?? "—"} · {o.items.length}{" "}
                      estudio(s) · {totalResults} resultado(s)
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(
                      (o.status === "CANCELLED"
                        ? "INVALIDATED"
                        : o.status === "COMPLETED"
                          ? "VALIDATED"
                          : o.status === "SAVED"
                            ? "PENDING"
                            : "REPORTED") as never
                    )}`}
                  >
                    {o.status}
                  </span>
                </div>

                {/* Resultados detallados */}
                {o.items.some((it) => it.results && it.results.length > 0) && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <table className="w-full text-xs">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="text-left py-1">Estudio</th>
                          <th className="text-left py-1">Analito</th>
                          <th className="text-left py-1">Valor</th>
                          <th className="text-left py-1">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {o.items.flatMap((it) =>
                          (it.results ?? []).map((r) => (
                            <tr key={r.id}>
                              <td className="py-1 font-mono text-slate-700">
                                {it.medicalTest.code}
                              </td>
                              <td className="py-1 text-slate-700">
                                {r.analyte?.code ?? "—"}
                              </td>
                              <td className="py-1 font-mono">
                                {r.valueNumber !== null && r.valueNumber !== undefined
                                  ? r.valueNumber
                                  : r.valueText ?? "—"}
                                {r.unit?.symbol && (
                                  <span className="text-slate-400 ml-1">
                                    {r.unit.symbol}
                                  </span>
                                )}
                              </td>
                              <td className="py-1">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] ${getStatusColor(
                                    r.status
                                  )}`}
                                >
                                  {getStatusLabel(r.status)}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}