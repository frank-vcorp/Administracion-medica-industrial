'use client'

import { useState, useCallback, useRef } from 'react'
import { uploadFile } from '@/actions/upload.actions'

interface SmartDropzoneProps {
    eventId: string
    type: 'study' | 'lab'
    title: string
    subtitle: string
    icon?: string // 'cloud' | 'flask'
}

export default function SmartDropzone({ eventId, type, title, subtitle, icon = 'cloud' }: SmartDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [uploads, setUploads] = useState<{ name: string, status: 'uploading' | 'success' | 'error', error?: string }[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    const processFiles = useCallback(async (files: File[]) => {
        if (files.length === 0) return

        for (const file of files) {
            setUploads(prev => [...prev, { name: file.name, status: 'uploading' }])

            const formData = new FormData()
            formData.append('file', file)
            formData.append('eventId', eventId)
            formData.append('type', type) // 'study' or 'lab'

            try {
                const result = await uploadFile(formData)
                if (result.success) {
                    setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'success' } : u))
                } else {
                    setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'error', error: result.error } : u))
                }
            } catch (error) {
                console.error(error)
                setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'error', error: 'Error de conexión' } : u))
            }
        }
    }, [eventId, type])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const files = Array.from(e.dataTransfer.files)
        await processFiles(files)
    }, [processFiles])

    const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        await processFiles(files)
        // Reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = ''
    }, [processFiles])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    return (
        <div className="space-y-4">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                onChange={handleFileInput}
            />

            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group
          ${isDragging
                        ? 'border-emerald-500 bg-emerald-50 scale-[1.02]'
                        : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
                    }
        `}
            >
                <div className="flex justify-center mb-3 text-4xl text-slate-400 group-hover:text-emerald-500 transition-colors">
                    {icon === 'flask' ? '🧪' : '☁️'}
                </div>

                <h3 className="text-slate-700 font-medium mb-1">{title}</h3>
                <p className="text-slate-400 text-xs">{subtitle}</p>

                <div className="mt-4">
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 inline-block px-3 py-1.5 rounded-full border border-emerald-200">
                        📎 Clic para seleccionar o arrastra archivos aquí
                    </span>
                </div>
            </div>

            {/* Upload List */}
            {uploads.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50 max-h-40 overflow-y-auto">
                    {uploads.map((upload, idx) => (
                        <div key={idx} className="px-3 py-2 flex items-center justify-between text-xs">
                            <span className="text-slate-600 truncate max-w-[200px]">{upload.name}</span>
                            {upload.status === 'uploading' && (
                                <span className="text-blue-500 flex items-center gap-1">
                                    <span className="animate-spin">⏳</span> Subiendo...
                                </span>
                            )}
                            {upload.status === 'success' && <span className="text-emerald-600 font-medium">✅ Procesado</span>}
                            {upload.status === 'error' && (
                                <span className="text-red-500" title={upload.error}>❌ Error</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
