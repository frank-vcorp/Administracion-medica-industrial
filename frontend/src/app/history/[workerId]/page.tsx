/**
 * IMPL-20260325-08: Historia Declarativa Base — modelo dual longitudinal
 * Muestra la base longitudinal declarativa (prefill_base) capturada desde el portal.
 * @see SPEC ARCH-20260325-07
 */
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

  // IMPL-20260325-08: Extraer base longitudinal declarativa (capturada desde portal del trabajador)
  type PrefillSection = Record<string, string | number | boolean>
  type PrefillBase = {
    datos_personales?: PrefillSection
    historia_laboral?: PrefillSection
    heredo_familiares?: PrefillSection
  }
  const prefillBase = (initialData as Record<string, unknown> | undefined)?.prefill_base as PrefillBase | null | undefined

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

      {/* IMPL-20260325-08: Historia Declarativa Base (capturada por el trabajador desde el portal) */}
      {prefillBase ? (
        <div className="max-w-4xl mx-auto px-4 pb-10">
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-blue-600 text-xl">📋</span>
                <div>
                  <h2 className="text-base font-bold text-blue-800">Historia Declarativa Base</h2>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Capturada por el trabajador vía portal de prellenado. Se actualiza en cada nueva cita.
                  </p>
                </div>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 border border-blue-300 px-2.5 py-1 rounded-full font-semibold">
                Base longitudinal
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Datos Personales */}
              {prefillBase.datos_personales && typeof prefillBase.datos_personales === 'object' && (
                <section>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">👤 Datos Personales Declarativos</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(prefillBase.datos_personales as Record<string, string | number | boolean>)
                      .filter(([, v]) => v !== undefined && v !== '' && v !== null)
                      .map(([k, v]) => (
                        <div key={k} className="bg-slate-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-slate-700 font-semibold mt-0.5">{String(v)}</p>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Historia Laboral */}
              {prefillBase.historia_laboral && typeof prefillBase.historia_laboral === 'object' && (
                <section>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">🏭 Historia Laboral Declarativa</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(prefillBase.historia_laboral as Record<string, string | number | boolean>)
                      .filter(([, v]) => v !== undefined && v !== '' && v !== null)
                      .map(([k, v]) => (
                        <div key={k} className="bg-slate-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-slate-700 font-semibold mt-0.5">{String(v)}</p>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Heredo Familiares (portal) */}
              {prefillBase.heredo_familiares && typeof prefillBase.heredo_familiares === 'object' && (
                <section>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">🧬 Antecedentes Familiar (Portal)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(prefillBase.heredo_familiares as Record<string, string | number | boolean>)
                      .filter(([, v]) => v !== undefined && v !== '' && v !== null)
                      .map(([k, v]) => (
                        <div key={k} className="bg-slate-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{k}</p>
                          <p className="text-sm text-slate-700 font-semibold mt-0.5">{String(v)}</p>
                        </div>
                      ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 pb-10">
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl px-6 py-5 text-center">
            <p className="text-sm text-slate-400">
              Sin base declarativa longitudinal aún. Se generará cuando el trabajador complete el portal de prellenado.
            </p>
          </div>
        </div>
      )}

      {/* Debug Info (Safe Mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-4xl mx-auto mt-4 border-t border-dashed pt-4 mb-8 text-center text-xs text-gray-400">
          <p>Worker: {worker.id.slice(-6)} | History: {initialData ? 'Loaded' : 'New'} | PrefillBase: {prefillBase ? 'Present' : 'None'}</p>
        </div>
      )}
    </div>
  )
}
