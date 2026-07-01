// IMPL-20260630-03: Wrapper client-side que gestiona open/onClose para
// ProjectMassiveReportModal. El modal es un componente controlado (open/onClose
// requeridos). Aqui exponemos un boton trigger + el modal montado.
// ARCH-20260623-01: Modulo de Reportes Masivos.

'use client';

import { useState } from 'react';
import { ProjectMassiveReportModal } from './ProjectMassiveReportModal';

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
}

export function ProjectMassiveReportButton({ projectId, workers }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="open-massive-report"
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
      >
        Generar Reporte Masivo
      </button>
      <ProjectMassiveReportModal
        projectId={projectId}
        workers={workers}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
