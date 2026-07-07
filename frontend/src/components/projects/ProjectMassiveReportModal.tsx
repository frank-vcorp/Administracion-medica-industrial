'use client';

// IMPL-20260630-03: Modal de preview + generacion de Reporte Masivo.
// ARCH-20260623-01: Modulo de Reportes Masivos.

import { useEffect, useMemo, useState } from 'react';

import { useProjectReportStatus } from '@/hooks/useProjectReportStatus';
import { calcularConteos } from '@/lib/reports/conteos';
import type { ReportFormat } from '@/lib/reports/types';
import {
  createMassiveReportAction,
  getProjectReportsHistoryAction,
} from '@/actions/project-reports.actions';

interface Props {
  projectId: string;
  workers: Array<{
    id?: string;
    event?: {
      eventTests?: Array<{
        status: string;
        resultNotes?: string | null;
      }> | null;
    } | null;
  }>;
  open: boolean;
  onClose: () => void;
}

type GenerationState =
  | { kind: 'IDLE' }
  | { kind: 'CREATING' }
  | { kind: 'POLLING'; reportId: string }
  | { kind: 'READY'; xlsxUrl: string | null; pdfUrl: string | null }
  | { kind: 'ERROR'; message: string };

function sanitizeFilename(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

function downloadUrl(projectId: string, reportId: string, format: 'xlsx' | 'pdf'): string {
  // FIX-UI-20260706-18: Las URLs de descarga deben apuntar al backend FastAPI
  // en Railway (NO a Vercel), porque el endpoint /api/v2/projects/{}/reports/{}/download
  // NO existe en el frontend Next.js — solo existe en el backend Python.
  //
  // NEXT_PUBLIC_BACKEND_URL debe estar configurada en Vercel con el dominio
  // público del backend Railway (https://administracion-medica-industrial-production.up.railway.app).
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
  return `${backendUrl}/api/v2/projects/${projectId}/reports/${reportId}/download?format=${format}`;
}

export function ProjectMassiveReportModal({ projectId, workers, open, onClose }: Props) {
  const conteos = useMemo(() => calcularConteos(workers), [workers]);
  const [formato, setFormato] = useState<ReportFormat>('BOTH');
  const [generation, setGeneration] = useState<GenerationState>({ kind: 'IDLE' });
  const [history, setHistory] = useState<
    Array<{ id: string; format: string; status: string; generatedAt: string }>
  >([]);

  const pollingReportId =
    generation.kind === 'POLLING' ? generation.reportId : null;
  const statusState = useProjectReportStatus(projectId, pollingReportId);

  // Reflejar el resultado del polling en el state local.
  useEffect(() => {
    if (generation.kind !== 'POLLING') return;
    if (statusState.status === 'READY') {
      setGeneration({
        kind: 'READY',
        xlsxUrl: statusState.xlsxUrl,
        pdfUrl: statusState.pdfUrl,
      });
    } else if (statusState.status === 'FAILED') {
      setGeneration({
        kind: 'ERROR',
        message: statusState.error || 'Error generando reporte',
      });
    }
  }, [generation.kind, statusState]);

  // Cargar historial al abrir el modal.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await getProjectReportsHistoryAction(projectId);
      if (!cancelled && res.success && res.data) {
        setHistory(
          res.data.map((r) => ({
            id: r.id,
            format: r.format,
            status: r.status,
            generatedAt: r.generatedAt,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  if (!open) return null;

  const handleGenerate = async () => {
    setGeneration({ kind: 'CREATING' });
    const res = await createMassiveReportAction(projectId, formato);
    if (!res.success || !res.data) {
      setGeneration({ kind: 'ERROR', message: res.error || 'No se pudo crear el reporte' });
      return;
    }
    setGeneration({ kind: 'POLLING', reportId: res.data.id });
  };

  const handleClose = () => {
    setGeneration({ kind: 'IDLE' });
    onClose();
  };

  const slug = sanitizeFilename(projectId) || 'PROYECTO';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proj-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="proj-modal-title" className="text-lg font-semibold text-slate-900">
            Reporte Masivo &mdash; Proyecto {slug}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Cerrar modal"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Conteos */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Resumen</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card titulo="total" valor={conteos.total} color="slate" />
              <Card titulo="completos" valor={conteos.completos} color="green" />
              <Card titulo="parciales" valor={conteos.parciales} color="amber" />
              <Card titulo="sin estudios" valor={conteos.sinEstudios} color="red" />
            </div>
          </section>

          {/* Selector formato */}
          {generation.kind === 'IDLE' || generation.kind === 'ERROR' ? (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Formato de salida
              </h3>
              <div className="flex flex-col gap-2">
                {(['XLSX', 'EBOOK', 'BOTH'] as const).map((f) => (
                  <label
                    key={f}
                    className={`flex items-start gap-3 p-3 rounded border cursor-pointer ${
                      formato === f
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="proj-formato"
                      value={f}
                      checked={formato === f}
                      onChange={() => setFormato(f)}
                      className="mt-1"
                      data-testid={`format-${f}`}
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {f === 'EBOOK' ? 'EBOOK (PDF navegable)' : f}
                      </div>
                      <div className="text-xs text-slate-500">
                        {f === 'XLSX' && '3 hojas: CONCENTRADO, LABORATORIOS, GRAFICAS'}
                        {f === 'EBOOK' &&
                          'Documento unico con indice, bookmarks, estadisticas con mini-graficas y una seccion por trabajador con sus estudios e imagenes embebidas. Reemplaza la carpeta fisica.'}
                        {f === 'BOTH' && 'Genera XLSX + EBOOK en la misma corrida'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              {/* IMPL-20260701-04: nota de traduccion via browser built-in (SPEC seccion 3, decision 15). */}
              <p className="text-xs italic text-slate-500 mt-2">
                💡 Los EBOOKs estan en espanol. Si necesita traducirlo, abralo en
                Chrome/Edge y use la funcion de traduccion del navegador
                (click derecho &rarr; Traducir).
              </p>
            </section>
          ) : null}

          {/* Polling */}
          {(generation.kind === 'CREATING' ||
            (generation.kind === 'POLLING' && statusState.status !== 'READY')) && (
            <section className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="text-sm text-blue-900">
                {generation.kind === 'CREATING'
                  ? 'Creando reporte...'
                  : `Estado: ${statusState.status}...`}
              </span>
            </section>
          )}

          {/* Ready */}
          {generation.kind === 'READY' && (
            <section className="space-y-3" data-testid="download-section">
              <h3 className="text-sm font-semibold text-slate-700">
                Archivos generados
              </h3>
              <div className="flex flex-col gap-2">
                {generation.xlsxUrl && pollingReportId && (
                  <a
                    href={downloadUrl(projectId, pollingReportId, 'xlsx')}
                    download={`REPORTE_${slug}.xlsx`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm w-fit"
                  >
                    Descargar XLSX
                  </a>
                )}
                {generation.pdfUrl && pollingReportId && (
                  <a
                    href={downloadUrl(projectId, pollingReportId, 'pdf')}
                    download={`EBOOK_${slug}.pdf`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm w-fit"
                  >
                    Descargar EBOOK (PDF)
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Error */}
          {generation.kind === 'ERROR' && (
            <section className="p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-900">
                <strong>Error:</strong> {generation.message}
              </p>
            </section>
          )}

          {/* Historial */}
          {history.length > 0 && (
            <section>
              <details>
                <summary className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Historial ({history.length})
                </summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between border-b border-slate-100 py-1">
                      <span>{new Date(h.generatedAt).toLocaleString()}</span>
                      <span>
                        {h.format} &mdash; <em>{h.status}</em>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded"
          >
            {generation.kind === 'READY' ? 'Cerrar' : 'Cancelar'}
          </button>
          {(generation.kind === 'IDLE' || generation.kind === 'ERROR') && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={conteos.total === 0}
              data-testid="generate-button"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generar Reporte
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({
  titulo,
  valor,
  color,
}: {
  titulo: string;
  valor: number;
  color: 'slate' | 'green' | 'amber' | 'red';
}) {
  const colores: Record<typeof color, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`rounded-lg border p-4 ${colores[color]}`}>
      <div className="text-3xl font-bold leading-none" data-testid={`count-${titulo}`}>{valor}</div>
      <div className="text-xs mt-2 opacity-80">{titulo}</div>
    </div>
  );
}