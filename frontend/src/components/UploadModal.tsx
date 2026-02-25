'use client'

import { useState } from 'react'
import { uploadFile } from '@/actions/upload.actions'

export default function UploadModal({ eventId }: { eventId: string }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    const handleUpload = async (formData: FormData) => {
        setIsUploading(true)
        try {
            formData.append('eventId', eventId)
            await uploadFile(formData)
            setIsOpen(false)
        } finally {
            setIsUploading(false)
        }
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 font-medium"
            >
                + Agregar Estudio
            </button>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl w-96">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Subir Estudio</h3>

                <form action={handleUpload} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Estudio</label>
                        <input
                            name="serviceName"
                            type="text"
                            placeholder="Ej. Audiometría"
                            required
                            className="w-full text-sm border-slate-300 rounded-lg"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Archivo (PDF/Imagen)</label>
                        <input
                            name="file"
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            required
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
                            disabled={isUploading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            {isUploading ? 'Subiendo...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
