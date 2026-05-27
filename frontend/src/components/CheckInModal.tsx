'use client'

/**
 * @intervention IMPL-20260527-01
 * @see context/SPECs/SPEC_ARCH-20260527-24-BUSQUEDA-EXTERNA-SERVER-SIDE-Y-REUTILIZACION.md
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent, createExternalWalkInEvent } from '@/actions/event.actions'
import { createExternalWorkerIntake, searchExternalIntakeCandidates } from '@/actions/worker.actions'

interface Worker {
    id: string
    firstName: string
    lastName: string
    company?: { name: string } | null
}

interface Branch {
    id: string
    name: string
}

interface ExternalSearchCandidate {
    id: string
    firstName: string
    lastName: string
    dob: string | null
    company: { name: string } | null
}

function formatExternalDobLabel(dob: string | null) {
    if (!dob) return null

    const parsed = new Date(dob)
    if (Number.isNaN(parsed.getTime())) return null

    return parsed.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
}

export default function CheckInModal({ workers, branches }: { workers: Worker[], branches: Branch[] }) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<'existing' | 'external'>('existing')
    const [externalQuery, setExternalQuery] = useState('')
    const [selectedExternalWorkerId, setSelectedExternalWorkerId] = useState('')
    const [requireForceExternalCreate, setRequireForceExternalCreate] = useState(false)
    const [externalCandidates, setExternalCandidates] = useState<ExternalSearchCandidate[]>([])
    const [isSearchingExternal, setIsSearchingExternal] = useState(false)
    const [hasExternalSearch, setHasExternalSearch] = useState(false)
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastSearchRequestRef = useRef(0)

    const resetExternalState = () => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
            searchTimeoutRef.current = null
        }

        lastSearchRequestRef.current += 1
        setExternalQuery('')
        setSelectedExternalWorkerId('')
        setRequireForceExternalCreate(false)
        setExternalCandidates([])
        setIsSearchingExternal(false)
        setHasExternalSearch(false)
    }

    const handleExternalQueryChange = (value: string) => {
        const normalizedQuery = value.replace(/\s+/g, ' ').trim()
        const requestId = lastSearchRequestRef.current + 1

        lastSearchRequestRef.current = requestId
        setExternalQuery(value)
        setSelectedExternalWorkerId('')
        setRequireForceExternalCreate(false)
        setError(null)

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
            searchTimeoutRef.current = null
        }

        if (normalizedQuery.length < 2) {
            setExternalCandidates([])
            setIsSearchingExternal(false)
            setHasExternalSearch(false)
            return
        }

        setIsSearchingExternal(true)
        searchTimeoutRef.current = setTimeout(async () => {
            const result = await searchExternalIntakeCandidates(normalizedQuery)

            if (requestId !== lastSearchRequestRef.current) {
                return
            }

            if (result.success) {
                setExternalCandidates(result.candidates)
                setHasExternalSearch(true)
                setIsSearchingExternal(false)
                return
            }

            setExternalCandidates([])
            setHasExternalSearch(true)
            setIsSearchingExternal(false)
            setError(result.error || 'No se pudo buscar en la base de personas existentes.')
        }, 250)
    }

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)

        if (mode === 'external') {
            return
        }

        const formData = new FormData(e.currentTarget)
        const workerId = formData.get('workerId') as string

        if (!workerId) {
            setError('Selecciona un trabajador')
            return
        }

        startTransition(async () => {
            const result = await createEvent(formData)
            if (result.success) {
                setOpen(false)
                router.refresh()
            } else {
                setError(result.error || 'Error al crear el expediente')
            }
        })
    }

    async function handleExternalSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)

        const formData = new FormData(e.currentTarget)
        const branchId = formData.get('branchId') as string

        if (!branchId) {
            setError('Selecciona una sucursal para ingreso externo.')
            return
        }

        startTransition(async () => {
            let workerId = selectedExternalWorkerId

            if (!workerId) {
                const created = await createExternalWorkerIntake({
                    firstName: String(formData.get('firstName') || ''),
                    lastName: String(formData.get('lastName') || ''),
                    dob: String(formData.get('dob') || ''),
                    nationalId: String(formData.get('nationalId') || ''),
                    phone: String(formData.get('phone') || ''),
                    email: String(formData.get('email') || ''),
                    forceCreate: requireForceExternalCreate,
                })

                if (!created.success || !created.workerId) {
                    if (created.status === 'ambiguous_match') {
                        setRequireForceExternalCreate(true)
                    }
                    setError(created.error || 'No se pudo preparar el ingreso externo.')
                    return
                }
                workerId = created.workerId
            }

            const eventResult = await createExternalWalkInEvent({ workerId, branchId })
            if (!eventResult.success || !eventResult.eventId) {
                setError(eventResult.error || 'No se pudo registrar el ingreso externo.')
                return
            }

            setOpen(false)
            router.push(`/events/${eventResult.eventId}`)
            router.refresh()
        })
    }

    const externalCandidates = workers
        .filter((worker) => !worker.company)
        .filter((worker) => {
            const q = externalQuery.trim().toLowerCase()
            if (!q) return true
            const name = `${worker.firstName} ${worker.lastName}`.toLowerCase()
            return name.includes(q)
        })
        .slice(0, 8)

    return (
        <>
            <button
                onClick={() => {
                    setMode('existing')
                    setError(null)
                    resetExternalState()
                    setOpen(true)
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2"
            >
                <span>➕</span> Nueva Cita / Ingreso
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Ingreso de Paciente</h3>
                            <button
                                onClick={() => setOpen(false)}
                                className="text-slate-400 hover:text-red-500 font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1">
                            <button
                                type="button"
                                onClick={() => setMode('existing')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${mode === 'existing' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                Trabajador existente
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMode('external')
                                    setError(null)
                                    resetExternalState()
                                }}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${mode === 'external' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                Ingreso externo
                            </button>
                        </div>

                        {mode === 'existing' ? (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">
                                        Seleccionar Trabajador
                                    </label>
                                    <select
                                        name="workerId"
                                        required
                                        className="w-full border p-2 rounded bg-white"
                                    >
                                        <option value="">Buscar por nombre...</option>
                                        {workers.map(w => (
                                            <option key={w.id} value={w.id}>
                                                {w.firstName} {w.lastName} ({w.company?.name || 'Sin Empresa'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Sucursal</label>
                                    <select name="branchId" className="w-full border p-2 rounded bg-white">
                                        <option value="">Auto (primera disponible)</option>
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-700 p-2 rounded text-sm border border-red-200">
                                        ⚠️ {error}
                                    </div>
                                )}

                                <div className="flex justify-end pt-4">
                                    <button
                                        type="submit"
                                        disabled={isPending}
                                        className="bg-slate-900 text-white px-4 py-2 rounded shadow hover:bg-slate-800 font-medium w-full disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {isPending ? '⏳ Registrando...' : 'Confirmar Check-In 🏥'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleExternalSubmit} className="space-y-4">
                                <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                                    <label className="text-xs font-bold text-blue-700 block">Buscar externo existente</label>
                                    <input
                                        value={externalQuery}
                                        onChange={(event) => handleExternalQueryChange(event.target.value)}
                                        placeholder="Nombre o apellido"
                                        className="w-full rounded border border-blue-200 px-3 py-2 text-sm"
                                    />
                                    <div className="max-h-28 space-y-1 overflow-auto">
                                        {isSearchingExternal && (
                                            <div className="rounded border border-blue-100 bg-white/70 px-2 py-2 text-xs text-blue-700">
                                                Buscando coincidencias reales...
                                            </div>
                                        )}
                                        {!isSearchingExternal && externalCandidates.map((candidate) => {
                                            const dobLabel = formatExternalDobLabel(candidate.dob)

                                            return (
                                                <button
                                                    key={candidate.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedExternalWorkerId(candidate.id)
                                                        setRequireForceExternalCreate(false)
                                                        setError(null)
                                                    }}
                                                    className={`w-full rounded border px-2 py-1 text-left text-xs ${selectedExternalWorkerId === candidate.id ? 'border-blue-300 bg-white text-blue-700' : 'border-blue-100 bg-white/70 text-slate-700'}`}
                                                >
                                                    <div className="font-semibold">
                                                        {candidate.firstName} {candidate.lastName}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {candidate.company?.name || 'Sin empresa'}
                                                        {dobLabel ? ` · Nac. ${dobLabel}` : ''}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                        {!isSearchingExternal && hasExternalSearch && externalCandidates.length === 0 && (
                                            <div className="rounded border border-dashed border-blue-200 bg-white/70 px-2 py-2 text-xs text-slate-600">
                                                No hubo coincidencias en base de datos. Puedes continuar con el alta mínima.
                                            </div>
                                        )}
                                        {!isSearchingExternal && !hasExternalSearch && externalQuery.trim().length > 0 && externalQuery.trim().length < 2 && (
                                            <div className="rounded border border-dashed border-blue-200 bg-white/70 px-2 py-2 text-xs text-slate-600">
                                                Escribe al menos 2 caracteres para consultar la base de personas existentes.
                                            </div>
                                        )}
                                    </div>
                                    {selectedExternalWorkerId && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedExternalWorkerId('')}
                                            className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
                                        >
                                            Quitar selección y capturar alta mínima
                                        </button>
                                    )}
                                </div>

                                {!selectedExternalWorkerId && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input name="firstName" placeholder="Nombre(s)*" className="rounded border border-slate-300 px-3 py-2 text-sm" required />
                                        <input name="lastName" placeholder="Apellido(s)*" className="rounded border border-slate-300 px-3 py-2 text-sm" required />
                                        <input name="dob" type="date" className="rounded border border-slate-300 px-3 py-2 text-sm" />
                                        <input name="nationalId" placeholder="CURP o ID" className="rounded border border-slate-300 px-3 py-2 text-sm" />
                                        <input name="phone" placeholder="Teléfono" className="rounded border border-slate-300 px-3 py-2 text-sm" />
                                        <input name="email" placeholder="Correo" className="rounded border border-slate-300 px-3 py-2 text-sm" />
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-1">Sucursal</label>
                                    <select name="branchId" required className="w-full border p-2 rounded bg-white">
                                        <option value="">Seleccionar sucursal...</option>
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {requireForceExternalCreate && !selectedExternalWorkerId && (
                                    <label className="flex items-center gap-2 text-xs text-amber-700">
                                        <input
                                            type="checkbox"
                                            checked={requireForceExternalCreate}
                                            onChange={(event) => setRequireForceExternalCreate(event.target.checked)}
                                        />
                                        Confirmo crear nuevo externo aunque exista coincidencia por nombre.
                                    </label>
                                )}

                                {error && (
                                    <div className="bg-red-50 text-red-700 p-2 rounded text-sm border border-red-200">
                                        ⚠️ {error}
                                    </div>
                                )}

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={isPending}
                                        className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white shadow transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50"
                                    >
                                        {isPending ? '⏳ Registrando externo...' : 'Confirmar ingreso externo'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
