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
  const initialData = historyResult.success ? historyResult.data?.data : null

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
          onSuccess={() => {
            // Aquí se puede mostrar un toast o mensaje de éxito
            console.log('Historia clínica guardada exitosamente')
          }}
        />
      </div>

      {/* Debug Info (Solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-4xl mx-auto px-6 py-8 bg-gray-100 rounded-lg mt-8 mb-8">
          <h3 className="text-sm font-bold text-gray-700 mb-4">DEBUG INFO</h3>
          <div className="bg-white p-4 rounded text-xs text-gray-600 font-mono overflow-auto">
            <p>Worker ID: {worker.id}</p>
            <p>Universal ID: {worker.universalId}</p>
            <pre className="mt-4 whitespace-pre-wrap break-words">
              {initialData ? JSON.stringify(initialData, null, 2) : 'Sin datos previos'}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
