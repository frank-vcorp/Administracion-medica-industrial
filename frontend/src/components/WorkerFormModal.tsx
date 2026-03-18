'use client'

// IMPL-20260318-01: WorkerFormModal — modo dual (crear/editar) con selector dinámico de Puesto de Trabajo
// IMPL-20260318-09: Manejo explícito de duplicate_found
import { useState, useTransition, useEffect } from 'react'
import { createWorker, updateWorker } from '@/actions/worker.actions'
import { useRouter } from 'next/navigation'
import { EVENTS, OpenAppointmentModalDetail } from '@/types/events'

interface CompanyOption { id: string; name: string }
interface JobPositionOption { id: string; name: string; companyId: string }

/** Datos básicos del trabajador existente cuando se detecta duplicado */
interface DuplicateWorker {
    id: string
    universalId: string | null
    firstName: string
    lastName: string
    dob: Date | null
    email: string | null
    phone: string | null
    company: { id: string; name: string } | null
}

export interface WorkerForEdit {
    id: string
    firstName: string
    lastName: string
    dob?: Date | null
    email?: string | null
    phone?: string | null
    companyId?: string | null
    jobPositionId?: string | null
}

interface WorkerRef {
    id: string
    company?: { id: string; defaultBranchId: string | null } | null
}

interface WorkerFormModalProps {
    companies: CompanyOption[]
    jobPositions: JobPositionOption[]
    /** Si se provee junto con isOpen/onClose, el modal opera en modo edición (controlado por el padre). */
    workerToEdit?: WorkerForEdit | null
    /** Solo en modo controlado (edición): estado de visibilidad que maneja el padre. */
    isOpen?: boolean
    /** Solo en modo controlado (edición): callback para cerrar el modal. */
    onClose?: () => void
}

export default function WorkerFormModal({
    companies,
    jobPositions,
    workerToEdit,
    isOpen: isOpenProp,
    onClose,
}: WorkerFormModalProps) {
    const isControlled = isOpenProp !== undefined
    const [internalOpen, setInternalOpen] = useState(false)
    const modalOpen = isControlled ? isOpenProp! : internalOpen

    const [isPending, startTransition] = useTransition()
    const [successData, setSuccessData] = useState<{ success: boolean; worker?: WorkerRef } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [duplicateWorker, setDuplicateWorker] = useState<DuplicateWorker | null>(null)
    const [selectedCompanyId, setSelectedCompanyId] = useState('')
    const [selectedJobPositionId, setSelectedJobPositionId] = useState('')
    const router = useRouter()

    // Sincroniza los selects controlados cuando cambia el trabajador en edición
    useEffect(() => {
        setSelectedCompanyId(workerToEdit?.companyId || '')
        setSelectedJobPositionId(workerToEdit?.jobPositionId || '')
    }, [workerToEdit?.id])

    const filteredJobPositions = selectedCompanyId
        ? jobPositions.filter(jp => jp.companyId === selectedCompanyId)
        : []

    function handleOpen() {
        setInternalOpen(true)
        setError(null)
        setDuplicateWorker(null)
        setSelectedCompanyId('')
        setSelectedJobPositionId('')
    }

    function handleClose() {
        if (isControlled) {
            onClose?.()
        } else {
            setInternalOpen(false)
            setSuccessData(null)
            setError(null)
        }
    }

    async function handleSubmit(formData: FormData) {
        startTransition(async () => {
            setError(null)
            setDuplicateWorker(null)
            try {
                if (workerToEdit) {
                    const result = await updateWorker(workerToEdit.id, formData) as { success: boolean; error?: string }
                    if (result.success) {
                        router.refresh()
                        onClose?.()
                    } else {
                        setError(result.error || 'Error al guardar')
                    }
                } else {
                    const result = await createWorker(formData) as {
                        success: boolean
                        status?: string
                        worker?: WorkerRef
                        existingWorker?: DuplicateWorker
                        error?: string
                    }
                    // IMPL-20260318-09: Manejar duplicate_found explícitamente
                    if (result.status === 'duplicate_found' && result.existingWorker) {
                        setDuplicateWorker(result.existingWorker)
                        return
                    }
                    if (result.success) {
                        router.refresh()
                        setSuccessData(result)
                    } else {
                        setError(result.error || 'Error al guardar')
                    }
                }
            } catch {
                setError('Error de conexión')
            }
        })
    }

    // Pantalla de duplicado — solo en modo creación (no controlado)
    if (!isControlled && duplicateWorker) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-20 h-20 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto text-4xl">
                            ⚠️
                        </div>
                        <h3 className="text-xl font-black text-slate-800">Trabajador ya existe</h3>
                        <p className="text-slate-500 text-sm">
                            Se encontró un registro existente con los mismos datos. No se creó un duplicado.
                        </p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-200 text-amber-700 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                                👤
                            </div>
                            <div>
                                <p className="font-black text-slate-800">
                                    {duplicateWorker.firstName} {duplicateWorker.lastName}
                                </p>
                                {duplicateWorker.universalId && (
                                    <p className="text-xs font-mono text-slate-500">
                                        ID: {duplicateWorker.universalId}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200 text-xs">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Empresa</p>
                                <p className="font-medium text-slate-700">{duplicateWorker.company?.name || '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</p>
                                <p className="font-medium text-slate-700">{duplicateWorker.phone || '—'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <button
                            onClick={() => {
                                setDuplicateWorker(null)
                                setInternalOpen(false)
                                router.push(`/workers?edit=${duplicateWorker.id}`)
                            }}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02]"
                        >
                            ✏️ Editar Trabajador Existente
                        </button>
                        <button
                            onClick={() => setDuplicateWorker(null)}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Pantalla de éxito solo para modo creación
    if (!isControlled && successData) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-4xl animate-bounce">
                        👤
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800">¡Trabajador Listo!</h3>
                        <p className="text-slate-500 mt-2 text-sm font-medium">El registro se completó correctamente.</p>
                    </div>
                    <div className="space-y-3 pt-2">
                        <button
                            onClick={() => {
                                const w = successData.worker
                                setSuccessData(null)
                                setInternalOpen(false)
                                const params = new URLSearchParams()
                                params.set('action', 'new-appointment')
                                if (w?.id) params.set('workerId', w.id)
                                if (w?.company?.defaultBranchId) params.set('branchId', w.company.defaultBranchId)
                                if (w?.company?.id) params.set('companyId', w.company.id)
                                const event = new CustomEvent<OpenAppointmentModalDetail>(EVENTS.OPEN_APPOINTMENT_MODAL, {
                                    detail: { workerId: w?.id, branchId: w?.company?.defaultBranchId || undefined, companyId: w?.company?.id || undefined }
                                })
                                window.dispatchEvent(event)
                                router.push(`/appointments?${params.toString()}`)
                            }}
                            className="w-full bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02]"
                        >
                            🗓️ Agendar Consulta Aquí
                        </button>
                        <button
                            onClick={() => { setSuccessData(null); setInternalOpen(false) }}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all"
                        >
                            Ver Padrón
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            {/* Botón trigger — solo en modo no controlado (creación) */}
            {!isControlled && (
                <button
                    onClick={handleOpen}
                    className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
                >
                    <span className="text-lg">+</span> Registrar Trabajador
                </button>
            )}

            {modalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-2 ${workerToEdit ? 'bg-amber-500' : 'bg-blue-500'}`} />

                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">
                                    {workerToEdit ? 'Editar Trabajador' : 'Nuevo Trabajador'}
                                </h3>
                                <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-widest mt-1">
                                    {workerToEdit ? 'Actualizar datos en Padrón AMI' : 'Alta en Padrón AMI'}
                                </p>
                            </div>
                            <button onClick={handleClose} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/*
                          key en el form: fuerza re-montaje cuando cambia el trabajador en edición,
                          garantizando que los defaultValue de los inputs uncontrolled se actualicen.
                        */}
                        <form key={workerToEdit?.id || 'new'} action={handleSubmit} className="space-y-4">
                            {/* Nombre y Apellidos */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nombre(s)</label>
                                    <input
                                        name="firstName"
                                        placeholder="Nombre"
                                        required
                                        defaultValue={workerToEdit?.firstName || ''}
                                        className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Apellidos</label>
                                    <input
                                        name="lastName"
                                        placeholder="Apellidos"
                                        required
                                        defaultValue={workerToEdit?.lastName || ''}
                                        className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
                                    />
                                </div>
                            </div>

                            {/* DOB + Género: solo en creación (género necesario para generar universalId) */}
                            {!workerToEdit ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Fecha de Nacimiento</label>
                                        <input name="dob" type="date" required className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Género</label>
                                        <select name="gender" required className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none appearance-none">
                                            <option value="M">Masculino</option>
                                            <option value="F">Femenino</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Fecha de Nacimiento</label>
                                    <input
                                        name="dob"
                                        type="date"
                                        defaultValue={workerToEdit.dob ? new Date(workerToEdit.dob).toISOString().split('T')[0] : ''}
                                        className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
                                    />
                                </div>
                            )}

                            {/* Empresa (controlado — dispara filtrado de puestos) */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Empresa</label>
                                <select
                                    name="companyId"
                                    value={selectedCompanyId}
                                    onChange={e => {
                                        setSelectedCompanyId(e.target.value)
                                        setSelectedJobPositionId('')
                                    }}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none appearance-none"
                                >
                                    <option value="">-- Seleccionar Empresa --</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Puesto de Trabajo (dinámico según empresa seleccionada) */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Puesto de Trabajo</label>
                                <select
                                    name="jobPositionId"
                                    value={selectedJobPositionId}
                                    onChange={e => setSelectedJobPositionId(e.target.value)}
                                    disabled={!selectedCompanyId}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">
                                        {selectedCompanyId ? '-- Seleccionar Puesto --' : '← Selecciona primero una empresa'}
                                    </option>
                                    {filteredJobPositions.map(jp => (
                                        <option key={jp.id} value={jp.id}>{jp.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Email y Teléfono */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
                                    <input
                                        name="email"
                                        placeholder="email@ejemplo.com"
                                        type="email"
                                        defaultValue={workerToEdit?.email || ''}
                                        className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Teléfono</label>
                                    <input
                                        name="phone"
                                        placeholder="10 dígitos"
                                        defaultValue={workerToEdit?.phone || ''}
                                        className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
                                    />
                                </div>
                            </div>

                            {/* Banner ID Universal (solo creación) */}
                            {!workerToEdit && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">🆔</div>
                                        <div>
                                            <p className="text-[10px] font-black text-blue-600 uppercase">Seguridad AMI</p>
                                            <p className="text-[9px] text-blue-400 font-bold uppercase tracking-tighter">ID Universal se generará automáticamente</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-lg border border-red-100 italic">⚠️ {error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={isPending}
                                className={`w-full ${workerToEdit
                                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                                } text-white py-4 rounded-2xl font-black shadow-lg transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 mt-4`}
                            >
                                {isPending ? 'Procesando...' : workerToEdit ? 'Actualizar Trabajador' : 'Guardar Trabajador'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
