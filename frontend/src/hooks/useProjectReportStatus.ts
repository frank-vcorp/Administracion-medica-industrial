// IMPL-20260630-03: Hook de polling para estado de ProjectReport.
// ARCH-20260623-01: Modulo de Reportes Masivos.

'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReportStatus } from '@/lib/reports/types';

interface ReportState {
  status: ReportStatus;
  xlsxUrl: string | null;
  pdfUrl: string | null;
  error: string | null;
  isPolling: boolean;
}

interface PollResult {
  status: ReportStatus;
  fileUrlXlsx: string | null;
  fileUrlPdf: string | null;
  errorMessage: string | null;
}

const POLL_INTERVAL_MS = 2000;

async function fetchStatus(
  projectId: string,
  reportId: string,
): Promise<PollResult> {
  const res = await fetch(
    `/api/v2/projects/${projectId}/reports/${reportId}`,
    { method: 'GET', cache: 'no-store' },
  );
  if (!res.ok) {
    throw new Error(`Error consultando estado (HTTP ${res.status})`);
  }
  const data = await res.json();
  return {
    status: data.status,
    fileUrlXlsx: data.fileUrlXlsx ?? null,
    fileUrlPdf: data.fileUrlPdf ?? null,
    errorMessage: data.errorMessage ?? null,
  };
}

/**
 * Hook que consulta el estado de un ProjectReport cada 2 segundos.
 * Cleanup garantizado: al desmontar o cambiar reportId, se cancela el interval.
 */
export function useProjectReportStatus(
  projectId: string,
  reportId: string | null,
): ReportState {
  const [state, setState] = useState<ReportState>({
    status: 'PENDING',
    xlsxUrl: null,
    pdfUrl: null,
    error: null,
    isPolling: false,
  });

  // Mantener referencia al interval para limpiarlo de forma confiable.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!projectId || !reportId) {
      setState({
        status: 'PENDING',
        xlsxUrl: null,
        pdfUrl: null,
        error: null,
        isPolling: false,
      });
      return;
    }

    let cancelled = false;

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const tick = async () => {
      try {
        const data = await fetchStatus(projectId, reportId);
        if (cancelled) return;

        const next: ReportState = {
          status: data.status as ReportStatus,
          xlsxUrl: data.fileUrlXlsx,
          pdfUrl: data.fileUrlPdf,
          error: data.errorMessage,
          isPolling: data.status !== 'READY' && data.status !== 'FAILED',
        };
        setState(next);

        if (data.status === 'READY' || data.status === 'FAILED') {
          stop();
        }
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          status: 'FAILED',
          error: err instanceof Error ? err.message : 'Error desconocido',
          isPolling: false,
        }));
        stop();
      }
    };

    setState((prev) => ({ ...prev, status: 'PROCESSING', isPolling: true, error: null }));
    void tick();
    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stop();
    };
  }, [projectId, reportId]);

  return state;
}