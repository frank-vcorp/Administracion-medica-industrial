/**
 * @file Página principal de Recepción de Laboratorio (Slice B NOVA absorción).
 * @id IMPL-20260701-03 — Slice B Recepción (ARCH-20260701-03).
 * @backup context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
 *
 * Server Component.
 * Next.js 16+ requiere `await searchParams`.
 * Layout 2 columnas: Form (2/3) + Listado (1/3).
 *
 * IMPL-20260706-02: banner amarillo reemplazado por InfoBanner neutro (paleta AMI).
 */
import { LabOrderForm } from "./_components/LabOrderForm";
import { LabOrdersList } from "./_components/LabOrdersList";
import { InfoBanner } from "@/components/shared/InfoBanner";

export const dynamic = "force-dynamic";

type SP = { list?: string; orderId?: string; edit?: string };

export default async function LabReceptionPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const orderId = sp.orderId || sp.edit;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Recepción de Laboratorio</h2>
          <p className="text-sm text-slate-500">
            Admisión de órdenes, estudios y totales. Backend FastAPI (Slice B estable).
          </p>
        </div>
      </div>

      <InfoBanner
        icon={<span aria-hidden>🧪</span>}
        title="Módulo LAB — Slice B — Solo admisión demo"
      >
        Backend: <code className="bg-slate-100 px-1 rounded text-xs">/api/v1/lab/orders</code>{" "}
        · FastAPI · Slice B estable.
      </InfoBanner>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <LabOrderForm orderId={orderId} />
        </div>
        <div className="lg:col-span-1">
          <LabOrdersList />
        </div>
      </div>
    </div>
  );
}