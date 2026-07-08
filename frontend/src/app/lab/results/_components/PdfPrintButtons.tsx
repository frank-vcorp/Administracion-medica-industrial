/**
 * @file Botones para imprimir los 3 PDFs de Fase 3 (F Reportes).
 * @id IMPL-20260708-19
 *
 * Imprimir etiquetas / resultados / recibo. Cada botón abre el PDF en
 * nueva pestaña para que el usuario pueda imprimirlo directamente.
 */
"use client";

import { openEtiquetasPdf, openResultadosPdf, openReciboPdf } from "@/actions/lab-report.actions";

interface Props {
  orderId: string;
  /** Si true, oculta el botón de recibo (ej. cuando es cortesía) */
  hideRecibo?: boolean;
}

export function PdfPrintButtons({ orderId, hideRecibo = false }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => openEtiquetasPdf(orderId)}
        className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
        title="Abre el PDF de etiquetas para impresión"
      >
        🖨️ Imprimir Etiquetas
      </button>
      <button
        type="button"
        onClick={() => openResultadosPdf(orderId)}
        className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
        title="Abre el PDF de resultados del paciente"
      >
        🖨️ Imprimir Resultados
      </button>
      {!hideRecibo && (
        <button
          type="button"
          onClick={() => openReciboPdf(orderId)}
          className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
          title="Abre el PDF de recibo de pago"
        >
          🖨️ Imprimir Recibo
        </button>
      )}
    </div>
  );
}