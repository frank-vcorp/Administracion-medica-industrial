/**
 * @file Página principal de Recepción de Laboratorio (Slice B NOVA absorción).
 * @id IMPL-20260701-03 — Slice B Recepción (ARCH-20260701-03).
 * @backup context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
 *
 * Server Component.
 * Next.js 16+ requiere `await searchParams`.
 * Layout 2 columnas: Form (2/3) + Listado (1/3).
 */
import { LabOrderForm } from "./_components/LabOrderForm";
import { LabOrdersList } from "./_components/LabOrdersList";

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
    <div className="p-6">
      <div className="bg-amber-100 border-l-4 border-amber-500 px-3 py-2 mb-4 text-sm flex items-center justify-between">
        <span>🧪 Módulo LAB — Slice B — Solo admisión demo</span>
        <span className="text-xs text-amber-700">
          Backend: /api/v1/lab/orders · FastAPI · Slice B estable
        </span>
      </div>
      <h1 className="text-2xl font-bold mb-4">Recepción de Laboratorio</h1>
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
