// IMPL-20260630-03: Tipos reusables del modulo de reportes masivos.

export type ReportFormat = 'XLSX' | 'PDF' | 'BOTH';
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