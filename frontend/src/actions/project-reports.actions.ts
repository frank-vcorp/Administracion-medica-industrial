// IMPL-20260630-03: Server Actions para ProjectReport (reportes masivos por proyecto).
// ARCH-20260623-01: Modulo de Reportes Masivos.

'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import type {
  ProjectReportResponse,
  ReportFormat,
} from '@/lib/reports/types';

const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function _requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

/**
 * POST /api/v2/projects/{projectId}/reports/massive?format=XLSX|PDF|BOTH&generatedById=...
 */
export async function createMassiveReportAction(
  projectId: string,
  format: ReportFormat,
): Promise<ActionResult<ProjectReportResponse>> {
  try {
    const userId = await _requireUserId();
    if (!userId) {
      return { success: false, error: 'No autorizado: sesión inválida' };
    }
    const url = new URL(
      `/api/v2/projects/${projectId}/reports/massive`,
      BACKEND_URL,
    );
    url.searchParams.set('format', format);
    url.searchParams.set('generatedById', userId);

    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { success: false, error: `Backend ${res.status}: ${detail || res.statusText}` };
    }
    const data: ProjectReportResponse = await res.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    };
  }
}

/**
 * GET /api/v2/projects/{projectId}/reports/{reportId}
 */
export async function getReportStatusAction(
  projectId: string,
  reportId: string,
): Promise<ActionResult<ProjectReportResponse>> {
  try {
    const url = new URL(
      `/api/v2/projects/${projectId}/reports/${reportId}`,
      BACKEND_URL,
    );
    const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      return { success: false, error: `Backend ${res.status}: ${res.statusText}` };
    }
    const data: ProjectReportResponse = await res.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    };
  }
}

/**
 * GET /api/v2/projects/{projectId}/reports
 */
export async function getProjectReportsHistoryAction(
  projectId: string,
): Promise<ActionResult<ProjectReportResponse[]>> {
  try {
    const url = new URL(
      `/api/v2/projects/${projectId}/reports`,
      BACKEND_URL,
    );
    const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      return { success: false, error: `Backend ${res.status}: ${res.statusText}` };
    }
    const data: ProjectReportResponse[] = await res.json();
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    };
  }
}