/**
 * @file Formulario principal de admisión LabOrder.
 * @id IMPL-20260701-03 — Slice B Recepción.
 *
 * Cliente Component: orquesta todos los paneles + acciones.
 * Si recibe orderId por props (vía searchParams), carga la orden con
 * getLabOrderAction y la presenta en modo edición DRAFT.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmLabOrderAction,
  createLabOrderAction,
  getLabOrderAction,
  updateLabOrderAction,
  searchCompaniesAction,
  searchDoctorsAction,
  searchWorkersAction,
} from "@/actions/lab-order.actions";
import type {
  CompanySearchResult,
  DoctorSearchResult,
  LabOrderItemInput,
  WorkerSearchResult,
} from "@/lib/validations/lab-order";
import { LabOrderAutocomplete, type AutocompleteItem } from "./LabOrderAutocomplete";
import { LabOrderDeliveryPanel } from "./LabOrderDeliveryPanel";
import { LabOrderFlagsPanel, type LabOrderFlagsState } from "./LabOrderFlagsPanel";
import { LabOrderStudiesTable } from "./LabOrderStudiesTable";
import { LabOrderTotalsPanel } from "./LabOrderTotalsPanel";

interface Props {
  orderId?: string;
}

const EMPTY_FLAGS: LabOrderFlagsState = {
  urgency: "NORMAL",
  confidentiality: "NORMAL",
  language: "es",
  homeSample: false,
  sendResultsByEmail: false,
  generateInvoice: false,
  isCourtesy: false,
  courtesyType: null,
};

export function LabOrderForm({ orderId }: Props) {
  const router = useRouter();
  const [worker, setWorker] = useState<WorkerSearchResult | null>(null);
  const [doctorInput, setDoctorInput] = useState(""); // doctorName libre
  const [doctorClave, setDoctorClave] = useState("");
  const [doctorPicked, setDoctorPicked] = useState<DoctorSearchResult | null>(null);
  const [company, setCompany] = useState<CompanySearchResult | null>(null);
  const [classificationId, setClassificationId] = useState("");
  const [observations, setObservations] = useState("");

  const [patientDiscountPct, setPatientDiscountPct] = useState(0);
  const [doctorDiscountPct, setDoctorDiscountPct] = useState(0);
  const [doctorCommissionPct, setDoctorCommissionPct] = useState(0);
  const [companyDiscountPct, setCompanyDiscountPct] = useState(0);

  const [flags, setFlags] = useState<LabOrderFlagsState>(EMPTY_FLAGS);
  const [delivery, setDelivery] = useState<{ deliveryDate?: string | null; deliveryTime?: string | null }>({
    deliveryDate: null,
    deliveryTime: null,
  });
  const [items, setItems] = useState<LabOrderItemInput[]>([]);

  const [currentOrderId, setCurrentOrderId] = useState<string | undefined>(orderId);
  const [status, setStatus] = useState<string>("NEW");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cargar orden existente si se pasó orderId
  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const res = await getLabOrderAction(orderId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const o = res.data.order as Record<string, unknown>;
      setCurrentOrderId((o.id as string) ?? orderId);
      setStatus((o.status as string) ?? "DRAFT");
      setDoctorInput(String((o.doctorName as string) ?? ""));
      setDoctorClave(((o.doctorClave as string | null) ?? "") || "");
      setClassificationId(((o.classificationId as string | null) ?? "") || "");
      setObservations(((o.observations as string | null) ?? "") || "");
      setPatientDiscountPct(Number((o.patientDiscountPct as number) ?? 0));
      setDoctorDiscountPct(Number((o.doctorDiscountPct as number) ?? 0));
      setDoctorCommissionPct(Number((o.doctorCommissionPct as number) ?? 0));
      setCompanyDiscountPct(Number((o.companyDiscountPct as number) ?? 0));
      setFlags({
        urgency: ((o.urgency as "NORMAL" | "URGENT") ?? "NORMAL"),
        confidentiality: ((o.confidentiality as "NORMAL" | "CONFIDENTIAL") ?? "NORMAL"),
        language: ((o.language as "es" | "en") ?? "es"),
        homeSample: Boolean(o.homeSample),
        sendResultsByEmail: Boolean(o.sendResultsByEmail),
        generateInvoice: Boolean(o.generateInvoice),
        isCourtesy: Boolean(o.isCourtesy),
        courtesyType: (o.courtesyType as string | null) ?? null,
      });
      setDelivery({
        deliveryDate: o.deliveryDate ? String(o.deliveryDate).slice(0, 10) : null,
        deliveryTime: (o.deliveryTime as string | null) ?? null,
      });
      const loadedItems = Array.isArray(o.items)
        ? (o.items as Array<Record<string, unknown>>).map((it) => ({
            medicalTestId: String(it.medicalTestId),
            price: Number(it.price ?? 0),
            discountAmount: Number(it.discountAmount ?? 0),
            discountPct: Number(it.discountPct ?? 0),
          }))
        : [];
      setItems(loadedItems);
      // Worker y company via id se reconstruyen con el objeto completo si viene
      if (o.workerId) {
        setWorker({
          id: o.workerId as string,
          fullName: "",
          code: "",
          age: null,
          companyName: null,
        });
      }
      if (o.companyId) {
        setCompany({ id: o.companyId as string, name: "", rfc: null });
      }
    })();
  }, [orderId]);

  const readOnly = status !== "NEW" && status !== "DRAFT";

  const payload = useMemo(() => {
    if (!worker) return null;
    return {
      workerId: worker.id,
      doctorName: doctorPicked?.name || doctorInput,
      doctorClave: doctorClave || doctorPicked?.clave || null,
      classificationId: classificationId || null,
      companyId: company?.id ?? null,
      patientDiscountPct,
      doctorDiscountPct,
      doctorCommissionPct,
      companyDiscountPct,
      ...flags,
      deliveryDate: delivery.deliveryDate ?? null,
      deliveryTime: delivery.deliveryTime ?? null,
      observations: observations || null,
      items,
    };
  }, [
    worker,
    doctorInput,
    doctorPicked,
    doctorClave,
    classificationId,
    company,
    patientDiscountPct,
    doctorDiscountPct,
    doctorCommissionPct,
    companyDiscountPct,
    flags,
    delivery,
    observations,
    items,
  ]);

  async function onSaveDraft() {
    if (!payload) {
      setError("Selecciona un paciente antes de guardar.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const action = currentOrderId
      ? updateLabOrderAction(currentOrderId, payload)
      : createLabOrderAction(payload);
    const res = await action;
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessage("Borrador guardado.");
    if (!currentOrderId && "id" in res.data) {
      const newId = String(res.data.id);
      setCurrentOrderId(newId);
      setStatus("DRAFT");
      router.replace(`/lab/reception?orderId=${newId}`);
    } else {
      setStatus("DRAFT");
    }
  }

  async function onConfirm() {
    if (!currentOrderId) {
      // Si no había orden previa, primero crear
      if (!payload) {
        setError("Selecciona un paciente y al menos un estudio.");
        return;
      }
      setBusy(true);
      const res = await createLabOrderAction(payload);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCurrentOrderId(res.data.id);
      const conf = await confirmLabOrderAction(res.data.id);
      if (!conf.ok) {
        setError(conf.error);
        return;
      }
      setStatus("SAVED");
      setMessage("Orden confirmada y folio generado.");
      router.replace(`/lab/reception?orderId=${res.data.id}`);
      return;
    }
    setBusy(true);
    // Si estamos editando DRAFT, confirmar
    const conf = await confirmLabOrderAction(currentOrderId);
    setBusy(false);
    if (!conf.ok) {
      setError(conf.error);
      return;
    }
    setStatus("SAVED");
    setMessage("Orden confirmada y folio generado.");
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-base">
            Nueva Admisión {currentOrderId && `(Editando: ${currentOrderId.slice(0, 8)}…)`}
          </h2>
          <span className="text-xs text-gray-500">Fecha: {new Date().toLocaleDateString()}</span>
        </div>
        {error && (
          <div className="mb-2 px-2 py-1 text-xs bg-red-100 text-red-800 border border-red-200 rounded">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-2 px-2 py-1 text-xs bg-green-100 text-green-800 border border-green-200 rounded">
            {message}
          </div>
        )}

        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-6">
            <LabOrderAutocomplete<WorkerSearchResult>
              label="Paciente *"
              placeholder="Buscar por nombre, código..."
              value={worker}
              onChange={setWorker}
              fetchAction={async (q) => await searchWorkersAction(q)}
              displayValue={(w) => `${w.fullName} (${w.code})`}
              renderItem={(w) => (
                <span>
                  <strong>{w.fullName}</strong>{" "}
                  <span className="text-gray-500">[{w.code}]</span>
                  {w.age != null && (
                    <span className="ml-2 text-xs text-gray-600">{w.age} años</span>
                  )}
                </span>
              )}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Edad</label>
            <input
              type="text"
              readOnly
              value={worker?.age ?? ""}
              placeholder="—"
              className="w-full px-2 py-1.5 border rounded text-sm bg-gray-100"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Dto% Pac.</label>
            <input
              type="number"
              min={0}
              max={100}
              value={patientDiscountPct}
              disabled={readOnly}
              onChange={(e) => setPatientDiscountPct(Number(e.target.value) || 0)}
              className="w-full px-2 py-1.5 border rounded text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Empresa</label>
            <input
              type="text"
              value={worker?.companyName ?? ""}
              readOnly
              placeholder="—"
              className="w-full px-2 py-1.5 border rounded text-sm bg-gray-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 mt-2">
          <div className="col-span-6">
            <LabOrderAutocomplete<DoctorSearchResult>
              label="Médico *"
              placeholder="Nombre del médico..."
              value={doctorPicked}
              onChange={(d) => {
                setDoctorPicked(d);
                if (d) setDoctorInput(d.name);
              }}
              fetchAction={async (q) => await searchDoctorsAction(q)}
              displayValue={(d) => d.name}
              renderItem={(d) => (
                <span>
                  <strong>{d.name}</strong>
                  {d.clave && <span className="ml-2 text-gray-500">{d.clave}</span>}
                </span>
              )}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Clave</label>
            <input
              type="text"
              value={doctorClave}
              disabled={readOnly}
              onChange={(e) => setDoctorClave(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Dto% Méd.</label>
            <input
              type="number"
              min={0}
              max={100}
              value={doctorDiscountPct}
              disabled={readOnly}
              onChange={(e) => setDoctorDiscountPct(Number(e.target.value) || 0)}
              className="w-full px-2 py-1.5 border rounded text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Comisión%</label>
            <input
              type="number"
              min={0}
              max={100}
              value={doctorCommissionPct}
              disabled={readOnly}
              onChange={(e) => setDoctorCommissionPct(Number(e.target.value) || 0)}
              className="w-full px-2 py-1.5 border rounded text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 mt-2">
          <div className="col-span-6">
            <LabOrderAutocomplete<CompanySearchResult>
              label="Empresa (opcional)"
              placeholder="Razón social o RFC..."
              value={company}
              onChange={setCompany}
              fetchAction={async (q) => await searchCompaniesAction(q)}
              displayValue={(c) => c.name}
              renderItem={(c) => (
                <span>
                  <strong>{c.name}</strong>
                  {c.rfc && <span className="ml-2 text-gray-500">{c.rfc}</span>}
                </span>
              )}
            />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Dto% Empresa</label>
            <input
              type="number"
              min={0}
              max={100}
              value={companyDiscountPct}
              disabled={readOnly}
              onChange={(e) => setCompanyDiscountPct(Number(e.target.value) || 0)}
              className="w-full px-2 py-1.5 border rounded text-sm"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Clasificación</label>
            <input
              type="text"
              value={classificationId}
              disabled={readOnly}
              onChange={(e) => setClassificationId(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-sm"
              placeholder="ID clasificación"
            />
          </div>
        </div>

        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea
            value={observations}
            disabled={readOnly}
            onChange={(e) => setObservations(e.target.value)}
            maxLength={2000}
            rows={2}
            className="w-full px-2 py-1.5 border rounded text-sm"
          />
        </div>
      </div>

      <LabOrderStudiesTable items={items} onChange={setItems} readOnly={readOnly} />
      <LabOrderFlagsPanel value={flags} onChange={setFlags} readOnly={readOnly} />
      <LabOrderDeliveryPanel
        deliveryDate={delivery.deliveryDate}
        deliveryTime={delivery.deliveryTime}
        onChange={setDelivery}
        readOnly={readOnly}
      />
      <LabOrderTotalsPanel items={items} />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={busy || readOnly}
          className="px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
        >
          Guardar Borrador
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || readOnly || !worker || items.length === 0}
          className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Confirmar y Generar Folio
        </button>
      </div>
      <p className="text-xs text-gray-500 italic">
        Para cancelar una orden DRAFT usa el botón × en el listado lateral.
      </p>
    </div>
  );
}
