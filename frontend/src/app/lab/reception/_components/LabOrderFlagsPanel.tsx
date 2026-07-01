/**
 * @file Panel de flags (urgencia, confidencialidad, idioma, cortesía, etc.).
 * @id IMPL-20260701-03 — Slice B Recepción.
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
      // safe generic boolean toggle (overload individual pairs below)
      onChange({ ...value, [key]: !current } as LabOrderFlagsState);
    }
  };

  const set = <K extends keyof LabOrderFlagsState>(key: K, v: LabOrderFlagsState[K]) => {
    if (readOnly) return;
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="border rounded bg-white p-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.urgency === "URGENT"}
            disabled={readOnly}
            onChange={() => set("urgency", value.urgency === "URGENT" ? "NORMAL" : "URGENT")}
          />
          <span>Urgente</span>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.confidentiality === "CONFIDENTIAL"}
            disabled={readOnly}
            onChange={() =>
              set("confidentiality", value.confidentiality === "CONFIDENTIAL" ? "NORMAL" : "CONFIDENTIAL")
            }
          />
          <span>Confidencial</span>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.homeSample}
            disabled={readOnly}
            onChange={() => toggle("homeSample")}
          />
          <span>Toma a domicilio</span>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.sendResultsByEmail}
            disabled={readOnly}
            onChange={() => toggle("sendResultsByEmail")}
          />
          <span>Enviar mail</span>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.generateInvoice}
            disabled={readOnly}
            onChange={() => toggle("generateInvoice")}
          />
          <span>Generar factura</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-medium">Idioma:</span>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={value.language === "es"}
            disabled={readOnly}
            onChange={() => set("language", "es")}
          />
          <span>Español</span>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={value.language === "en"}
            disabled={readOnly}
            onChange={() => set("language", "en")}
          />
          <span>Inglés</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.isCourtesy}
            disabled={readOnly}
            onChange={() => toggle("isCourtesy")}
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
            className="px-2 py-1 border rounded text-xs flex-1 min-w-[150px]"
          />
        )}
      </div>
    </div>
  );
}
