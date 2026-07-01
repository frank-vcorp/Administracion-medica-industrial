// IMPL-20260701-04: Tipos reusables del modulo de reportes masivos (Fase 4 EBOOK).
// IMPL-20260630-03: Tipos originales.

// IMPL-20260701-04: 'EBOOK' reemplaza a 'PDF'.
//   - 'XLSX'  -> concentrado tabular + graficas (sin cambios).
//   - 'EBOOK' -> PDF navegable: portada, TOC, bookmarks, estadisticas con
//                mini-graficas matplotlib, secciones por trabajador con
//                imagenes embebidas (reemplaza la carpeta fisica por proyecto).
//   - 'BOTH'  -> XLSX + EBOOK en la misma corrida.
//   - 'PDF'   -> DEPRECATED. El backend ya no lo acepta; se conserva el tipo
//                solo por compatibilidad con historial previo.
export type ReportFormat = 'XLSX' | 'EBOOK' | 'BOTH';
export type ReportStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface ProjectReportConteos {
  total: number;
  completos: number;
  parciales: number;
  sinEstudios: number;
}

export interface ProjectReportResponse {
  id: string;
  projectId: string;
  format: ReportFormat;
  status: ReportStatus;
  fileUrlXlsx: string | null;
  fileUrlPdf: string | null;
  errorMessage: string | null;
  generatedById: string;
  generatedAt: string;
  completedAt: string | null;
}