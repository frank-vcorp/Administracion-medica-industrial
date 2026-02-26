'use client'

import { useEffect, useState } from 'react'
import { getAuditLogs } from '@/actions/audit.actions'

/**
 * Página de Bitácora de Auditoría (Audit Logs)
 * Lista todos los registros de auditoría del sistema
 * 
 * IMPL-20260225-06-UI: Implementación de UI Sprint 7
 */
export default function AuditPage() {
    const [logs, setLogs] = useState<{ id: string, action: string, entity: string, entityId: string | null, createdAt: Date, details: Record<string, any> | null, user: { fullName: string | null, email: string | null } | null }[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [offset, setOffset] = useState(0)
    const pageSize = 50

    useEffect(() => {
        async function loadAuditLogs() {
            try {
                const result = await getAuditLogs(pageSize, offset)
                if (result.success) {
                    setLogs((result.logs as unknown as any) || [])
                } else {
                    setError(result.error || 'Error al cargar auditoría')
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error desconocido')
            } finally {
                setLoading(false)
            }
        }

        loadAuditLogs()
    }, [offset])

    if (loading) {
        return <div className="text-center py-8">Cargando registros de auditoría...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Bitácora de Auditoría</h2>
                <span className="text-sm text-slate-500">{logs.length} registro(s) cargado(s)</span>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    {error}
                </div>
            )}

            {logs.length === 0 ? (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500">
                    No hay registros de auditoría
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Usuario</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Acción</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Entidad</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">ID Entidad</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Fecha/Hora</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-900">
                                        <div>
                                            <p className="font-medium">{log.user?.fullName || 'Sistema'}</p>
                                            <p className="text-xs text-slate-500">{log.user?.email || '—'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <ActionBadge action={log.action} />
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">
                                        {log.entity}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono text-slate-600 text-xs">
                                        {log.entityId ? log.entityId.substring(0, 8) + '...' : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">
                                        {new Date(log.createdAt).toLocaleString('es-ES')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">
                                        {log.details ? (
                                            <details className="cursor-pointer">
                                                <summary className="text-blue-600 hover:underline">Ver</summary>
                                                <pre className="mt-2 p-2 bg-slate-50 rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap break-words">
                                                    {JSON.stringify(log.details, null, 2)}
                                                </pre>
                                            </details>
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setOffset(Math.max(0, offset - pageSize))}
                    disabled={offset === 0}
                    className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-300 transition-colors"
                >
                    ← Anterior
                </button>
                <span className="text-sm text-slate-600">
                    Mostrando desde registro {offset + 1}
                </span>
                <button
                    onClick={() => setOffset(offset + pageSize)}
                    disabled={logs.length < pageSize}
                    className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-300 transition-colors"
                >
                    Siguiente →
                </button>
            </div>
        </div>
    )
}

function ActionBadge({ action }: { action: string }) {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
        CREATE: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '➕' },
        UPDATE: { bg: 'bg-purple-100', text: 'text-purple-800', icon: '✏️' },
        DELETE: { bg: 'bg-red-100', text: 'text-red-800', icon: '🗑️' },
        LOGIN: { bg: 'bg-green-100', text: 'text-green-800', icon: '🔐' },
        CHECK_IN: { bg: 'bg-teal-100', text: 'text-teal-800', icon: '✅' },
        VIEW: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '👁️' },
    }

    const config = colors[action] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: '•' }

    return (
        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
            <span className="mr-1">{config.icon}</span>
            {action}
        </span>
    )
}
