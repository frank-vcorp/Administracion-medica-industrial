// Generador de XLSX para el demo de reportes masivos UMM.
// Usa la librería `xlsx` (SheetJS) ya incluida en el package.json.
// Produce un workbook con 3 hojas: CONCENTRADO, LABORATORIOS, GRAFICAS.

import * as XLSX from 'xlsx';

import type { DemoProject, DemoWorker } from './demo-types';
import {
  calcularEscoliosisDistribucion,
  calcularEspirometriaDistribucion,
  calcularHbcPorRango,
  calcularQs6Niveles,
  calcularTraumaAcusticoPorArea,
} from './demo-conteos';

const HEADER_FILL = { fgColor: { rgb: 'FFD9E1F2' } };
const HEADER_FONT = { bold: true };

function filaConcentrado(w: DemoWorker): Record<string, unknown> {
  return {
    FOLIO: w.folio,
    NOMBRE: w.nombre,
    SEXO: w.sexo,
    'AREA/ PUESTO': w.area,
    ANTIGÜEDAD: w.antiguedad,
    'AGUDEZA VISUAL': w.campimetria.agudezaVisual,
    'CAMPOS VISUALES': w.campimetria.camposVisuales,
    'DISCRIMINACION DEL COLOR': w.campimetria.discriminacionColor,
    DX: w.audiometria.dx,
    'OIDO DERECHO': w.audiometria.oidoDerecho,
    'OIDO IZQUIERDO': w.audiometria.oidoIzquierdo,
    '% HBC': w.audiometria.hbc,
    ESPIROMETRIA: w.espirometria.patron,
    FVC: w.espirometria.fvc,
    TABAQUISMO: w.espirometria.tabaquismo,
    ELECTROCARDIOGRAMA: w.ecg.impresion,
    'VALORACION POSTURAL': w.rxColumna.valoracionPostural,
    'GRADO DE ESCOLIOSIS(°)': w.rxColumna.escoliosis,
    'GRADO DE LORDOSIS(°)': w.rxColumna.lordosis,
    'BASCULACIÓN PELVICA (cms)': w.rxColumna.basculacion,
    'IMPRESIÓN DIAGNOSTICA COLUMNA': w.rxColumna.impresion,
    'IMPRESIÓN DIAGNOSTICA TORAX': w.rxTorax.impresion,
  };
}

function filaLaboratorio(w: DemoWorker): Record<string, unknown> {
  return {
    Folio: w.folio,
    'Folio Lab': w.laboratorio.folioLab,
    Nombre: w.nombre,
    SEXO: w.sexo,
    Edad: w.laboratorio.edad,
    'BH Hb': w.laboratorio.bh.hb,
    'BH MCHb': w.laboratorio.bh.mchb,
    'BH CHGM': w.laboratorio.bh.chgm,
    'BH LEU': w.laboratorio.bh.leu,
    'BH PLA': w.laboratorio.bh.pla,
    GLUC: w.laboratorio.qs6.gluc,
    BUN: w.laboratorio.qs6.bun,
    UREA: w.laboratorio.qs6.urea,
    CREAT: w.laboratorio.qs6.creat,
    AU: w.laboratorio.qs6.au,
    COL: w.laboratorio.qs6.col,
    TRIG: w.laboratorio.qs6.trig,
    'EGO-GLC': w.laboratorio.ego.glc,
    'EGO-PROT': w.laboratorio.ego.prot,
    'EGO-BLO': w.laboratorio.ego.blo,
    'EGO BAC': w.laboratorio.ego.bac,
    'CRISTALES EGO': w.laboratorio.ego.cristales,
    ANFETA: w.laboratorio.toxico.anfeta,
    COCA: w.laboratorio.toxico.coca,
    MARIHUA: w.laboratorio.toxico.marihua,
    OPIAC: w.laboratorio.toxico.opiac,
    METANF: w.laboratorio.toxico.metanf,
  };
}

function filasGraficas(project: DemoProject): Record<string, unknown>[] {
  const trauma = calcularTraumaAcusticoPorArea(project);
  const hbc = calcularHbcPorRango(project);
  const espiro = calcularEspirometriaDistribucion(project);
  const escolio = calcularEscoliosisDistribucion(project);
  const qs6 = calcularQs6Niveles(project);

  const out: Record<string, unknown>[] = [];

  out.push({ SECCION: 'TRAUMA ACUSTICO POR AREA' });
  out.push({ SECCION: 'AREA', CONTEOS: 'TRABAJADORES' });
  for (const t of trauma) {
    out.push({ SECCION: t.area, CONTEOS: t.conteo });
  }

  out.push({});
  out.push({ SECCION: 'AUDIOMETRIAS (% HBC)' });
  out.push({ SECCION: 'RANGO', CONTEOS: 'TRABAJADORES' });
  out.push({ SECCION: 'Normal (<10%)', CONTEOS: hbc.normal });
  out.push({ SECCION: 'Alto (10-19%)', CONTEOS: hbc.alto });
  out.push({ SECCION: 'Muy Alto (>=20%)', CONTEOS: hbc.muyAlto });

  out.push({});
  out.push({ SECCION: 'ESPIROMETRIAS (PATRON)' });
  out.push({ SECCION: 'PATRON', CONTEOS: 'TRABAJADORES' });
  for (const e of espiro) {
    out.push({ SECCION: e.patron, CONTEOS: e.conteo });
  }

  out.push({});
  out.push({ SECCION: 'COLUMNA (ESCOLIOSIS - COBB)' });
  out.push({ SECCION: 'GRADO', CONTEOS: 'TRABAJADORES' });
  out.push({ SECCION: 'NORMAL (<5°)', CONTEOS: escolio.normal });
  out.push({ SECCION: 'LEVE (5-9°)', CONTEOS: escolio.leve });
  out.push({ SECCION: 'MODERADA (10-19°)', CONTEOS: escolio.moderada });
  out.push({ SECCION: 'GRAVE (>=20°)', CONTEOS: escolio.grave });

  out.push({});
  out.push({ SECCION: 'QS6 - GLUCOSA' });
  out.push({ SECCION: 'RANGO', CONTEOS: 'TRABAJADORES' });
  out.push({ SECCION: 'Normal (<100 mg/dL)', CONTEOS: qs6.glucosa.normal });
  out.push({ SECCION: 'Alta (>=100 mg/dL)', CONTEOS: qs6.glucosa.alta });

  out.push({});
  out.push({ SECCION: 'QS6 - COLESTEROL' });
  out.push({ SECCION: 'RANGO', CONTEOS: 'TRABAJADORES' });
  out.push({ SECCION: 'Normal (<200 mg/dL)', CONTEOS: qs6.colesterol.normal });
  out.push({ SECCION: 'Limite (200-239 mg/dL)', CONTEOS: qs6.colesterol.limite });
  out.push({ SECCION: 'Alto (>=240 mg/dL)', CONTEOS: qs6.colesterol.alto });

  out.push({});
  out.push({ SECCION: 'QS6 - TRIGLICERIDOS' });
  out.push({ SECCION: 'RANGO', CONTEOS: 'TRABAJADORES' });
  out.push({ SECCION: 'Normal (<150 mg/dL)', CONTEOS: qs6.trigliceridos.normal });
  out.push({ SECCION: 'Limite (150-199 mg/dL)', CONTEOS: qs6.trigliceridos.limite });
  out.push({ SECCION: 'Alto (>=200 mg/dL)', CONTEOS: qs6.trigliceridos.alto });

  return out;
}

/**
 * Construye el workbook XLSX para el proyecto demo y devuelve un ArrayBuffer
 * apto para `pdf(<buffer>)` o para descarga directa en el navegador.
 */
export function generarXlsx(project: DemoProject): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // Hoja CONCENTRADO
  const concentradoData = project.trabajadores.map(filaConcentrado);
  const wsConcentrado = XLSX.utils.json_to_sheet(concentradoData);
  // Aplicar estilo de cabecera (negrita + fondo) recorriendo el rango A1.
  const rangoConcentrado = XLSX.utils.decode_range(wsConcentrado['!ref'] ?? 'A1');
  for (let c = rangoConcentrado.s.c; c <= rangoConcentrado.e.c; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = wsConcentrado[addr];
    if (cell) {
      cell.s = { fill: HEADER_FILL, font: HEADER_FONT };
    }
  }
  XLSX.utils.book_append_sheet(wb, wsConcentrado, 'CONCENTRADO');

  // Hoja LABORATORIOS
  const laboratorioData = project.trabajadores.map(filaLaboratorio);
  const wsLaboratorio = XLSX.utils.json_to_sheet(laboratorioData);
  const rangoLab = XLSX.utils.decode_range(wsLaboratorio['!ref'] ?? 'A1');
  for (let c = rangoLab.s.c; c <= rangoLab.e.c; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = wsLaboratorio[addr];
    if (cell) {
      cell.s = { fill: HEADER_FILL, font: HEADER_FONT };
    }
  }
  XLSX.utils.book_append_sheet(wb, wsLaboratorio, 'LABORATORIOS');

  // Hoja GRAFICAS (agregados)
  const graficasData = filasGraficas(project);
  const wsGraficas = XLSX.utils.json_to_sheet(graficasData);
  XLSX.utils.book_append_sheet(wb, wsGraficas, 'GRAFICAS');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  // XLSX.write con type:'array' devuelve un ArrayBuffer en runtime de navegador.
  return out as ArrayBuffer;
}

/**
 * Convierte el ArrayBuffer producido por `generarXlsx` en un data URI
 * apto para `<a href download>`.
 */
export function xlsxArrayBufferToDataUri(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Convertir a base64 sin usar Buffer (compatibilidad navegador).
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  const base64 = btoa(binary);
  return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
}
