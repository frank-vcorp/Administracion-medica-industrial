/**
 * @file Client component con los controles de migración NOVA → AMI.
 * @id IMPL-20260708-FINAL — Fase 4 NOVA absorción (H Migración).
 * @backup context/SPECs/MIGRATION-NOVA-MAPPING.md
 *
 * UI:
 *  - 3 botones: Dry-run / Apply persistent / Validar
 *  - Muestra el último reporte JSON en pantalla
 *  - Estado de loading / error por separado por acción
 */
"use client";

import { useState, useTransition } from "react";
import {
  dryRunMigrationAction,
  applyPersistentMigrationAction,
  validateMigrationAction,
  type MigrationReport,
} from "@/actions/migration.actions";

type Mode = "idle" | "dry-run" | "apply" | "validate";
type ReportState = {
  mode: Mode;
  loading: boolean;
  report: MigrationReport | null;
  error: string | null;
};

export default function MigrationRunner() {
  const [state, setState] = useState<ReportState>({
    mode: "idle",
    loading: false,
    report: null,
    error: null,
  });
  const [, startTransition] = useTransition();

  function runAction(mode: Mode, fn: () => Promise<MigrationReport>) {
    setState({ mode, loading: true, report: null, error: null });
    startTransition(async () => {
      try {
        const report = await fn();
        setState({ mode, loading: false, report, error: null });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setState({ mode, loading: false, report: null, error: msg });
      }
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <header className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">
          Migración NOVA → AMI
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Ejecuta el script de migración de Fase 4 (H). Las acciones
          servidor invocan <code>backend/scripts/migrate_nova.py</code>{" "}
          o <code>validate_migration.py</code> por subprocess y devuelven
          el reporte estructurado.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          disabled={state.loading}
          onClick={() => runAction("dry-run", () => dryRunMigrationAction())}
          className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition"
          data-testid="btn-dry-run"
        >
          {state.loading && state.mode === "dry-run" ? "⏳ ..." : "🔍"} Dry-run
          <span className="block text-xs text-slate-500 font-normal mt-1">
            Audita sin escribir
          </span>
        </button>

        <button
          type="button"
          disabled={state.loading}
          onClick={() =>
            runAction("apply", () => applyPersistentMigrationAction())
          }
          className="rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-sm transition"
          data-testid="btn-apply-persistent"
        >
          {state.loading && state.mode === "apply" ? "⏳ ..." : "✅"} Aplicar persistente
          <span className="block text-xs text-emerald-700 font-normal mt-1">
            Sincroniza novaClave + metadatos LIS
          </span>
        </button>

        <button
          type="button"
          disabled={state.loading}
          onClick={() =>
            runAction("validate", () => validateMigrationAction())
          }
          className="rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 px-4 py-3 text-sm font-medium text-sky-900 shadow-sm transition"
          data-testid="btn-validate"
        >
          {state.loading && state.mode === "validate" ? "⏳ ..." : "📋"} Validar
          <span className="block text-xs text-sky-700 font-normal mt-1">
            Reporte de estado actual
          </span>
        </button>
      </section>

      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 text-red-900 p-4 text-sm"
        >
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {state.report && (
        <section className="space-y-4" data-testid="report-section">
          <header className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">
              Reporte {state.mode}
            </h2>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                state.report.ok
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {state.report.ok ? "OK" : "Con observaciones"}
            </span>
          </header>

          <pre
            data-testid="report-json"
            className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto max-h-[500px]"
          >
            {JSON.stringify(state.report, null, 2)}
          </pre>

          {state.report.warnings && state.report.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-4">
              <h3 className="font-semibold mb-2 text-sm">
                ⚠️ Warnings ({state.report.warnings.length})
              </h3>
              <ul className="text-xs space-y-1 list-disc list-inside">
                {state.report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {state.report.errors && state.report.errors.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 text-red-900 p-4">
              <h3 className="font-semibold mb-2 text-sm">
                ❌ Errors ({state.report.errors.length})
              </h3>
              <ul className="text-xs space-y-1 list-disc list-inside">
                {state.report.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}