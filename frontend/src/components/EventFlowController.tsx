'use client'

import { useState, useTransition, useRef } from 'react'
import { updateEventStatus, saveVerdict } from '@/actions/medical-event.actions'
import { signMedicalDictamPDF } from '@/actions/signature.actions'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

interface EventFlowControllerProps {
    eventId: string
    currentStatus: string
    verdictData?: {
        finalDiagnosis?: string
        recommendations?: string
    }
}

export default function EventFlowController({
    eventId,
    currentStatus,
    verdictData
}: EventFlowControllerProps) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const { data: session } = useSession()

    const diagRef = useRef<HTMLTextAreaElement>(null)
    const recRef = useRef<HTMLTextAreaElement>(null)

    // Status logic
    // MODIFICADO: Fase de carga solo debe aparecer si ya es estrictamente IN_PROGRESS para que no manche las demás etapas
    const isInProgress = currentStatus === 'IN_PROGRESS'
    const isValidating = currentStatus === 'VALIDATING'
    const isCompleted = currentStatus === 'COMPLETED'

    const handleFinishCapture = () => {
        startTransition(async () => {
            try {
                await updateEventStatus(eventId, 'VALIDATING')
                router.refresh()
            } catch {
                setError('Error al cambiar estado')
            }
        })
    }

    const handleSign = () => {
        if (!session?.user?.id) {
            setError('No se pudo identificar al validador')
            return
        }

        const diagnosis = diagRef.current?.value || ''
        if (!diagnosis) {
            setError('El diagnóstico es obligatorio para firmar')
            return
        }

        startTransition(async () => {
            try {
                // 1. Save verdict synchronously
                const recommendations = recRef.current?.value || ''
                await saveVerdict(eventId, diagnosis, recommendations, session.user.id)

                // 2. Sign
                const result = await signMedicalDictamPDF(eventId)
                if (result.success) {
                    router.refresh()
                } else {
                    setError(result.error || 'Error al firmar')
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Error de conexión'
                setError('Error en el proceso de firma: ' + message)
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
                            {isPending ? 'Procesando...' : '✅ Finalizar Cita y Pasar a Validación'}
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
                                    ref={diagRef}
                                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none min-h-[100px]"
                                    placeholder="Ej: Apto para el puesto sin restricciones..."
                                    defaultValue={verdictData?.finalDiagnosis}
                                ></textarea>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Recomendaciones</label>
                                <textarea
                                    ref={recRef}
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
