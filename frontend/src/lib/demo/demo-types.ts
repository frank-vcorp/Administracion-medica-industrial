// Tipos del DEMO de Reportes Masivos UMM
// Aislados de tipos productivos. Solo se usan dentro de frontend/src/app/demo y lib/demo.

export type Sexo = 'MASCULINO' | 'FEMENINO';

export type EstudioCompletitud = 'COMPLETO' | 'PARCIAL' | 'SIN_ESTUDIOS';

/** Resumen de audiometría por trabajador. */
export interface DemoAudiometria {
  dx: string;            // Diagnóstico bilateral resumido (p.ej. "NORMAL", "FATIGA AUDITIVA", "LEVE TA")
  oidoDerecho: string;
  oidoIzquierdo: string;
  hbc: number | null;    // % HBC (puede ser null cuando no aplica)
}

/** Resumen de espirometría por trabajador. */
export interface DemoEspirometria {
  patron: string;        // "NORMAL", "PATRÓN RESTRICTIVO LEVE", "N/A", etc.
  fvc: number | string | null;
  tabaquismo: string;    // "POSITIVO" | "NEGADO" | "N/A"
}

/** Resumen RX Columna. */
export interface DemoRxColumna {
  escoliosis: number | null;       // grados Cobb
  lordosis: number | null;         // grados Ferguson
  basculacion: number | null;      // cm
  valoracionPostural: string;
  impresion: string;
}

/** Resumen RX Tórax. */
export interface DemoRxTorax {
  impresion: string;
}

/** Resumen ECG. */
export interface DemoEcg {
  impresion: string;
}

/** Resumen Campimetría. */
export interface DemoCampimetria {
  agudezaVisual: string;
  camposVisuales: string;
  discriminacionColor: string;
}

/** Laboratorios por trabajador. */
export interface DemoLaboratorio {
  folioLab: string;      // Folio de la hoja LABORATORIOS (diferente al folio clínico)
  edad: string;          // "28 A", etc.
  bh: {
    hb: number | null;
    mchb: number | null;
    chgm: number | null;
    leu: number | null;
    pla: number | null;
  };
  qs6: {
    gluc: number | null;
    bun: number | null;
    urea: number | null;
    creat: number | null;
    au: number | null;
    col: number | null;
    trig: number | null;
  };
  ego: {
    glc: number | string | null;
    prot: number | string | null;
    blo: number | string | null;
    bac: string;
    cristales: string;
  };
  toxico: {
    anfeta: string;
    coca: string;
    marihua: string;
    opiac: string;
    metanf: string;
  };
}

/** Trabajador demo (1 fila del concentrado). */
export interface DemoWorker {
  folio: string;             // Folio clínico del concentrado
  nombre: string;
  sexo: Sexo;
  area: string;              // Área o puesto
  antiguedad: string;
  campimetria: DemoCampimetria;
  audiometria: DemoAudiometria;
  espirometria: DemoEspirometria;
  rxColumna: DemoRxColumna;
  rxTorax: DemoRxTorax;
  ecg: DemoEcg;
  laboratorio: DemoLaboratorio;
}

/** Proyecto demo (1 empresa / proyecto). */
export interface DemoProject {
  id: string;                // Identificador para la URL /demo/reports/[id]
  empresa: string;           // Nombre de la empresa simulada
  empresaLegal: string;      // Razón social
  fecha: string;             // ISO date
  trabajadores: DemoWorker[];
}

/** Conteos calculados para la pantalla de preview. */
export interface DemoConteos {
  total: number;
  completos: number;         // Todos los estudios con datos (no N/A)
  parciales: number;         // Algunos estudios, no todos
  sinEstudios: number;       // Sin estudios (no aplica en este demo, pero se mantiene la firma)
}

/** Formato de exportación seleccionado por el usuario. */
export type DemoFormatoReporte = 'XLSX' | 'PDF' | 'AMBOS';

/** Resultado de generación devuelto al cliente para descarga. */
export interface DemoReporteGenerado {
  xlsx?: { nombre: string; dataUri: string };
  pdf?: { nombre: string; dataUri: string };
}
