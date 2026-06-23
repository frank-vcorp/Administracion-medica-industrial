'use client';

// Wrapper cliente para el botón "Reporte Masivo" + modal.
// Vive en /demo/reports/[id]/page.tsx (server) y se monta como client island.

import { useState } from 'react';

import { DemoMassiveReportModal } from '@/components/demo/DemoMassiveReportModal';
import type { DemoProject } from '@/lib/demo/demo-types';

interface Props {
  project: DemoProject;
}

export function DemoReportLauncher({ project }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 shadow-sm"
      >
        <span aria-hidden="true">&#x1F4CA;</span>
        Reporte Masivo
      </button>

      <DemoMassiveReportModal
        project={project}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
