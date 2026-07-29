/**
 * @file Admisión de Laboratorio auto-llenada desde MedicalEvent.
 * @id IMPL-20260707-17 — Fase 1 NOVA absorción (ARCH-20260707-17) — B-v2.
 *
 * Server Component. Carga el MedicalEvent, deriva worker/doctor/company,
 * y pasa esos datos a LabOrderForm para admisión pre-llenada.
 *
 * Next.js 16+ requiere `await params`.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { LabOrderForm } from "../_components/LabOrderForm";
import { InfoBanner } from "@/components/shared/InfoBanner";
import { getMedicalEventForLabAdmissionAction, autoGenerateLabOrderAction } from "@/actions/pending-order.actions";

export const dynamic = "force-dynamic";

type SP = {
  orderId?: string;
};

export default async function LabReceptionFromEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ medicalEventId: string }>;
  searchParams: Promise<SP>;
}) {
  const { medicalEventId } = await params;
  const sp = await searchParams;
  const orderId = sp.orderId;

  const result = await getMedicalEventForLabAdmissionAction(medicalEventId);
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl">
        <h2 className="text-lg font-bold text-red-700 mb-2">Error</h2>
        <p className="text-red-600 text-sm">{result.error}</p>
        <Link
          href="/lab/reception"
          className="mt-4 inline-block bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
        >
          ← Volver a bandeja
        </Link>
      </div>
    );
  }
  const ev = result.data;

  // Si no hay orderId y hay eventTests, disparar el trigger automáticamente
  let resolvedOrderId = orderId;
  if (!resolvedOrderId && ev.eventTests.length > 0) {
    const trig = await autoGenerateLabOrderAction({ medicalEventId });
    if (trig.ok && trig.data.labOrderId) {
      resolvedOrderId = trig.data.labOrderId;
    }
  }

  // Si después del trigger no hay items Lab Pendientes, redirigir a la papeleta
  if (ev.eventTests.length === 0) {
    return (
      <div className="space-y-4">
        <InfoBanner
          icon={<span aria-hidden>⚠️</span>}
          title="Esta papeleta no tiene EventTests SAMPLE_TAKEN de Laboratorio"
        >
          Solo se pueden crear admisiones Lab desde papeletas con muestras de laboratorio.
        </InfoBanner>
        <Link
          href={`/events/${medicalEventId}`}
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          ← Volver a la papeleta
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Admisión Lab — Papeleta auto-llenada</h2>
          <p className="text-sm text-slate-500">
            Datos importados automáticamente desde la papeleta #{ev.medicalEventId.slice(0, 8)}…
          </p>
        </div>
        <Link
          href="/lab/reception"
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          ← Bandeja
        </Link>
      </div>

      <InfoBanner
        icon={<span aria-hidden>✅</span>}
        title="Pre-llenado desde MedicalEvent"
      >
        Paciente, médico y empresa vienen de la papeleta. Solo confirme precios y folio.
      </InfoBanner>

      <LabOrderForm
        orderId={resolvedOrderId}
        initialWorkerId={ev.workerId}
        initialMedicalEventId={ev.medicalEventId}
        initialMedicalEvent={{
          medicalEventId: ev.medicalEventId,
          workerId: ev.workerId,
          workerName: ev.workerName,
          workerCode: ev.workerCode,
          companyId: ev.companyId,
          companyName: ev.companyName,
          branchId: ev.branchId,
          branchName: ev.branchName,
          doctorName: ev.doctorName,
          intakeCreatedByUserId: ev.intakeCreatedByUserId,
          eventTests: ev.eventTests,
        }}
      />
    </div>
  );
}