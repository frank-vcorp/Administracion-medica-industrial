/**
 * @summary ARCH-20260326-02: integra el historial longitudinal en la ficha del trabajador.
 * @backup context/SPECs/SPEC_ARCH-20260325-07-PRELLENADO-LONGITUDINAL-DUAL.md
 * @intervention ARCH-20260326-10
 * @see context/checkpoints/CHK_IMPL-ARCH-20260326-06.md
 */
import { getWorkerById } from '@/services/worker.service'
import { getWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import WorkerIdentityCard from '@/components/workers/WorkerIdentityCard'

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const worker = await getWorkerById(id)

    if (!worker) {
        notFound()
    }

    const historyResult = await getWorkerClinicalHistory(id)

    type PrefillSection = Record<string, string | number | boolean>
    type PrefillBase = {
        datos_personales?: PrefillSection
        historia_laboral?: PrefillSection
        heredo_familiares?: PrefillSection
    }

    // ARCH-20260326-06: Leer desde campos raíz longitudinales (nuevo formato)
    // Fallback: prefill_base para registros legados capturados antes de la transición.
    const histData = historyResult.success
        ? (historyResult.data?.data as Record<string, unknown> | undefined)
        : undefined

    const rootDP = histData?.datos_personales as PrefillSection | undefined
    const rootHL = histData?.historia_laboral as PrefillSection | undefined
    const rootHF = histData?.heredo_familiares as PrefillSection | undefined
    const hasRootData = !!(rootDP || rootHL || rootHF)

    // Si no hay datos en raíz, intentar fallback legado
    const legacyBase = !hasRootData
        ? (histData?.prefill_base as PrefillBase | null | undefined)
        : null

    const datosPersonalesDisplay = rootDP ?? legacyBase?.datos_personales
    const historiaLaboralDisplay = rootHL ?? legacyBase?.historia_laboral
    const heredoFamiliaresDisplay = rootHF ?? legacyBase?.heredo_familiares

    const renderPrefillSection = (title: string, data?: PrefillSection) => {
        if (!data || typeof data !== 'object') {
            return null
        }

        const entries = Object.entries(data).filter(([, value]) => value !== undefined && value !== '' && value !== null)

        if (entries.length === 0) {
            return null
        }

        return (
            <section>
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">{title}</h4>
                <div className="space-y-2">
                    {entries.map(([key, value]) => (
                        <div key={key} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</p>
                            <p className="text-sm text-slate-700 font-semibold mt-0.5">{String(value)}</p>
                        </div>
                    ))}
                </div>
            </section>
        )
    }

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between border-b pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500">
                        {worker.firstName[0]}{worker.lastName[0]}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{worker.firstName} {worker.lastName}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full font-mono">
                                ID: {worker.universalId}
                            </span>
                            <span className="text-slate-500 text-sm">Empresa: {worker.company?.name}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 text-slate-700 font-medium bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                        Editar Perfil
                    </button>
                    <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm">
                        Iniciar Nueva Visita
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Info Column */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-semibold text-slate-900 mb-4">Información Personal</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">Email</span>
                                <span className="text-slate-900">{worker.email || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">Teléfono</span>
                                <span className="text-slate-900">{worker.phone || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">ID Nacional</span>
                                <span className="text-slate-900">{worker.nationalId || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* IMPL-20260808-04: card "Identificación" con miniatura
                        ampliable de la última evidencia persistida. */}
                    <WorkerIdentityCard
                        firstName={worker.firstName}
                        lastName={worker.lastName}
                        lastIdentityDocumentType={worker.lastIdentityDocumentType}
                        lastIdentityFrontFileUrl={worker.lastIdentityFrontFileUrl}
                        lastIdentityBackFileUrl={worker.lastIdentityBackFileUrl}
                        lastIdentityVerifiedAt={worker.lastIdentityVerifiedAt}
                    />

                    <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
                        <div className="bg-blue-50 border-b border-blue-200 px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold text-blue-900">Historial Clínico Longitudinal</h3>
                                    <p className="text-xs text-blue-700 mt-1">
                                        Base declarativa maestra del trabajador. Persiste entre citas y sirve como referencia para cada examen médico.
                                    </p>
                                </div>
                                <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-300 px-2 py-1 rounded-full font-bold uppercase tracking-widest">
                                    Longitudinal
                                </span>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            {historyResult.success ? (
                                datosPersonalesDisplay || historiaLaboralDisplay || heredoFamiliaresDisplay ? (
                                    <>
                                        {renderPrefillSection('Datos personales', datosPersonalesDisplay)}
                                        {renderPrefillSection('Historia laboral', historiaLaboralDisplay)}
                                        {renderPrefillSection('Antecedentes familiares', heredoFamiliaresDisplay)}
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-500">
                                        Este trabajador aún no tiene datos longitudinales registrados en el Historial Clínico.
                                    </p>
                                )
                            ) : (
                                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    No fue posible cargar el Historial Clínico Longitudinal en este momento.
                                </p>
                            )}

                            <div className="pt-2 border-t border-slate-100">
                                <Link href={`/history/${worker.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                                    Abrir Historial Clínico completo &rarr;
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline Column */}
                <div className="md:col-span-2">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-slate-900">Historial Médico (Expedientes)</h3>
                            <span className="text-xs text-slate-500">{worker.medicalHistory.length} registros</span>
                        </div>

                        <div className="space-y-4">
                            {worker.medicalHistory.length === 0 ? (
                                <p className="text-slate-500 text-sm italic">No hay historial médico registrado.</p>
                            ) : (
                                worker.medicalHistory.map(event => (
                                    <div key={event.id} className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
                                        <div className="mt-1">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <h4 className="text-sm font-medium text-slate-900">Visita General - {event.status}</h4>
                                                <span className="text-xs text-slate-500">{new Date(event.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1">Sucursal: {event.branchId} (TODO: Populate)</p>
                                            <div className="mt-2">
                                                <Link href={`/events/${event.id}`} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                                                    Ver Expediente Completar &rarr;
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
