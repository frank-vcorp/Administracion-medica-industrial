'use client'

import { useEffect, useState } from 'react'
import { getAppointments } from '@/actions/appointment.actions'
import { checkInAppointment } from '@/actions/appointment.actions'

/**
 * Página de Gestión de Citas (Appointments)
 * Lista todas las citas y permite hacer check-in
 * 
 * IMPL-20260225-06-UI: Implementación de UI Sprint 7
 */
export default function AppointmentsPage() {
    const [appointments, setAppointments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [checkingIn, setCheckingIn] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState('')

    useEffect(() => {
        async function loadAppointments() {
            try {
                const result = await getAppointments()
                if (result.success) {
                    setAppointments(result.appointments || [])
                } else {
                    setError(result.error || 'Error al cargar citas')
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error desconocido')
            } finally {
                setLoading(false)
            }
        }

        loadAppointments()
    }, [])

    async function handleCheckIn(appointmentId: string) {
        try {
            setCheckingIn(appointmentId)
            setSuccessMessage('')

            const result = await checkInAppointment(appointmentId)

            if (result.success) {
                setSuccessMessage(`Check-in realizado para ${result.medicalEvent?.worker?.firstName} ${result.medicalEvent?.worker?.lastName}`)
                // Recargar citas después del check-in
                setTimeout(() => {
                    window.location.reload()
                }, 2000)
            } else {
                setError(result.error || 'Error al hacer check-in')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido')
        } finally {
            setCheckingIn(null)
        }
    }

    if (loading) {
        return <div className="text-center py-8">Cargando citas...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Gestión de Citas</h2>
                <span className="text-sm text-slate-500">{appointments.length} cita(s) registrada(s)</span>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
                    ✓ {successMessage}
                </div>
            )}

            {appointments.length === 0 ? (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
                    No hay citas registradas
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Trabajador</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Empresa</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Sucursal</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Fecha/Hora</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {appointments.map((apt: any) => (
                                <tr key={apt.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-900">
                                        <div>
                                            <p className="font-medium">{apt.worker?.firstName} {apt.worker?.lastName}</p>
                                            <p className="text-xs text-slate-500">{apt.worker?.universalId}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">
                                        {apt.company?.name || '—'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">
                                        {apt.branch?.name || '—'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">
                                        {new Date(apt.scheduledAt).toLocaleString('es-ES')}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <StatusBadge status={apt.status} />
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {apt.status === 'SCHEDULED' ? (
                                            <button
                                                onClick={() => handleCheckIn(apt.id)}
                                                disabled={checkingIn === apt.id}
                                                className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {checkingIn === apt.id ? 'Procesando...' : 'Check-in'}
                                            </button>
                                        ) : (
                                            <span className="text-xs text-slate-500">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        SCHEDULED: 'bg-blue-100 text-blue-800',
        CONFIRMED: 'bg-green-100 text-green-800',
        COMPLETED: 'bg-emerald-100 text-emerald-800',
        CANCELLED: 'bg-red-100 text-red-800',
        NO_SHOW: 'bg-orange-100 text-orange-800',
    }

    const labels: Record<string, string> = {
        SCHEDULED: 'Programada',
        CONFIRMED: 'Confirmada',
        COMPLETED: 'Completada',
        CANCELLED: 'Cancelada',
        NO_SHOW: 'No presentado',
    }

    return (
        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
            {labels[status] || status}
        </span>
    )
}
