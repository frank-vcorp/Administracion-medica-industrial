// IMPL-20260701-04: Tests para ProjectMassiveReportModal (Fase 4 EBOOK).
// IMPL-20260630-03: Tests originales.
// Usa solo vitest + lectura de source code (sin @testing-library/react).

import { describe, expect, it, vi as _vi } from 'vitest';
void _vi

import { calcularConteos } from '@/lib/reports/conteos';

describe('calcularConteos (frontend)', () => {
  it('cuenta 0/0/0/0 si no hay trabajadores', () => {
    const res = calcularConteos([]);
    expect(res.total).toBe(0);
    expect(res.completos).toBe(0);
    expect(res.parciales).toBe(0);
    expect(res.sinEstudios).toBe(0);
  });

  it('cuenta completos cuando todos los tests del evento estan COMPLETED', () => {
    const workers = [
      {
        id: 'w1',
        event: {
          eventTests: [
            { status: 'COMPLETED', resultNotes: null },
            { status: 'COMPLETED', resultNotes: null },
          ],
        },
      },
    ];
    const res = calcularConteos(workers);
    expect(res).toEqual({ total: 1, completos: 1, parciales: 0, sinEstudios: 0 });
  });

  it('cuenta parciales cuando hay tests en distintos estados', () => {
    const workers = [
      {
        id: 'w1',
        event: {
          eventTests: [
            { status: 'COMPLETED', resultNotes: null },
            { status: 'PENDING', resultNotes: null },
          ],
        },
      },
    ];
    const res = calcularConteos(workers);
    expect(res.total).toBe(1);
    expect(res.completos).toBe(0);
    expect(res.sinEstudios).toBe(0);
    expect(res.parciales).toBe(1);
  });

  it('cuenta sinEstudios cuando el evento es null o sin tests', () => {
    const workers = [
      { id: 'w1', event: null },
      { id: 'w2', event: { eventTests: [] } },
    ];
    const res = calcularConteos(workers);
    expect(res.sinEstudios).toBe(2);
  });

  it('RESULT_REGISTERED cuenta como completo', () => {
    const workers = [
      {
        id: 'w1',
        event: {
          eventTests: [
            { status: 'RESULT_REGISTERED', resultNotes: 'algo' },
          ],
        },
      },
    ];
    const res = calcularConteos(workers);
    expect(res.completos).toBe(1);
  });
});

describe('ProjectMassiveReportModal (smoke)', () => {
  it('importa sin errores', async () => {
    const mod = await import('@/components/projects/ProjectMassiveReportModal');
    expect(typeof mod.ProjectMassiveReportModal).toBe('function');
  });

  it('la fuente define los data-testids esperados', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = await fs.promises.readFile(
      path.join(__dirname, '..', 'ProjectMassiveReportModal.tsx'),
      'utf-8',
    );
    expect(src).toMatch(/data-testid="generate-button"/);
    expect(src).toMatch(/data-testid="format-XLSX"/);
    // IMPL-20260701-04: 'EBOOK' reemplaza a 'PDF'.
    expect(src).toMatch(/data-testid="format-EBOOK"/);
    expect(src).not.toMatch(/data-testid="format-PDF"/);
    expect(src).toMatch(/data-testid="format-BOTH"/);
    expect(src).toMatch(/data-testid="download-section"/);
  });

  it('la fuente usa el tipo ReportFormat con EBOOK (no PDF)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const typesSrc = await fs.promises.readFile(
      path.join(__dirname, '..', '..', '..', 'lib', 'reports', 'types.ts'),
      'utf-8',
    );
    expect(typesSrc).toMatch(/'XLSX'\s*\|\s*'EBOOK'\s*\|\s*'BOTH'/);
    expect(typesSrc).not.toMatch(/'XLSX'\s*\|\s*'PDF'/);
  });

  it('la fuente muestra nota de traduccion via browser (SPEC decision 15)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = await fs.promises.readFile(
      path.join(__dirname, '..', 'ProjectMassiveReportModal.tsx'),
      'utf-8',
    );
    expect(src).toMatch(/Chrome\/Edge/);
    expect(src).toMatch(/funcion de traduccion/i);
  });

  it('la fuente deshabilita el boton si total=0', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = await fs.promises.readFile(
      path.join(__dirname, '..', 'ProjectMassiveReportModal.tsx'),
      'utf-8',
    );
    expect(src).toMatch(/disabled=\{conteos\.total === 0\}/);
  });
});