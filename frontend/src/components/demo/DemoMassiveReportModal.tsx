'use client';

// Modal de preview + generación para el demo de reportes masivos UMM.
// Solo se ejecuta en cliente. Usa xlsx + @react-pdf/renderer para generar
// los archivos y devolver data URIs para descarga directa.

import { useMemo, useState } from 'react';

import { calcularConteos } from '@/lib/demo/demo-conteos';
import type {
  DemoFormatoReporte,
  DemoProject,
  DemoReporteGenerado,
} from '@/lib/demo/demo-types';
import {
  generarPdf,
  pdfArrayBufferToDataUri,
} from '@/lib/demo/pdf-generator';
import {
  generarXlsx,
  xlsxArrayBufferToDataUri,
} from '@/lib/demo/xlsx-generator';

interface Props {
  project: DemoProject;
  open: boolean;
  onClose: () => void;
}

type GeneracionEstado = 'IDLE' | 'GENERANDO_XLSX' | 'GENERANDO_PDF' | 'LISTO' | 'ERROR';

function sanitizarNombreArchivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

export function DemoMassiveReportModal({ project, open, onClose }: Props) {
  const conteos = useMemo(() => calcularConteos(project), [project]);
  const [formato, setFormato] = useState<DemoFormatoReporte>('AMBOS');
  const [estado, setEstado] = useState<GeneracionEstado>('IDLE');
  const [resultado, setResultado] = useState<DemoReporteGenerado | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const empresaSlug = sanitizarNombreArchivo(project.empresa) || 'DEMO';
  const fechaSlug = project.fecha.replace(/-/g, '');

  const manejarGenerar = async () => {
    setError(null);
    setResultado(null);
    const generated: DemoReporteGenerado = {};

    try {
      if (formato === 'XLSX' || formato === 'AMBOS') {
        setEstado('GENERANDO_XLSX');
        const buffer = generarXlsx(project);
        const nombre = `REPORTE_${empresaSlug}_${fechaSlug}.xlsx`;
        generated.xlsx = { nombre, dataUri: xlsxArrayBufferToDataUri(buffer) };
      }
      if (formato === 'PDF' || formato === 'AMBOS') {
        setEstado('GENERANDO_PDF');
        const buffer = await generarPdf(project);
        const nombre = `DIAGNOSTICO_${empresaSlug}_${fechaSlug}.pdf`;
        generated.pdf = { nombre, dataUri: pdfArrayBufferToDataUri(buffer) };
      }
      setResultado(generated);
      setEstado('LISTO');
    } catch (e) {
      console.error('[DEMO] Error generando reporte:', e);
      setError(e instanceof Error ? e.message : 'Error desconocido');
      setEstado('ERROR');
    }
  };

  const cerrar = () => {
    setEstado('IDLE');
    setResultado(null);
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="demo-modal-title" className="text-lg font-semibold text-slate-900">
            Reporte Masivo &mdash; {project.empresa}
          </h2>
          <button
            type="button"
            onClick={cerrar}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Cerrar modal"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* SECCIÓN 1: Contadores */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Resumen del estudio
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ContadorCard
                titulo="trabajadores en total"
                valor={conteos.total}
                color="slate"
              />
              <ContadorCard
                titulo="con todos los estudios"
                valor={conteos.completos}
                color="green"
              />
              <ContadorCard
                titulo="con estudios parciales"
                valor={conteos.parciales}
                color="amber"
              />
              <ContadorCard
                titulo="sin estudios"
                valor={conteos.sinEstudios}
                color="red"
              />
            </div>
          </section>

          {/* SECCIÓN 2: Formato */}
          {estado === 'IDLE' || estado === 'ERROR' ? (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Formato de salida
              </h3>
              <div className="flex flex-col gap-2">
                <FormatoRadio
                  value="XLSX"
                  current={formato}
                  onChange={setFormato}
                  label="XLSX"
                  descripcion="3 hojas: CONCENTRADO, LABORATORIOS, GRAFICAS"
                />
                <FormatoRadio
                  value="PDF"
                  current={formato}
                  onChange={setFormato}
                  label="PDF"
                  descripcion="Portada + concentrado tabular"
                />
                <FormatoRadio
                  value="AMBOS"
                  current={formato}
                  onChange={setFormato}
                  label="Ambos"
                  descripcion="Genera XLSX y PDF en la misma corrida"
                />
              </div>
            </section>
          ) : null}

          {/* SECCIÓN 3: Progreso */}
          {estado === 'GENERANDO_XLSX' || estado === 'GENERANDO_PDF' ? (
            <section className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="text-sm text-blue-900">
                {estado === 'GENERANDO_XLSX'
                  ? 'Generando XLSX...'
                  : 'Generando PDF...'}
              </span>
            </section>
          ) : null}

          {estado === 'LISTO' && resultado ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Archivos generados
              </h3>
              <div className="flex flex-col gap-2">
                {resultado.xlsx ? (
                  <a
                    href={resultado.xlsx.dataUri}
                    download={resultado.xlsx.nombre}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm w-fit"
                  >
                    <span aria-hidden="true">&#x2B07;</span>
                    Descargar {resultado.xlsx.nombre}
                  </a>
                ) : null}
                {resultado.pdf ? (
                  <a
                    href={resultado.pdf.dataUri}
                    download={resultado.pdf.nombre}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm w-fit"
                  >
                    <span aria-hidden="true">&#x2B07;</span>
                    Descargar {resultado.pdf.nombre}
                  </a>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                Los archivos se generaron 100% en el navegador a partir de los datos
                est&aacute;ticos del demo.
              </p>
            </section>
          ) : null}

          {estado === 'ERROR' && error ? (
            <section className="p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-900">
                <strong>Error:</strong> {error}
              </p>
            </section>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={cerrar}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded"
          >
            {estado === 'LISTO' ? 'Cerrar' : 'Cancelar'}
          </button>
          {estado !== 'LISTO' && estado !== 'GENERANDO_XLSX' && estado !== 'GENERANDO_PDF' ? (
            <button
              type="button"
              onClick={manejarGenerar}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Generar Reporte
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContadorCard({
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
      <div className="text-3xl font-bold leading-none">{valor}</div>
      <div className="text-xs mt-2 opacity-80">{titulo}</div>
    </div>
  );
}

function FormatoRadio({
  value,
  current,
  onChange,
  label,
  descripcion,
}: {
  value: DemoFormatoReporte;
  current: DemoFormatoReporte;
  onChange: (v: DemoFormatoReporte) => void;
  label: string;
  descripcion: string;
}) {
  const checked = value === current;
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded border cursor-pointer ${
        checked ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <input
        type="radio"
        name="demo-formato"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1"
      />
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{descripcion}</div>
      </div>
    </label>
  );
}
