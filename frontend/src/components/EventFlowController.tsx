'use client'

import { useState, useTransition } from 'react'
import { updateEventStatus } from '@/actions/medical-event.actions'
import { signMedicalDictamPDF } from '@/actions/signature.actions'
import { useRouter } from 'next/navigation'

interface EventFlowControllerProps {
    eventId: string
    currentStatus: string
    hasVerdict: boolean
    verdictData?: {
        finalDiagnosis?: string
        recommendations?: string
    }
}

export default function EventFlowController({
    eventId,
    currentStatus,
    hasVerdict,
    verdictData
}: EventFlowControllerProps) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    // Status logic
    const isInProgress = currentStatus === 'IN_PROGRESS' || currentStatus === 'CHECKED_IN' || currentStatus === 'SCHEDULED'
    const isValidating = currentStatus === 'VALIDATING'
    const isCompleted = currentStatus === 'COMPLETED'

    const handleFinishCapture = () => {
        startTransition(async () => {
            try {
                // In a real app we might want to save some initial verdict draft here
                await updateEventStatus(eventId, 'VALIDATING')
                router.refresh()
            } catch (e) {
                setError('Error al cambiar estado')
            }
        })
    }

    const handleSign = () => {
        startTransition(async () => {
            try {
                const result = await signMedicalDictamPDF(eventId)
                if (result.success) {
                    router.refresh()
                } else {
                    setError(result.error || 'Error al firmar')
                }
            } catch (e) {
                setError('Error de conexión al firmar')
            }
        })
    }

    return (
        <div className="mt-12 p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="max-w-3xl mx-auto text-center">

                {/* 1. SECCIÓN: CARGA EN CURSO */}
                {isInProgress && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl mb-4 shadow-inner">
                            📄
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">Fase de Captura de Estudios</h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                            Una vez que hayas subido toda la documentación del paciente (SIM y NOVA), presiona el botón para pasar a la validación médica.
                        </p>
                        <button
                            onClick={handleFinishCapture}
                            disabled={isPending}
                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2 mx-auto"
                        >
                            {isPending ? 'Procesando...' : '✅ Finalizar Captura e Ir a Validación'}
                        </button>
                    </div>
                )}

                {/* 2. SECCIÓN: VALIDACIÓN Y FIRMA (El médico llena el diagnóstico) */}
                {isValidating && (
                    <div className="space-y-6 text-left animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-xl">
                                🩺
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Dictamen Médico Final</h3>
                                <p className="text-sm text-slate-500">Completa la evaluación para generar el certificado firmado.</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Diagnóstico Final</label>
                                <textarea
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none min-h-[100px]"
                                    placeholder="Ej: Apto para el puesto sin restricciones..."
                                    defaultValue={verdictData?.finalDiagnosis}
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Recomendaciones</label>
                                <textarea
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="Ej: Uso de protección auditiva..."
                                    defaultValue={verdictData?.recommendations}
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-4 pt-4">
                            <button
                                onClick={handleSign}
                                disabled={isPending}
                                className="w-full max-w-sm bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-xl font-bold shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isPending ? 'Generando Firma Digital...' : '🔏 Firmar y Emitir Dictamen'}
                            </button>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <span className="text-emerald-500">🔒</span> Se aplicará sello digital del Dr. Usuario Demo
                            </p>
                        </div>
                    </div>
                )}

                {/* 3. SECCIÓN: COMPLETADO */}
                {isCompleted && (
                    <div className="space-y-6 animate-in fade-in fill-mode-both duration-700">
                        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl mb-4 shadow-sm border-4 border-white">
                            ✨
                        </div>
                        <div>
                            <h3 className="text-3xl font-extrabold text-slate-900">¡Expediente Completado!</h3>
                            <p className="text-slate-500 mt-2">El dictamen médico ha sido firmado y está listo para descarga.</p>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 justify-center pt-4">
                            <a
                                href={`/api/pdf/${eventId}`}
                                target="_blank"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2"
                            >
                                ⬇️ Descargar Dictamen (PDF)
                            </a>
                            <button
                                onClick={() => router.push('/reception')}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-8 py-4 rounded-xl font-bold transition-all"
                            >
                                Volver a Recepción
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 italic">
                        ⚠️ {error}
                    </div>
                )}

            </div>
        </div>
    )
}
