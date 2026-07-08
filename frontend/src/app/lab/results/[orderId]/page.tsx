/**
 * @file Página detalle de LabOrder con worklist de analitos + ciclo P/R/A/V.
 * @id IMPL-20260707-16 — Slice C Resultados.
 * @id IMPL-20260707-18 — Fase 2 — D Trazabilidad (LabTraceTimeline).
 * @id IMPL-20260708-19 — Fase 3 — F (PDF imprimibles) + G (Pagos + Cortesía).
 *
 * Server Component: lee orderId desde params y carga el worklist.
 * Next.js 16+ requiere `await params`.
 */
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { WorklistView } from "../_components/WorklistView";
// IMPL-20260707-18: Fase 2 — D Trazabilidad (timeline muestra→proceso→entrega)
import { LabTraceTimeline } from "../_components/LabTraceTimeline";
// IMPL-20260708-19: Fase 3 — F (PDF) + G (Pagos + Cortesía)
import { PdfPrintButtons } from "../_components/PdfPrintButtons";
import { PaymentSection } from "../_components/PaymentSection";
import { CourtesyToggle } from "../_components/CourtesyToggle";

export const dynamic = "force-dynamic";

export default async function LabOrderResultsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  // Traer orden + paciente + cortesía para cabecera
  const order = await prisma.labOrder.findUnique({
    where: { id: orderId },
    include: {
      worker: { select: { firstName: true, lastName: true, universalId: true } },
      company: { select: { name: true } },
      items: {
        include: {
          medicalTest: { select: { code: true, name: true } },
        },
      },
      courtesy: true,
    },
  });
  if (!order) {
    notFound();
  }

  const headerData = {
    id: order.id,
    folio: order.folio,
    status: order.status,
    urgency: order.urgency,
    confidentiality: order.confidentiality,
    patientName: `${order.worker?.firstName ?? ""} ${order.worker?.lastName ?? ""}`.trim(),
    patientCode: order.worker?.universalId ?? "",
    companyName: order.company?.name ?? null,
    medicalEventId: order.medicalEventId,
    doctorName: order.doctorName,
    createdAt: order.createdAt?.toISOString() ?? null,
    items: order.items.map((it) => ({
      id: it.id,
      code: it.medicalTest.code,
      name: it.medicalTest.name,
    })),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Hoja de Trabajo — Folio {order.folio ?? "s/folio"}
          </h2>
          <p className="text-sm text-slate-500">
            Paciente: <strong>{headerData.patientName}</strong>
            {headerData.companyName && (
              <> · Empresa: <strong>{headerData.companyName}</strong></>
            )}
            {order.isCourtesy && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded border border-amber-300 bg-amber-50 text-amber-800">
                ⚠️ CORTESÍA
              </span>
            )}
          </p>
        </div>
        {/* IMPL-20260708-19: Fase 3 — F (PDF imprimibles) */}
        <PdfPrintButtons orderId={orderId} hideRecibo={order.isCourtesy} />
      </div>
      <WorklistView orderId={orderId} header={headerData} />
      {/* IMPL-20260707-18: Fase 2 — D Trazabilidad (timeline cronológico) */}
      <LabTraceTimeline orderId={orderId} />
      {/* IMPL-20260708-19: Fase 3 — G Caja: pagos + cortesía */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PaymentSection orderId={orderId} />
        <CourtesyToggle orderId={orderId} />
      </div>
    </div>
  );
}