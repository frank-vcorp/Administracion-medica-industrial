/**
 * @file Helpers cliente para descargar/abrir PDFs de Fase 3 (F Reportes).
 * @id IMPL-20260708-19
 *
 * Construye las URLs hacia el backend FastAPI que sirve los 3 PDFs
 * imprimibles (etiquetas, resultados, recibos). Se abren en nueva pestaña.
 *
 * IMPORTANTE: el backend FastAPI vive en otra URL que el frontend Next.js.
 * Se usa NEXT_PUBLIC_BACKEND_URL cuando está disponible; si no, se usa
 * window.location.origin (útil en desarrollo donde el proxy puede rutear).
 */

const BACKEND_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) ||
  (typeof window !== "undefined" ? window.location.origin : "");

/**
 * Abre el PDF de etiquetas en nueva pestaña.
 */
export function openEtiquetasPdf(orderId: string): void {
  if (typeof window === "undefined") return;
  const url = `${BACKEND_URL}/api/v1/lab/reports/etiquetas/${encodeURIComponent(orderId)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Abre el PDF de resultados en nueva pestaña.
 */
export function openResultadosPdf(orderId: string): void {
  if (typeof window === "undefined") return;
  const url = `${BACKEND_URL}/api/v1/lab/reports/resultados/${encodeURIComponent(orderId)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Abre el PDF de recibo en nueva pestaña.
 */
export function openReciboPdf(orderId: string): void {
  if (typeof window === "undefined") return;
  const url = `${BACKEND_URL}/api/v1/lab/reports/recibos/${encodeURIComponent(orderId)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Construye la URL pública al PDF (para usar en <a href>).
 */
export function buildPdfUrl(kind: "etiquetas" | "resultados" | "recibos", orderId: string): string {
  return `${BACKEND_URL}/api/v1/lab/reports/${kind}/${encodeURIComponent(orderId)}`;
}