// Banner persistente para todas las rutas /demo/*.
// Indica claramente que los datos mostrados son estáticos y no productivos.

import Link from 'next/link';

export function DemoBanner() {
  return (
    <div className="bg-amber-100 border-b-2 border-amber-500 text-amber-900 px-4 py-2 text-sm font-medium flex items-center justify-between">
      <span>
        <span aria-hidden="true">&#x1F9EA;</span>{' '}
        <strong>DEMO MODE</strong> &mdash; Datos est&aacute;ticos del{' '}
        <code className="bg-amber-200 px-1 rounded text-xs">
          CONCENTRADO GENERAL EJEMPLO.xlsx
        </code>
      </span>
      <Link
        href="/demo/reports"
        className="text-amber-900 underline hover:text-amber-700 text-xs"
      >
        Volver al listado demo
      </Link>
    </div>
  );
}
