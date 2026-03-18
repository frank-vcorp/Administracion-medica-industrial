'use client'

import { useState, useTransition, useEffect } from 'react'
import { createAppointment } from '@/actions/appointment.actions'
import { getWorkersByCompany } from '@/actions/worker.actions'
import { getBranches, getCompanies } from '@/actions/admin.actions'
import { getMedicalProfilesForCompany } from '@/actions/medical-profiles'
import { useRouter, useSearchParams } from 'next/navigation'

import { EVENTS, OpenAppointmentModalDetail } from '@/types/events'

interface Worker {
    id: string
    firstName: string
    lastName: string
    companyId: string | null
    company?: { name: string, defaultBranchId: string | null } | null
    jobPosition?: { id: string; name: string; defaultProfileId: string | null } | null
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

export default function AppointmentFormModal({ onSuccess }: { onSuccess?: () => void }) {
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
    const [preselectedWorkerId, setPreselectedWorkerId] = useState<string | null>(null)
    const [preselectedCompanyId, setPreselectedCompanyId] = useState<string | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()

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
                const [cData, bData] = await Promise.all([getCompanies(), getBranches()])
                setCompanies(cData as Company[])
                setBranches(bData)
                
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
                            // Auto-cargar y seleccionar perfil del jobPosition
                            const pData = await getMedicalProfilesForCompany(companyIdToUse)
                            setProfiles(pData)
                            if (worker.jobPosition?.defaultProfileId) {
                                setSelectedProfileId(worker.jobPosition.defaultProfileId)
                            }
                        }
                    } else {
                        // Cargar perfiles para la empresa preseleccionada
                        const pData = await getMedicalProfilesForCompany(companyIdToUse)
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
        setWorkers([])
        setProfiles([])
        setSelectedProfileId('')

        if (!companyId) {
            setSelectedBranchId('')
            return
        }

        // Auto-seleccionar sucursal default de la empresa, SOLO si pertenece a las permitidas
        const company = companies.find(c => c.id === companyId)
        const allowed = company?.allowedBranches ?? []

        if (company?.defaultBranchId) {
            // Solo autoseleccionar si la default está dentro de las permitidas (o si no hay restricción)
            const defaultValid = allowed.length === 0 || allowed.some(b => b.id === company.defaultBranchId)
            if (defaultValid) {
                setSelectedBranchId(company.defaultBranchId)
            } else {
                // defaultBranch no está dentro de las permitidas: limpiar selección
                setSelectedBranchId('')
            }
        } else {
            setSelectedBranchId('')
        }

        try {
            const [wData, pData] = await Promise.all([
                getWorkersByCompany(companyId),
                getMedicalProfilesForCompany(companyId),
            ])
            setWorkers(wData)
            setProfiles(pData)
        } catch (err) {
            console.error('Error cargando trabajadores de la empresa:', err)
        }
    }

    const handleWorkerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const workerId = e.target.value
        const worker = workers.find(w => w.id === workerId) || null
        setSelectedWorker(worker)
        setSelectedProfileId('')

        // Auto-seleccionar perfil por puesto de trabajo
        if (worker?.jobPosition?.defaultProfileId) {
            setSelectedProfileId(worker.jobPosition.defaultProfileId)
        }
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

            // FIX: Find worker from list instead of relying on state to avoid race conditions
            const currentWorker = workers.find(w => w.id === workerId)
            const companyId = currentWorker?.companyId || selectedCompanyId
            if (!companyId) {
                setError('Selecciona una empresa antes de agendar la cita')
                return
            }

            // Combinar fecha y hora
            const scheduledAt = new Date(`${date}T${time}:00`)

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
                    router.refresh() // Revalida server components
                    if (onSuccess) onSuccess() // Actualiza lista del cliente inmediatamente
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
        const whatsappUrl = hasValidPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}` : '#';

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
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                            >
                                <span>📱</span> Enviar Pase por WhatsApp
                            </a>
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
                            {/* IMPL-20260318-07: Flujo Empresa → Trabajador filtrado */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Empresa</label>
                                <select
                                    name="companyId"
                                    required
                                    value={selectedCompanyId}
                                    onChange={handleCompanyChange}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm transition-all outline-none"
                                >
                                    <option value="">Seleccionar empresa...</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Trabajador</label>
                                <select 
                                    name="workerId" 
                                    required
                                    value={selectedWorker?.id || ''}
                                    onChange={handleWorkerChange}
                                    disabled={!selectedCompanyId}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">{selectedCompanyId ? 'Seleccionar trabajador...' : 'Primero selecciona una empresa'}</option>
                                    {workers.map(w => (
                                        <option key={w.id} value={w.id}>
                                            {w.firstName} {w.lastName}
                                        </option>
                                    ))}
                                </select>
                                {selectedCompanyId && workers.length === 0 && (
                                    <p className="text-[10px] text-amber-500 ml-1">⚠️ Esta empresa no tiene trabajadores registrados.</p>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Sucursal</label>
                                <select 
                                    name="branchId" 
                                    required
                                    value={selectedBranchId || ''}
                                    onChange={(e) => setSelectedBranchId(e.target.value)}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm transition-all outline-none"
                                >
                                    <option value="">Seleccionar sucursal...</option>
                                    {/* IMPL-20260318-09: Filtrar por allowedBranches de la empresa; fallback a todas si no hay restricción */}
                                    {(() => {
                                        const selectedCompany = companies.find(c => c.id === selectedCompanyId)
                                        const allowed = selectedCompany?.allowedBranches ?? []
                                        const visibleBranches = allowed.length > 0
                                            ? branches.filter(b => allowed.some(ab => ab.id === b.id))
                                            : branches
                                        return visibleBranches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))
                                    })()}
                                </select>
                            </div>

                            {/* IMPL-20260313-07: Perfil Médico auto-asignado por Puesto de Trabajo */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between ml-1 mb-0.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Perfil Médico</label>
                                    {selectedWorker?.jobPosition?.defaultProfileId && selectedProfileId === selectedWorker.jobPosition.defaultProfileId && (
                                        <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                                            ✦ Auto por puesto: {selectedWorker.jobPosition.name}
                                        </span>
                                    )}
                                </div>
                                <select
                                    name="serviceProfileId"
                                    value={selectedProfileId}
                                    onChange={(e) => setSelectedProfileId(e.target.value)}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500 p-3 rounded-xl text-sm transition-all outline-none"
                                >
                                    <option value="">Sin perfil asignado</option>
                                    {profiles.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                {!selectedWorker && (
                                    <p className="text-[10px] text-slate-400 ml-1">Selecciona un trabajador para ver los perfiles disponibles.</p>
                                )}
                                {selectedWorker && profiles.length === 0 && (
                                    <p className="text-[10px] text-amber-500 ml-1">⚠️ Esta empresa no tiene perfiles médicos configurados.</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Fecha</label>
                                    <input 
                                        type="date" 
                                        name="date" 
                                        required 
                                        defaultValue={(() => {
                                            const now = new Date(); 
                                            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                        })()}
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
        </>
    )
}
