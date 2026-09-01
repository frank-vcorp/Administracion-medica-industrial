'use client'

// IMPL-20260318-01: WorkerFormModal — modo dual (crear/editar)
// Perfil médico por empresa (sustituye puesto de trabajo en alta de paciente)
import { useState, useTransition, useEffect } from 'react'
import { createWorker, updateWorker } from '@/actions/worker.actions'
import { useRouter } from 'next/navigation'
import { EVENTS, OpenAppointmentModalDetail } from '@/types/events'
import { isPublicGeneralCompany } from '@/lib/public-general-company'
import { createPublicGeneralQuickProfile } from '@/actions/medical-profiles'
import PublicGeneralProfilePicker, {
  type AvailableTestOption,
  type ProfileMode,
} from '@/components/public-general/PublicGeneralProfilePicker'

interface CompanyOption {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    rfc?: string | null
}
interface MedicalProfileOption { id: string; name: string; companyId: string | null }

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
    medicalProfileId?: string | null
}

interface WorkerRef {
    id: string
    company?: { id: string; defaultBranchId: string | null } | null
}

interface WorkerFormModalProps {
    companies: CompanyOption[]
    medicalProfiles: MedicalProfileOption[]
    /** Si se provee junto con isOpen/onClose, el modal opera en modo edición (controlado por el padre). */
    workerToEdit?: WorkerForEdit | null
    /** Solo en modo controlado (edición): estado de visibilidad que maneja el padre. */
    isOpen?: boolean
    /** Solo en modo controlado (edición): callback para cerrar el modal. */
    onClose?: () => void
    /** Alta fija en empresa Público General (oculta selector de empresa). */
    publicGeneralMode?: boolean
    /** Empresa preseleccionada al abrir (p. ej. Público General). */
    defaultCompanyId?: string
    /** Oculta el botón trigger por defecto (el padre abre con isOpen). */
    hideDefaultTrigger?: boolean
    /** Catálogo de pruebas para perfil rápido (solo publicGeneralMode). */
    availableTests?: AvailableTestOption[]
}

function profilesForCompany(
    profiles: MedicalProfileOption[],
    companyId: string
): MedicalProfileOption[] {
    return profiles.filter(
        (p) => p.companyId === companyId || p.companyId === null
    )
}

export default function WorkerFormModal({
    companies,
    medicalProfiles,
    workerToEdit,
    isOpen: isOpenProp,
    onClose,
    publicGeneralMode = false,
    defaultCompanyId,
    hideDefaultTrigger = false,
    availableTests = [],
}: WorkerFormModalProps) {
    const isControlled = isOpenProp !== undefined
    const [internalOpen, setInternalOpen] = useState(false)
    const modalOpen = isControlled ? isOpenProp! : internalOpen

    const [isPending, startTransition] = useTransition()
    const [successData, setSuccessData] = useState<{ success: boolean; worker?: WorkerRef } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [duplicateWorker, setDuplicateWorker] = useState<DuplicateWorker | null>(null)
    const [selectedCompanyId, setSelectedCompanyId] = useState('')
    const [selectedMedicalProfileId, setSelectedMedicalProfileId] = useState('')
    const [contactEmail, setContactEmail] = useState('')
    const [contactPhone, setContactPhone] = useState('')
    const [pgProfileMode, setPgProfileMode] = useState<ProfileMode>('existing')
    const [pgQuickTestIds, setPgQuickTestIds] = useState<string[]>([])
    const [pgCustomProfileName, setPgCustomProfileName] = useState('')
    const router = useRouter()

    const isCreateMode = !workerToEdit
    const accentBarClass = workerToEdit ? 'bg-amber-500' : publicGeneralMode ? 'bg-teal-500' : 'bg-blue-500'
    const submitButtonClass = workerToEdit
        ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100'
        : publicGeneralMode
            ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-100'
            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'

    /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- hidratación controlada al cambiar `workerToEdit`. */
    useEffect(() => {
        setSelectedCompanyId(workerToEdit?.companyId || '')
        setSelectedMedicalProfileId(workerToEdit?.medicalProfileId || '')
        setContactEmail(workerToEdit?.email || '')
        setContactPhone(workerToEdit?.phone || '')
    }, [workerToEdit?.id])

    useEffect(() => {
        if (!modalOpen || workerToEdit) return
        if (publicGeneralMode && defaultCompanyId) {
            setSelectedCompanyId(defaultCompanyId)
            setSelectedMedicalProfileId('')
            setContactEmail('')
            setContactPhone('')
            setPgProfileMode('existing')
            setPgQuickTestIds([])
            setPgCustomProfileName('')
        }
    }, [modalOpen, publicGeneralMode, defaultCompanyId, workerToEdit])

    useEffect(() => {
        if (!isCreateMode || publicGeneralMode || !selectedCompanyId) return
        const company = companies.find((c) => c.id === selectedCompanyId)
        if (!company || isPublicGeneralCompany(company)) {
            setContactEmail('')
            setContactPhone('')
            return
        }
        setContactEmail(company.email || '')
        setContactPhone(company.phone || '')
    }, [selectedCompanyId, companies, isCreateMode, publicGeneralMode])

    const filteredMedicalProfiles = selectedCompanyId
        ? profilesForCompany(medicalProfiles, selectedCompanyId)
        : []

    function handleOpen() {
        setInternalOpen(true)
        setError(null)
        setDuplicateWorker(null)
        setSelectedCompanyId(publicGeneralMode && defaultCompanyId ? defaultCompanyId : '')
        setSelectedMedicalProfileId('')
        setContactEmail('')
        setContactPhone('')
        setPgProfileMode('existing')
        setPgQuickTestIds([])
        setPgCustomProfileName('')
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
                    let submitFormData = formData

                    if (publicGeneralMode && defaultCompanyId) {
                        if (pgProfileMode === 'quick') {
                            if (pgQuickTestIds.length === 0) {
                                setError('Selecciona al menos una prueba para el perfil rápido')
                                return
                            }
                            const profileResult = await createPublicGeneralQuickProfile({
                                companyId: defaultCompanyId,
                                testIds: pgQuickTestIds,
                                name: pgCustomProfileName.trim() || null,
                            })
                            if (!profileResult.success) {
                                setError(profileResult.error || 'No se pudo crear el perfil rápido')
                                return
                            }
                            if (!profileResult.data) {
                                setError('No se pudo crear el perfil rápido')
                                return
                            }
                            submitFormData = new FormData()
                            for (const [key, value] of formData.entries()) {
                                if (key !== 'medicalProfileId') {
                                    submitFormData.append(key, value)
                                }
                            }
                            submitFormData.set('medicalProfileId', profileResult.data.id)
                            setSelectedMedicalProfileId(profileResult.data.id)
                        } else if (!selectedMedicalProfileId) {
                            setError('Selecciona un perfil médico existente')
                            return
                        }
                    }

                    const result = await createWorker(submitFormData) as {
                        success: boolean
                        status?: string
                        worker?: WorkerRef
                        existingWorker?: DuplicateWorker
                        error?: string
                    }
                    if (result.status === 'duplicate_found' && result.existingWorker) {
                        setDuplicateWorker(result.existingWorker)
                        return
                    }
                    if (result.success) {
                        router.refresh()
                        if (isControlled) {
                            onClose?.()
                        } else {
                            setSuccessData(result)
                        }
                    } else {
                        setError(result.error || 'Error al guardar')
                    }
                }
            } catch {
                setError('Error de conexión')
            }
        })
    }

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
                            onClick={() => {
                                setSuccessData(null)
                                setInternalOpen(false)
                                if (publicGeneralMode) {
                                    router.push('/publico-general')
                                }
                            }}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all"
                        >
                            {publicGeneralMode ? 'Ver listado' : 'Ver Padrón'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            {!isControlled && !hideDefaultTrigger && (
                <button
                    onClick={handleOpen}
                    className={`${publicGeneralMode
                        ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-200'
                        : 'bg-slate-900 hover:bg-black shadow-slate-200'
                    } text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2`}
                >
                    <span className="text-lg">+</span>{' '}
                    {publicGeneralMode ? 'Alta público general' : 'Registrar Trabajador'}
                </button>
            )}

            {modalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className={`bg-white p-8 rounded-3xl shadow-2xl w-full border border-slate-100 relative overflow-hidden ${publicGeneralMode && isCreateMode ? 'max-w-lg max-h-[90vh] overflow-y-auto' : 'max-w-md'}`}>
                        <div className={`absolute top-0 left-0 w-full h-2 ${accentBarClass}`} />

                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">
                                    {workerToEdit
                                        ? 'Editar Trabajador'
                                        : publicGeneralMode
                                            ? 'Alta público general'
                                            : 'Nuevo Trabajador'}
                                </h3>
                                <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-widest mt-1">
                                    {workerToEdit
                                        ? 'Actualizar datos en Padrón AMI'
                                        : publicGeneralMode
                                            ? 'Paciente particular · Público General'
                                            : 'Alta en Padrón AMI'}
                                </p>
                            </div>
                            <button onClick={handleClose} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form key={workerToEdit?.id || 'new'} action={handleSubmit} className="space-y-4">
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

                            {publicGeneralMode && !workerToEdit ? (
                                <>
                                    <input type="hidden" name="companyId" value={selectedCompanyId} />
                                    <div className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs text-teal-800">
                                        Empresa fija: <strong>Público General</strong>
                                    </div>
                                    {pgProfileMode === 'existing' && (
                                        <input type="hidden" name="medicalProfileId" value={selectedMedicalProfileId} />
                                    )}
                                    <PublicGeneralProfilePicker
                                        companyId={selectedCompanyId}
                                        medicalProfiles={medicalProfiles}
                                        availableTests={availableTests}
                                        selectedProfileId={selectedMedicalProfileId}
                                        onProfileIdChange={setSelectedMedicalProfileId}
                                        selectedTestIds={pgQuickTestIds}
                                        onTestIdsChange={setPgQuickTestIds}
                                        customProfileName={pgCustomProfileName}
                                        onCustomProfileNameChange={setPgCustomProfileName}
                                        mode={pgProfileMode}
                                        onModeChange={setPgProfileMode}
                                    />
                                </>
                            ) : (
                                <>
                                    {!publicGeneralMode || workerToEdit ? (
                                        publicGeneralMode && workerToEdit ? (
                                            <input type="hidden" name="companyId" value={selectedCompanyId} />
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Empresa</label>
                                                <select
                                                    name="companyId"
                                                    value={selectedCompanyId}
                                                    onChange={e => {
                                                        setSelectedCompanyId(e.target.value)
                                                        setSelectedMedicalProfileId('')
                                                    }}
                                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none appearance-none"
                                                >
                                                    <option value="">-- Seleccionar Empresa --</option>
                                                    {companies.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )
                                    ) : null}

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Perfil Médico</label>
                                        <select
                                            name="medicalProfileId"
                                            value={selectedMedicalProfileId}
                                            onChange={e => setSelectedMedicalProfileId(e.target.value)}
                                            disabled={!selectedCompanyId}
                                            required={!!selectedCompanyId}
                                            className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500 p-3 rounded-xl text-sm outline-none appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value="">
                                                {selectedCompanyId ? '-- Seleccionar Perfil --' : '← Selecciona primero una empresa'}
                                            </option>
                                            {filteredMedicalProfiles.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
                                    <input
                                        name="email"
                                        placeholder="email@ejemplo.com"
                                        type="email"
                                        value={isCreateMode ? contactEmail : undefined}
                                        defaultValue={!isCreateMode ? (workerToEdit?.email || '') : undefined}
                                        onChange={isCreateMode ? (e) => setContactEmail(e.target.value) : undefined}
                                        className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Teléfono</label>
                                    <input
                                        name="phone"
                                        placeholder="10 dígitos"
                                        value={isCreateMode ? contactPhone : undefined}
                                        defaultValue={!isCreateMode ? (workerToEdit?.phone || '') : undefined}
                                        onChange={isCreateMode ? (e) => setContactPhone(e.target.value) : undefined}
                                        className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 p-3 rounded-xl text-sm outline-none"
                                    />
                                </div>
                            </div>

                            {!workerToEdit && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">🆔</div>
                                        <div>
                                            <p className="text-[10px] font-black text-blue-600 uppercase">Seguridad AMI</p>
                                            <p className="text-[9px] text-blue-400 font-bold uppercase tracking-tighter">ID se generará automáticamente</p>
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
                                className={`w-full ${submitButtonClass} text-white py-4 rounded-2xl font-black shadow-lg transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 mt-4`}
                            >
                                {isPending
                                    ? 'Procesando...'
                                    : workerToEdit
                                        ? 'Actualizar Trabajador'
                                        : publicGeneralMode
                                            ? 'Guardar paciente particular'
                                            : 'Guardar Trabajador'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
