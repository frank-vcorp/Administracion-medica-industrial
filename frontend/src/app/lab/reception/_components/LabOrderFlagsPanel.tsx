/**
 * @file Panel de flags (urgencia, confidencialidad, idioma, cortesía, etc.).
 * @id IMPL-20260701-03 — Slice B Recepción.
 *
 * IMPL-20260706-02: refactor visual a paleta AMI (slate).
 */
"use client";

export interface LabOrderFlagsState {
  urgency: "NORMAL" | "URGENT";
  confidentiality: "NORMAL" | "CONFIDENTIAL";
  language: "es" | "en";
  homeSample: boolean;
  sendResultsByEmail: boolean;
  generateInvoice: boolean;
  isCourtesy: boolean;
  courtesyType?: string | null;
}

interface Props {
  value: LabOrderFlagsState;
  onChange: (next: LabOrderFlagsState) => void;
  readOnly?: boolean;
}

export function LabOrderFlagsPanel({ value, onChange, readOnly }: Props) {
  const toggle = (key: keyof LabOrderFlagsState) => {
    if (readOnly) return;
    const current = value[key];
    if (typeof current === "boolean") {
      onChange({ ...value, [key]: !current } as LabOrderFlagsState);
    }
  };

  const set = <K extends keyof LabOrderFlagsState>(key: K, v: LabOrderFlagsState[K]) => {
    if (readOnly) return;
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-3 text-sm text-slate-700">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.urgency === "URGENT"}
            disabled={readOnly}
            onChange={() => set("urgency", value.urgency === "URGENT" ? "NORMAL" : "URGENT")}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Urgente</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.confidentiality === "CONFIDENTIAL"}
            disabled={readOnly}
            onChange={() =>
              set("confidentiality", value.confidentiality === "CONFIDENTIAL" ? "NORMAL" : "CONFIDENTIAL")
            }
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Confidencial</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.homeSample}
            disabled={readOnly}
            onChange={() => toggle("homeSample")}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Toma a domicilio</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.sendResultsByEmail}
            disabled={readOnly}
            onChange={() => toggle("sendResultsByEmail")}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Enviar mail</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.generateInvoice}
            disabled={readOnly}
            onChange={() => toggle("generateInvoice")}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Generar factura</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100">
        <span className="font-medium text-slate-800">Idioma:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={value.language === "es"}
            disabled={readOnly}
            onChange={() => set("language", "es")}
            className="border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Español</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={value.language === "en"}
            disabled={readOnly}
            onChange={() => set("language", "en")}
            className="border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Inglés</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.isCourtesy}
            disabled={readOnly}
            onChange={() => toggle("isCourtesy")}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Cortesía</span>
        </label>
        {value.isCourtesy && (
          <input
            type="text"
            placeholder="Motivo cortesía"
            value={value.courtesyType ?? ""}
            disabled={readOnly}
            onChange={(e) => set("courtesyType", e.target.value)}
            className="flex-1 min-w-[150px] border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
          />
        )}
      </div>
    </div>
  );
}