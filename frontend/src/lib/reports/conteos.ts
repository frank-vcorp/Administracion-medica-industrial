// IMPL-20260630-03: Conteos reusables para ProjectMassiveReportModal.
// Migrado de frontend/src/lib/demo/demo-conteos.ts al shape real de Prisma.

import type { ProjectReportConteos } from './types';

interface WorkerLike {
  id?: string;
  event?: {
    eventTests?: Array<{
      status: string;
      testNameSnapshot?: string | null;
      resultNotes?: string | null;
      extractedData?: unknown;
    }> | null;
  } | null;
}

function _hasExtracted(et: { extractedData?: unknown } | undefined): boolean {
  void et
  if (!et) return false;
  const ed = et.extractedData;
  if (!ed || typeof ed !== 'object') return false;
  // Cualquier valor no-null dentro de extractedData cuenta como "con datos".
  const obj = ed as Record<string, unknown>;
  return Object.values(obj).some((v) => v !== null && v !== undefined && v !== '');
}

function _testIsComplete(et: { status: string; resultNotes?: string | null }): boolean {
  if (et.status === 'COMPLETED' || et.status === 'RESULT_REGISTERED') return true;
  if (et.resultNotes && et.resultNotes.trim().length > 0) return true;
  return false;
}

/**
 * Calcula conteos para el preview del modal.
 * total = cantidad de ProjectWorker
 * completos = todos los EventTest del evento asociados en estado COMPLETED/RESULT_REGISTERED
 * parciales = algunos con datos, otros no
 * sinEstudios = ningun EventTest del evento
 */
export function calcularConteos(workers: WorkerLike[]): ProjectReportConteos {
  const total = workers.length;
  let completos = 0;
  let sinEstudios = 0;

  for (const w of workers) {
    const tests = w.event?.eventTests ?? [];
    if (tests.length === 0) {
      sinEstudios += 1;
      continue;
    }
    const totalOk = tests.filter(_testIsComplete).length;
    if (totalOk === tests.length) {
      completos += 1;
    }
  }

  return {
    total,
    completos,
    parciales: total - completos - sinEstudios,
    sinEstudios,
  };
}