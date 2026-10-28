'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { createAppointment } from '@/actions/appointment.actions'
import { getWorkersByCompany, searchWorkersByCompany } from '@/actions/worker.actions'
import { getBranches, getCompanies } from '@/actions/admin.actions'
import {
    getAssignableMedicalProfilesForCompany,
    getMedicalProfileOptions,
} from '@/actions/medical-profiles'
import { useRouter, useSearchParams } from 'next/navigation'
import WorkerFormModal, { type WorkerCreatedPayload } from '@/components/WorkerFormModal'
import { parseAppointmentLocalDateTime, todayAgendaDateString } from '@/lib/appointment-scheduling'
import AppointmentWhatsAppSuccess from '@/components/AppointmentWhatsAppSuccess'

import { EVENTS, OpenAppointmentModalDetail } from '@/types/events'

interface Worker {
    id: string
    firstName: string
    lastName: string
    companyId: string | null
    medicalProfileId?: string | null
    company?: { name: string, defaultBranchId: string | null } | null
    medicalProfile?: { id: string; name: string } | null
}

interface Company {
    id: string
    name: string
    defaultBranchId: string | null
    allowedBranches?: { id: string; name: string }[]
}

interface Branch {
    id: string
    name: string
}

interface MedicalProfileOption {
    id: string
    name: string
    companyId: string | null
}

interface AppointmentResult {
    success: boolean
    appointment?: {
        id: string
        expedientId: string | null
        workerId: string
        worker?: {
            firstName: string
            lastName: string
            phone: string | null
        }
        branch?: {
            name: string
            address: string | null
        }
        scheduledAt: Date | string
    }
    error?: string
}

export default function AppointmentFormModal({
    onSuccess,
}: {
    onSuccess?: (info?: { branchId: string; date: string }) => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [successData, setSuccessData] = useState<AppointmentResult | null>(null)
    const [companies, setCompanies] = useState<Company[]>([])
    const [workers, setWorkers] = useState<Worker[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [profiles, setProfiles] = useState<MedicalProfileOption[]>([])
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
    const [selectedBranchId, setSelectedBranchId] = useState<string>('')
    const [selectedProfileId, setSelectedProfileId] = useState<string>('')
    const [workerSearchQuery, setWorkerSearchQuery] = useState('')
    const [workerSearchResults, setWorkerSearchResults] = useState<Worker[]>([])
    const [workerSearchPending, setWorkerSearchPending] = useState(false)
    const [preselectedWorkerId, setPreselectedWorkerId] = useState<string | null>(null)
    const [preselectedCompanyId, setPreselectedCompanyId] = useState<string | null>(null)
    const [workerQuickOpen, setWorkerQuickOpen] = useState(false)
    const [allMedicalProfiles, setAllMedicalProfiles] = useState<MedicalProfileOption[]>([])
    const router = useRouter()
    const searchParams = useSearchParams()

    const companySpecificProfiles = useMemo(
        () => profiles.filter((p) => p.companyId === selectedCompanyId),
        [profiles, selectedCompanyId],
    )
    const publicGeneralProfiles = useMemo(
        () => profiles.filter((p) => p.companyId !== selectedCompanyId),
        [profiles, selectedCompanyId],
    )

    // Detect URL params (e.g. from create-worker redirect)
    useEffect(() => {
        const action = searchParams.get('action')
        const workerId = searchParams.get('workerId')
        const branchId = searchParams.get('branchId')
        const companyId = searchParams.get('companyId')
        
        if (action === 'new-appointment' && !isOpen) {
             setIsOpen(true)
             if (workerId) setPreselectedWorkerId(workerId)
             if (branchId) setSelectedBranchId(branchId)
             if (companyId) setPreselectedCompanyId(companyId)
             
             // Clean URL to prevent re-open
             const newParams = new URLSearchParams(searchParams.toString())
             newParams.delete('action')
             newParams.delete('workerId')
             newParams.delete('branchId')
             newParams.delete('companyId')
             
             // Use replace to update URL without adding history entry
             router.replace(`/appointments?${newParams.toString()}`)
        }
    }, [searchParams, isOpen, router])
    
    // Cargar datos una sola vez cuando el modal se abre
    useEffect(() => {
        if (!isOpen) return
        
        // Función asíncrona dentro del effect para manejar carga y pre-selección
        async function fetchAndSelect() {
            try {
                // Cargar empresas y sucursales (no todos los trabajadores)
                const [cData, bData, profileOptions] = await Promise.all([
                    getCompanies(),
                    getBranches(),
                    getMedicalProfileOptions(),
                ])
                setCompanies(cData as Company[])
                setBranches(bData)
                setAllMedicalProfiles(profileOptions)
                
                // Si hay una empresa preseleccionada (desde redirección de creación de trabajador)
                const companyIdToUse = preselectedCompanyId
                if (companyIdToUse) {
                    setSelectedCompanyId(companyIdToUse)
                    const wData = await getWorkersByCompany(companyIdToUse)
                    setWorkers(wData)

                    if (preselectedWorkerId) {
                        const worker = wData.find(w => w.id === preselectedWorkerId)
                        if (worker) {
                            setSelectedWorker(worker)
                            // Autoseleccionar sucursal por empresa si no hay una ya seleccionada
                            const company = (cData as Company[]).find(c => c.id === companyIdToUse)
                            if (!selectedBranchId && company?.defaultBranchId) {
                                setSelectedBranchId(company.defaultBranchId)
                            }
                            // Auto-seleccionar perfil del paciente
                            const pData = await getAssignableMedicalProfilesForCompany(companyIdToUse)
                            setProfiles(pData)
                            if (worker.medicalProfileId) {
                                setSelectedProfileId(worker.medicalProfileId)
                            }
                        }
                    } else {
                        // Cargar perfiles para la empresa preseleccionada
                        const pData = await getAssignableMedicalProfilesForCompany(companyIdToUse)
                        setProfiles(pData)
                    }
                    setPreselectedCompanyId(null)
                }
                setPreselectedWorkerId(null)
            } catch (err) {
                console.error("Error cargando datos:", err)
                setError("Error al cargar datos del formulario")
            }
        }
        
        fetchAndSelect()
        
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]) // Solo ejecutar al abrirse el modal

    // O9-22 — búsqueda de trabajador por nombre/código (sin cargar lista completa)
    useEffect(() => {
        if (!isOpen || !selectedCompanyId) {
            setWorkerSearchResults([])
            return
        }
        const q = workerSearchQuery.trim()
        if (q.length < 2) {
            setWorkerSearchResults([])
            return
        }
        const handle = window.setTimeout(() => {
            setWorkerSearchPending(true)
            searchWorkersByCompany(selectedCompanyId, q)
                .then((res) => {
                    if (res.success) setWorkerSearchResults(res.workers as Worker[])
                    else setWorkerSearchResults([])
                })
                .catch(() => setWorkerSearchResults([]))
                .finally(() => setWorkerSearchPending(false))
        }, 280)
        return () => window.clearTimeout(handle)
    }, [isOpen, selectedCompanyId, workerSearchQuery])
    
    // Listener de eventos globales
    useEffect(() => {
        const handleOpenEvent = (e: CustomEvent<OpenAppointmentModalDetail>) => {
            // Setear estados PREVIOS a abrir el modal para que el effect de isOpen los vea
            if (e.detail?.workerId) setPreselectedWorkerId(e.detail.workerId)
            if (e.detail?.branchId) setSelectedBranchId(e.detail.branchId)
            if (e.detail?.companyId) setPreselectedCompanyId(e.detail.companyId)
            
            setIsOpen(true)
        }

        window.addEventListener(EVENTS.OPEN_APPOINTMENT_MODAL, handleOpenEvent as EventListener)
        return () => window.removeEventListener(EVENTS.OPEN_APPOINTMENT_MODAL, handleOpenEvent as EventListener)
    }, [])

    // IMPL-20260318-09: Al elegir empresa, cargar sus trabajadores y perfiles
    const handleCompanyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const companyId = e.target.value
        setSelectedCompanyId(companyId)
        setSelectedWorker(null)
        setWorkerSearchQuery('')
        setWorkerSearchResults([])
        setWorkers([])
        setProfiles([])
        setSelectedProfileId('')

        if (!companyId) return

        try {
            const [wData, pData] = await Promise.all([
                getWorkersByCompany(companyId),
                getAssignableMedicalProfilesForCompany(companyId),
            ])
            setWorkers(wData)
            setProfiles(pData)
        } catch (err) {
            console.error('Error cargando trabajadores de la empresa:', err)
        }
    }

    async function refreshWorkersAndSelect(companyId: string, workerId: string) {
        const [wData, pData] = await Promise.all([
            getWorkersByCompany(companyId),
            getAssignableMedicalProfilesForCompany(companyId),
        ])
        setWorkers(wData)
        setProfiles(pData)
        const worker = wData.find((w) => w.id === workerId) ?? null
        setSelectedWorker(worker)
        if (worker?.medicalProfileId) {
            setSelectedProfileId(worker.medicalProfileId)
        }
    }

    function handleWorkerQuickCreated(created: WorkerCreatedPayload) {
        setWorkerQuickOpen(false)
        if (!selectedCompanyId) return
        void refreshWorkersAndSelect(selectedCompanyId, created.id).catch((err) => {
            console.error('Error actualizando trabajadores tras alta rápida:', err)
        })
    }

    async function handleSubmit(formData: FormData) {
        startTransition(async () => {
            setError(null)
            
            const workerId = formData.get('workerId') as string
            const branchId = formData.get('branchId') as string
            const date = formData.get('date') as string
            const time = formData.get('time') as string
            const notes = formData.get('notes') as string
            const source = formData.get('source') as string
            const serviceProfileId = formData.get('serviceProfileId') as string | null

            if (!workerId || !branchId || !date || !time) {
                setError('Todos los campos son obligatorios')
                return
            }

            if (!selectedWorker && !workers.find(w => w.id === workerId)) {
                setError('Selecciona un trabajador de la búsqueda')
                return
            }

            // FIX: Find worker from list instead of relying on state to avoid race conditions
            const currentWorker = workers.find(w => w.id === workerId)
            const companyId = currentWorker?.companyId || selectedCompanyId
            if (!companyId) {
                setError('Selecciona una empresa antes de agendar la cita')
                return
            }

            // Combinar fecha y hora
            const scheduledAt = parseAppointmentLocalDateTime(date, time)

            try {
                const result = await createAppointment({
                    workerId,
                    companyId,
                    branchId,
                    scheduledAt,
                    notes,
                    source,
                    serviceProfileId: serviceProfileId || null,
                })

                if (result.success) {
                    setSuccessData(result)
                    router.refresh()
                    onSuccess?.({ branchId, date })
                } else {
                    setError(result.error || 'Error al agendar la cita')
                }
            } catch {
                setError('Error de conexión')
            }
        })
    }

    if (successData && successData.appointment) {
        const apt = successData.appointment;
        // FIX: Validate phone exists before generating link
        const rawPhone = apt.worker?.phone || '';
        const cleanPhone = rawPhone.replace(/\D/g, '');
        const hasValidPhone = cleanPhone.length >= 10;
        
        const message = `Hola ${apt.worker?.firstName}, tu cita médica en AMI está confirmada para el ${new Date(apt.scheduledAt).toLocaleDateString('es-ES')} a las ${new Date(apt.scheduledAt).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}. Tu número de expediente es: ${apt.expedientId}. Por favor presenta este mensaje en recepción.`;

        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl animate-bounce">
                        ✅
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800">¡Cita Agendada!</h3>
                        <p className="text-slate-500 mt-1 text-xs font-medium">Expediente: <span className="font-mono font-bold text-slate-800">{apt.expedientId}</span></p>

                        <div className="mt-4 bg-slate-50 p-4 rounded-2xl text-left space-y-3 border border-slate-100 shadow-sm">
                             <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha</span>
                                <span className="text-xs font-black text-slate-700 capitalize">
                                    {new Date(apt.scheduledAt).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} • {new Date(apt.scheduledAt).toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}
                                </span>
                             </div>
                             
                             {apt.branch && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ubicación</p>
                                    <p className="text-xs font-black text-slate-800">{apt.branch.name}</p>
                                    {apt.branch.address && (
                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                            {apt.branch.address}
                                        </p>
                                    )}
                                </div>
                             )}
                        </div>
                    </div>
                    <div className="space-y-3 pt-2">
                        {hasValidPhone ? (
                            <AppointmentWhatsAppSuccess
                                phone={rawPhone}
                                message={message}
                                appointmentId={apt.id}
                            />
                        ) : (
                            <div className="bg-slate-100 text-slate-500 py-3 rounded-xl font-medium text-xs px-4">
                                ⚠️ El trabajador no tiene número de celular registrado.
                            </div>
                        )}
                        <button
                            onClick={() => { setSuccessData(null); setIsOpen(false); }}
                            className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <button
                onClick={() => {
                    setSelectedCompanyId('')
                    setSelectedWorker(null)
                    setWorkers([])
                    setProfiles([])
                    setSelectedProfileId('')
                    setSelectedBranchId('')
                    setError(null)
                    setIsOpen(true)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
            >
                <span className="text-lg">+</span> Agendar Cita
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>

                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Agendar Cita</h3>
                                <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-widest mt-1">Nuevo Ingreso Programado</p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <form action={handleSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Sucursal</label>
                                <select
                                    name="branchId"
                                    required
                                    value={selectedBranchId || ''}
                                    onChange={(e) => {
                                        const nextBranch = e.target.value
                                        setSelectedBranchId(nextBranch)
                                        if (!nextBranch) {
                                            setSelectedCompanyId('')
                                            setSelectedWorker(null)
                                            setWorkers([])
                                            return
                                        }
                                        const company = companies.find((item) => item.id === selectedCompanyId)
                                        const allowed = company?.allowedBranches ?? []
                                        const stillAllowed =
                                            !company ||
                                            allowed.length === 0 ||
                                            allowed.some((branch) => branch.id === nextBranch)
                                        if (!stillAllowed) {
                                            setSelectedCompanyId('')
                                            setSelectedWorker(null)
                                            setWorkers([])
                                            setProfiles([])
                                            setSelectedProfileId('')
                                        }
                                    }}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm transition-all outline-none"
                                >
                                    <option value="">Seleccionar sucursal...</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400 ml-1">Elige la sucursal antes de la empresa y el trabajador.</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Empresa</label>
                                <select
                                    name="companyId"
                                    required
                                    value={selectedCompanyId}
                                    onChange={handleCompanyChange}
                                    disabled={!selectedBranchId}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">{selectedBranchId ? 'Seleccionar empresa...' : 'Primero selecciona la sucursal'}</option>
                                    {companies
                                        .filter((company) => {
                                            const allowed = company.allowedBranches ?? []
                                            if (!selectedBranchId || allowed.length === 0) return Boolean(selectedBranchId)
                                            return allowed.some((branch) => branch.id === selectedBranchId)
                                        })
                                        .map((company) => (
                                            <option key={company.id} value={company.id}>{company.name}</option>
                                        ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between ml-1 mr-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Trabajador</label>
                                    {selectedCompanyId && (
                                        <button
                                            type="button"
                                            onClick={() => setWorkerQuickOpen(true)}
                                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide"
                                        >
                                            + Alta rápida
                                        </button>
                                    )}
                                </div>
                                <input type="hidden" name="workerId" value={selectedWorker?.id ?? ''} />
                                <input
                                    type="search"
                                    autoComplete="off"
                                    placeholder={
                                        selectedCompanyId
                                            ? 'Buscar por nombre, folio o CURP (mín. 2 letras)...'
                                            : 'Primero selecciona una empresa'
                                    }
                                    disabled={!selectedCompanyId}
                                    value={
                                        selectedWorker
                                            ? `${selectedWorker.firstName} ${selectedWorker.lastName}`
                                            : workerSearchQuery
                                    }
                                    onChange={(e) => {
                                        setSelectedWorker(null)
                                        setSelectedProfileId('')
                                        setWorkerSearchQuery(e.target.value)
                                    }}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                {selectedCompanyId && workerSearchPending && (
                                    <p className="text-[10px] text-slate-400 ml-1">Buscando…</p>
                                )}
                                {selectedCompanyId &&
                                    !selectedWorker &&
                                    workerSearchQuery.trim().length >= 2 &&
                                    workerSearchResults.length > 0 && (
                                        <ul
                                            className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg text-sm"
                                            role="listbox"
                                        >
                                            {workerSearchResults.map((w) => (
                                                <li key={w.id}>
                                                    <button
                                                        type="button"
                                                        role="option"
                                                        className="w-full text-left px-3 py-2 hover:bg-blue-50"
                                                        onClick={() => {
                                                            setSelectedWorker(w)
                                                            setWorkerSearchQuery('')
                                                            setWorkerSearchResults([])
                                                            if (w.medicalProfileId) {
                                                                setSelectedProfileId(w.medicalProfileId)
                                                            }
                                                        }}
                                                    >
                                                        <span className="font-medium text-slate-800">
                                                            {w.firstName} {w.lastName}
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                {selectedWorker && (
                                    <button
                                        type="button"
                                        className="text-[10px] text-slate-500 underline ml-1"
                                        onClick={() => {
                                            setSelectedWorker(null)
                                            setWorkerSearchQuery('')
                                            setSelectedProfileId('')
                                        }}
                                    >
                                        Cambiar trabajador
                                    </button>
                                )}
                                {selectedCompanyId && !selectedWorker && workerSearchQuery.trim().length >= 2 && !workerSearchPending && workerSearchResults.length === 0 && (
                                    <p className="text-[10px] text-amber-600 ml-1">
                                        Sin coincidencias. Usa{' '}
                                        <button
                                            type="button"
                                            onClick={() => setWorkerQuickOpen(true)}
                                            className="font-bold underline hover:text-amber-800"
                                        >
                                            Alta rápida
                                        </button>
                                        .
                                    </p>
                                )}
                            </div>

                            {/* IMPL-20260313-07: Perfil Médico auto-asignado por Puesto de Trabajo */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between ml-1 mb-0.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Perfil Médico</label>
                                    {selectedWorker?.medicalProfileId && selectedProfileId === selectedWorker.medicalProfileId && (
                                        <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                                            ✦ Auto por paciente: {selectedWorker.medicalProfile?.name || profiles.find(p => p.id === selectedProfileId)?.name}
                                        </span>
                                    )}
                                </div>
                                <select
                                    name="serviceProfileId"
                                    value={selectedProfileId}
                                    onChange={(e) => setSelectedProfileId(e.target.value)}
                                    disabled={!selectedCompanyId}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500 p-3 rounded-xl text-sm transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">
                                        {selectedCompanyId
                                            ? 'Sin perfil asignado'
                                            : 'Primero selecciona una empresa'}
                                    </option>
                                    {companySpecificProfiles.length > 0 && (
                                        <optgroup label="Perfiles de esta empresa">
                                            {companySpecificProfiles.map((p) => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {publicGeneralProfiles.length > 0 && (
                                        <optgroup label="Perfiles Público General">
                                            {publicGeneralProfiles.map((p) => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                {!selectedCompanyId && (
                                    <p className="text-[10px] text-slate-400 ml-1">
                                        Los perfiles se filtran por la empresa de la cita.
                                    </p>
                                )}
                                {selectedCompanyId && profiles.length === 0 && (
                                    <p className="text-[10px] text-amber-500 ml-1">
                                        ⚠️ Esta empresa no tiene perfiles médicos. Configúralos en la ficha de la empresa.
                                    </p>
                                )}
                                {selectedWorker && !selectedWorker.medicalProfileId && selectedCompanyId && profiles.length > 0 && (
                                    <p className="text-[10px] text-slate-400 ml-1">
                                        El paciente no tiene perfil por defecto; elige uno para esta cita.
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Fecha</label>
                                    <input 
                                        type="date" 
                                        name="date" 
                                        required 
                                        defaultValue={todayAgendaDateString()}
                                        className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm transition-all outline-none" 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Hora</label>
                                    <input 
                                        type="time" 
                                        name="time" 
                                        required 
                                        defaultValue="08:00"
                                        className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm transition-all outline-none" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Origen de la Cita</label>
                                <select 
                                    name="source" 
                                    required 
                                    defaultValue="SUCURSAL"
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm transition-all outline-none"
                                >
                                    <option value="SUCURSAL">En Sucursal (Presencial)</option>
                                    <option value="TELEFONO">Llamada Telefónica</option>
                                    <option value="WHATSAPP">WhatsApp</option>
                                    <option value="CORREO">Correo Electrónico</option>
                                    <option value="OTRO">Otro</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Notas (Opcional)</label>
                                <textarea 
                                    name="notes" 
                                    rows={2}
                                    placeholder="Instrucciones especiales..."
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm transition-all outline-none resize-none"
                                ></textarea>
                            </div>

                            {error && <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-lg border border-red-100 animate-shake">⚠️ {error}</p>}

                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black shadow-lg shadow-blue-100 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 mt-2"
                            >
                                {isPending ? 'Agendando...' : 'Confirmar Cita'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <WorkerFormModal
                companies={companies.map((c) => ({
                    id: c.id,
                    name: c.name,
                    defaultBranchId: c.defaultBranchId,
                }))}
                medicalProfiles={allMedicalProfiles}
                defaultCompanyId={selectedCompanyId || undefined}
                lockCompany={Boolean(selectedCompanyId)}
                isOpen={workerQuickOpen}
                onClose={() => setWorkerQuickOpen(false)}
                hideDefaultTrigger
                stacked
                onWorkerCreated={handleWorkerQuickCreated}
            />
        </>
    )
}
