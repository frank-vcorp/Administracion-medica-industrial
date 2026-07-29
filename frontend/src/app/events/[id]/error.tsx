'use client'

/**
 * Error boundary para /events/[id]
 * SPEC FIX-20260729-01-BASELINE: captura excepciones lanzadas durante render
 * de EventPage (errores Prisma / serialización) y muestra UI de respaldo
 * con reset() para que el usuario pueda reintentar la carga.
 */
import { useEffect } from 'react'
import Link from 'next/link'

export default function EventErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[events/[id]] ErrorBoundary capturó:', error)
  }, [error])

  return (
    <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center max-w-2xl mx-auto mt-10">
      <h2 className="text-xl font-bold text-red-700 mb-2">Error al cargar el expediente</h2>
      <p className="text-red-500 text-sm">
        Hubo un problema de conexión con el servidor de base de datos o de serialización de datos.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-red-400 font-mono">digest: {error.digest}</p>
      ) : null}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
        >
          Reintentar
        </button>
        {/* IMPL-20260630-01: mantener consistencia con el rename "Piso Clínico" → "Proceso de atención clínica" */}
        <Link
          href="/reception"
          className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-bold"
        >
          Volver al Proceso de atención clínica
        </Link>
      </div>
    </div>
  )
}
