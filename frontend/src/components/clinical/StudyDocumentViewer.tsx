/**
 * @fileoverview Visor embebido de archivo documental (PDF o imagen)
 * sin dependencias externas — usa iframe/img nativos del navegador.
 * @id IMPL-20260327-01
 * @spec ARCH-20260327-01
 * @backup context/checkpoints/CHK_IMPL-20260327-01-WORKSPACE-IA-DOBLE-COLUMNA.md
 * @intervention ARCH-20260327-03
 * @see context/checkpoints/CHK_ARCH-20260327-03-PDF-SIN-MINIATURA.md
 */

interface StudyDocumentViewerProps {
  /** URL completa ya compuesta (apiUrl + test.fileUrl) */
  fileUrl: string
  /** Nombre legible del archivo */
  fileName: string
}

function isPdf(url: string) {
  return /\.pdf(\?.*)?$/i.test(url)
}

function isImage(url: string) {
  return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url)
}

export default function StudyDocumentViewer({ fileUrl, fileName }: StudyDocumentViewerProps) {
  const isPdfFile = isPdf(fileUrl)
  const isImageFile = !isPdfFile && isImage(fileUrl)

  return (
    <div className="flex flex-col gap-2">
      {/* Barra superior: nombre + enlace externo */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{isPdfFile ? '📄' : isImageFile ? '🖼️' : '📎'}</span>
          <p className="text-xs font-mono text-slate-700 truncate" title={fileName}>{fileName}</p>
        </div>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0"
        >
          ↗ Abrir en nueva pestaña
        </a>
      </div>

      {/* ARCH-20260327-03: PDFs sin miniatura embebida para ahorrar altura. */}
      {isPdfFile && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <p className="text-sm text-slate-600 font-medium">PDF vinculado</p>
          <p className="text-xs text-slate-400 mt-1">Se abre en pestaña nueva para revisión completa.</p>
        </div>
      )}

      {/* Visor imagen */}
      {isImageFile && (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt={fileName}
            className="w-full max-h-[460px] object-contain rounded-xl border border-slate-200 bg-slate-100"
          />
        </a>
      )}

      {/* Fallback para tipos no previsibles */}
      {!isPdfFile && !isImageFile && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-500 mb-3">
            El navegador no puede previsualizar este tipo de archivo.
          </p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-teal-700 transition-colors"
          >
            Abrir archivo
          </a>
        </div>
      )}
    </div>
  )
}
