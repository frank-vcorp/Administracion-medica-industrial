import { AntecedentesForm } from '@/components/clinical/AntecedentesForm'
import { getWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'

/**
 * IMPL-20260305-01
 * Ruta tokenizada para visualizar y editar historial clínico
 * Ejemplo: /history/[workerId]
 */

interface HistoryPageProps {
  params: Promise<{
    workerId: string
  }>
}

export async function generateMetadata(props: HistoryPageProps) {
  const params = await props.params
  const worker = await prisma.worker.findUnique({
    where: { id: params.workerId }
  })

  return {
    title: worker
      ? `Historia Clínica - ${worker.firstName} ${worker.lastName}`
      : 'Historia Clínica - No encontrado'
  }
}

export default async function HistoryPage(props: HistoryPageProps) {
  const params = await props.params
  // Validar que el trabajador existe
  const worker = await prisma.worker.findUnique({
    where: { id: params.workerId },
    select: { id: true, firstName: true, lastName: true, universalId: true }
  })

  if (!worker) {
    notFound()
  }

  // Obtener historial clínico existente
  const historyResult = await getWorkerClinicalHistory(params.workerId)

  if (!historyResult.success) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full border-l-4 border-red-500">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error al cargar historial</h2>
          <p className="text-gray-700 mb-4">{historyResult.error || 'Ocurrió un error inesperado al consultar los datos.'}</p>
          <Link href="/workers" className="text-blue-600 hover:underline">
            ← Volver a lista de trabajadores
          </Link>
        </div>
      </div>
    )
  }

  const initialData = historyResult.data?.data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <nav className="flex items-center space-x-2 text-sm">
            <Link href="/workers" className="text-blue-600 hover:text-blue-700">
              Trabajadores
            </Link>
            <span className="text-gray-400">/</span>
            <Link
              href={`/workers/${worker.id}`}
              className="text-blue-600 hover:text-blue-700"
            >
              {worker.firstName} {worker.lastName}
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-700">Historia Clínica</span>
          </nav>
        </div>
      </div>

      {/* Form Container */}
      <div className="py-8 px-4">
        <AntecedentesForm
          workerId={worker.id}
          workerName={`${worker.firstName} ${worker.lastName}`}
          initialData={initialData}
        />
      </div>

      {/* Debug Info (Safe Mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-4xl mx-auto mt-8 border-t border-dashed pt-4 mb-8 text-center text-xs text-gray-400">
          <p>Worker: {worker.id.slice(-6)} | History: {initialData ? 'Loaded' : 'New'}</p>
        </div>
      )}
    </div>
  )
}
