'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function QRScannerModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [qrCode, setQrCode] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Focus input when modal opens to catch scanner input
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!qrCode) return

        setIsProcessing(true)
        try {
            // Here we would call a server action to process the QR code
            // e.g., await processQRCheckIn(qrCode)
            console.log('Processing QR:', qrCode)
            
            // Simulate network request
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            setIsOpen(false)
            setQrCode('')
            router.refresh()
        } catch (error) {
            console.error('Error processing QR:', error)
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                Escanear QR
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Check-in por QR</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Escanea el código del paciente</p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-8 flex flex-col items-center justify-center">
                            <div className="w-48 h-48 border-4 border-dashed border-indigo-100 rounded-3xl flex items-center justify-center mb-6 relative overflow-hidden">
                                <div className="absolute inset-0 bg-indigo-50/50 animate-pulse"></div>
                                <svg className="w-16 h-16 text-indigo-300 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                
                                {/* Scanning line animation */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                            </div>

                            <p className="text-center text-slate-600 text-sm mb-6">
                                Esperando lectura del escáner...<br/>
                                <span className="text-xs text-slate-400">Asegúrate de que el cursor esté en el campo de abajo</span>
                            </p>

                            <form onSubmit={handleScan} className="w-full">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={qrCode}
                                    onChange={(e) => setQrCode(e.target.value)}
                                    placeholder="Código QR..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-center font-mono text-sm"
                                    autoFocus
                                />
                                <button 
                                    type="submit" 
                                    disabled={!qrCode || isProcessing}
                                    className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-all"
                                >
                                    {isProcessing ? 'Procesando...' : 'Procesar Manualmente'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes scan {
                    0% { top: 0; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
            `}} />
        </>
    )
}