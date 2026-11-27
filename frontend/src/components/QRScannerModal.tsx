'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAppointmentForCorroborationByQr } from '@/actions/appointment.actions'
import CorroborationModal from '@/components/CorroborationModal'
import { Scanner } from '@yudiel/react-qr-scanner'
import { AlertTriangle, QrCode, X } from 'lucide-react'

type CorroborationAppointment = Parameters<typeof CorroborationModal>[0]['appointment']

export default function QRScannerModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [qrCode, setQrCode] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [status, setStatus] = useState<{ type: 'idle' | 'error'; message?: string }>({ type: 'idle' })
    const [corroborationData, setCorroborationData] = useState<CorroborationAppointment | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    useEffect(() => {
        if (isOpen && inputRef.current && status.type === 'idle') {
            inputRef.current.focus()
        }
    }, [isOpen, status.type])

    const processCode = async (code: string) => {
        if (isProcessing) return
        if (!code.trim()) return

        setIsProcessing(true)
        setStatus({ type: 'idle' })

        try {
            const result = await getAppointmentForCorroborationByQr(code)

            if (result.success && 'appointment' in result && result.appointment) {
                setQrCode('')
                setIsOpen(false)
                setStatus({ type: 'idle' })
                setCorroborationData(result.appointment as CorroborationAppointment)
            } else {
                setStatus({ type: 'error', message: result.error || 'Error al procesar el QR.' })
            }
        } catch {
            setStatus({ type: 'error', message: 'Error de conexión.' })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleManualScan = (e: React.FormEvent) => {
        e.preventDefault()
        void processCode(qrCode)
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                    <QrCode className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                Escanear QR
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Check-in por QR</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Escanea el código de la cita para corroborar datos</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm"
                                aria-label="Cerrar"
                            >
                                <X className="w-4 h-4" strokeWidth={2.25} />
                            </button>
                        </div>

                        <div className="p-8 flex flex-col items-center justify-center">
                            <div className={`w-full max-w-[300px] h-64 border-4 border-dashed rounded-3xl flex items-center justify-center mb-6 relative overflow-hidden transition-colors ${status.type === 'error' ? 'border-red-200 bg-red-50' : 'border-indigo-100'}`}>
                                {status.type === 'error' ? (
                                    <div className="text-center p-4 flex flex-col items-center">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                                            <AlertTriangle className="h-5 w-5" strokeWidth={2.25} />
                                        </span>
                                        <p className="text-xs font-bold text-red-500 mt-2">{status.message}</p>
                                        <button
                                            type="button"
                                            onClick={() => setStatus({ type: 'idle' })}
                                            className="mt-2 text-[10px] bg-red-100 px-2 py-1 rounded-md text-red-700"
                                        >
                                            Intentar de nuevo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full h-full relative">
                                        <Scanner
                                            onScan={(result) => {
                                                if (result && result.length > 0) {
                                                    void processCode(result[0].rawValue)
                                                }
                                            }}
                                            onError={() => undefined}
                                            allowMultiple={true}
                                            scanDelay={2000}
                                        />
                                        <div className="absolute inset-0 border-2 border-indigo-500/50 pointer-events-none z-10" />
                                    </div>
                                )}
                            </div>

                            <p className="text-center text-slate-600 text-sm mb-6">
                                {isProcessing ? 'Cargando datos de la cita...' : 'Coloca el código frente a la cámara'}
                                <br />
                                <span className="text-xs text-slate-400">O escanea/ingresa el folio o URL (pistola lectora)</span>
                            </p>

                            <form onSubmit={handleManualScan} className="w-full">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={qrCode}
                                    onChange={(e) => {
                                        setQrCode(e.target.value)
                                        if (status.type === 'error') setStatus({ type: 'idle' })
                                    }}
                                    placeholder="URL o folio EXP-..."
                                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition-all text-center font-mono text-sm ${status.type === 'error' ? 'border-red-300 ring-red-200 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500 focus:border-indigo-500'}`}
                                    disabled={isProcessing}
                                />
                                <button
                                    type="submit"
                                    disabled={!qrCode.trim() || isProcessing}
                                    className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-all"
                                >
                                    {isProcessing ? 'Procesando...' : 'Abrir corroboración'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {corroborationData && (
                <CorroborationModal
                    appointment={corroborationData}
                    onClose={() => {
                        setCorroborationData(null)
                        router.refresh()
                    }}
                />
            )}
        </>
    )
}
