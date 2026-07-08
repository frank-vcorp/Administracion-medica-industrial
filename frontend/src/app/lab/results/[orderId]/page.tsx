/**
 * @file Página detalle de LabOrder con worklist de analitos + ciclo P/R/A/V.
 * @id IMPL-20260707-16 — Slice C Resultados.
 *
 * Server Component: lee orderId desde params y carga el worklist.
 * Next.js 16+ requiere `await params`.
 */
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { WorklistView } from "../_components/WorklistView";

export const dynamic = "force-dynamic";

export default async function LabOrderResultsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  // Traer orden + paciente para cabecera
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
          </p>
        </div>
      </div>
      <WorklistView orderId={orderId} header={headerData} />
    </div>
  );
}