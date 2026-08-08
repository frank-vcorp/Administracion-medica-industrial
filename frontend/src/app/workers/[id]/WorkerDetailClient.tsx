'use client'

/**
 * @file WorkerDetailClient — wrapper client-component para /workers/[id].
 * @id IMPL-20260808-05
 * @spec context/SPECs/SPEC_ARCH-20260808-05-REDESIGN-FICHA-WORKER.md
 *
 * Razón del split server/client:
 *   - El header tiene 2 botones que abren modales (`WorkerFormModal` con
 *     `workerToEdit` precargado y `AppointmentFormModal` vía router.push).
 *   - Ambos requieren useState local o acceso a searchParams/router.
 *
 * El server-component padre (/workers/[id]/page.tsx) hace:
 *   - await params + getWorkerById + getWorkerClinicalHistory
 *   - loadCompanies + loadJobPositions (necesarios por WorkerFormModal)
 *   - serializa el worker (Date → ISO string) y lo pasa a este wrapper.
 *
 * Mecanismo del modal "Agendar Cita" (decisión §6.3 SPEC):
 *   - AppointmentFormModal YA escucha `?action=new-appointment&workerId=...&companyId=...`
 *     en sus useSearchParams (verificado en su código fuente).
 *   - Por lo tanto NO se añade prop controlada. Se hace router.push y el modal
 *     se abre solo. Esto preserva la API pública del modal.
 */
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import WorkerFormModal from '@/components/WorkerFormModal'
import WorkerIdentityCard from '@/components/workers/WorkerIdentityCard'

// ────────────────────────────────────────────────────────────
// Tipos — explícitos para evitar `any` en server→client boundary
// ────────────────────────────────────────────────────────────

/** Worker serializado (Date → ISO string). */
export interface SerializedWorker {
    id: string
    firstName: string
    lastName: string
    universalId: string
    email: string | null
    phone: string | null
    nationalId: string | null
    dob: string | null
    companyId: string | null
    jobPositionId: string | null
    company: { id: string; name: string } | null
    lastIdentityDocumentType: string | null
    lastIdentityFrontFileUrl: string | null
    lastIdentityBackFileUrl: string | null
    lastIdentityVerifiedAt: string | null
    medicalHistory: Array<{
        id: string
        status: string
        updatedAt: string
        branchId: string | null
        branch: { id: string; name: string } | null
    }>
}

interface CompanyOption { id: string; name: string }
interface JobPositionOption { id: string; name: string; companyId: string | null }

/** Payload del historial clínico (lo que ya viene en historyResult.data). */
export interface HistoryPayload {
    success: boolean
    data?: {
        data: Record<string, unknown>
    } | null
    error?: string
}

interface Props {
    worker: SerializedWorker
    historyResult: HistoryPayload
    companies: CompanyOption[]
    jobPositions: JobPositionOption[]
}

// ────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────

type PrefillSection = Record<string, string | number | boolean>
type PrefillBase = {
    datos_personales?: PrefillSection
    historia_laboral?: PrefillSection
    heredo_familiares?: PrefillSection
}

export default function WorkerDetailClient({
    worker,
    historyResult,
    companies,
    jobPositions,
}: Props) {
    const router = useRouter()
    const [showEditModal, setShowEditModal] = useState(false)

    // ──────────────── Lógica prefill longitudinal (preservada) ────────────────
    // ARCH-20260326-06: raíz preferida; fallback legacyBase para registros previos.
    const histData = historyResult.success
        ? (historyResult.data?.data as Record<string, unknown> | undefined)
        : undefined

    const rootDP = histData?.datos_personales as PrefillSection | undefined
    const rootHL = histData?.historia_laboral as PrefillSection | undefined
    const rootHF = histData?.heredo_familiares as PrefillSection | undefined
    const hasRootData = !!(rootDP || rootHL || rootHF)

    const legacyBase = !hasRootData
        ? (histData?.prefill_base as PrefillBase | null | undefined)
        : null

    const datosPersonalesDisplay = rootDP ?? legacyBase?.datos_personales
    const historiaLaboralDisplay = rootHL ?? legacyBase?.historia_laboral
    const heredoFamiliaresDisplay = rootHF ?? legacyBase?.heredo_familiares

    const renderPrefillSection = (title: string, data?: PrefillSection) => {
        if (!data || typeof data !== 'object') return null
        const entries = Object.entries(data).filter(
            ([, value]) => value !== undefined && value !== '' && value !== null
        )
        if (entries.length === 0) return null
        return (
            <section>
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    {title}
                </h4>
                <div className="space-y-2">
                    {entries.map(([key, value]) => (
                        <div
                            key={key}
                            className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2"
                        >
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {key.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm text-slate-700 font-semibold mt-0.5">
                                {String(value)}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        )
    }

    const handleScheduleAppointment = useCallback(() => {
        // §6.3 SPEC: AppointmentFormModal ya escucha los searchParams.
        const params = new URLSearchParams()
        params.set('action', 'new-appointment')
        params.set('workerId', worker.id)
        if (worker.companyId) params.set('companyId', worker.companyId)
        router.push(`/appointments?${params.toString()}`)
    }, [router, worker.id, worker.companyId])

    // ──────────────── Render ────────────────

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/60 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500 text-white font-black flex items-center justify-center text-xl">
                        {worker.firstName[0]}
                        {worker.lastName[0]}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                            {worker.firstName} {worker.lastName}
                        </h1>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full font-mono">
                                ID: {worker.universalId}
                            </span>
                            <span className="text-slate-500 text-sm">
                                Empresa: {worker.company?.name ?? '—'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="px-4 py-2 text-slate-700 font-medium bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm"
                    >
                        Editar Perfil
                    </button>
                    <button
                        type="button"
                        onClick={handleScheduleAppointment}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm"
                    >
                        📅 Agendar Cita
                    </button>
                </div>
            </header>

            {/* Grid 1/3 + 2/3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Info Column */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl shadow-slate-100">
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

                    {/* IMPL-20260808-04: card Identificación (no regresión) */}
                    <WorkerIdentityCard
                        firstName={worker.firstName}
                        lastName={worker.lastName}
                        lastIdentityDocumentType={worker.lastIdentityDocumentType}
                        lastIdentityFrontFileUrl={worker.lastIdentityFrontFileUrl}
                        lastIdentityBackFileUrl={worker.lastIdentityBackFileUrl}
                        lastIdentityVerifiedAt={worker.lastIdentityVerifiedAt}
                    />

                    {/* Card Historial Clínico Longitudinal — slate contenedor, accent azul */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-100 overflow-hidden">
                        <div className="border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Historial Clínico Longitudinal
                                </h3>
                                <p className="text-xs text-slate-600 mt-1">
                                    Base declarativa maestra del trabajador. Persiste entre
                                    citas y sirve como referencia para cada examen médico.
                                </p>
                            </div>
                            <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 rounded-full font-bold uppercase tracking-widest flex-shrink-0">
                                Longitudinal
                            </span>
                        </div>

                        <div className="p-5 space-y-4">
                            {historyResult.success ? (
                                datosPersonalesDisplay ||
                                historiaLaboralDisplay ||
                                heredoFamiliaresDisplay ? (
                                    <>
                                        {renderPrefillSection('Datos personales', datosPersonalesDisplay)}
                                        {renderPrefillSection('Historia laboral', historiaLaboralDisplay)}
                                        {renderPrefillSection(
                                            'Antecedentes familiares',
                                            heredoFamiliaresDisplay
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-500">
                                        Este trabajador aún no tiene datos longitudinales
                                        registrados en el Historial Clínico.
                                    </p>
                                )
                            ) : (
                                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    No fue posible cargar el Historial Clínico Longitudinal en
                                    este momento.
                                </p>
                            )}

                            <div className="pt-2 border-t border-slate-100">
                                <Link
                                    href={`/history/${worker.id}`}
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                                >
                                    Abrir Historial Clínico completo &rarr;
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline Column */}
                <div className="md:col-span-2">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl shadow-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-slate-900">
                                Historial Médico (Expedientes)
                            </h3>
                            <span className="text-xs text-slate-500">
                                {worker.medicalHistory.length} registros
                            </span>
                        </div>

                        <div className="space-y-4">
                            {worker.medicalHistory.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center space-y-3">
                                    <p className="text-sm text-slate-600">
                                        Aún no hay visitas registradas.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleScheduleAppointment}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm"
                                    >
                                        📅 Agendar primera cita
                                    </button>
                                </div>
                            ) : (
                                worker.medicalHistory.map((event) => (
                                    <div
                                        key={event.id}
                                        className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100"
                                    >
                                        <div className="mt-1">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <h4 className="text-sm font-medium text-slate-900">
                                                    Visita General - {event.status}
                                                </h4>
                                                <span className="text-xs text-slate-500">
                                                    {new Date(event.updatedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1">
                                                Sucursal: {event.branch?.name ?? '—'}
                                            </p>
                                            <div className="mt-2">
                                                <Link
                                                    href={`/events/${event.id}`}
                                                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                                >
                                                    Ver Expediente Completo &rarr;
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

            {/* Modal Editar Perfil */}
            <WorkerFormModal
                companies={companies}
                jobPositions={jobPositions}
                workerToEdit={{
                    id: worker.id,
                    firstName: worker.firstName,
                    lastName: worker.lastName,
                    dob: worker.dob ? new Date(worker.dob) : null,
                    email: worker.email,
                    phone: worker.phone,
                    companyId: worker.companyId,
                    jobPositionId: worker.jobPositionId,
                }}
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
            />
        </div>
    )
}
