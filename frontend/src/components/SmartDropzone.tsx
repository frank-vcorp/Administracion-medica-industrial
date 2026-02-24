'use client'

import { useState, useCallback } from 'react'
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
    const [uploads, setUploads] = useState<{ name: string, status: 'uploading' | 'success' | 'error' }[]>([])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return

        for (const file of files) {
            setUploads(prev => [...prev, { name: file.name, status: 'uploading' }])

            const formData = new FormData()
            formData.append('file', file)
            formData.append('eventId', eventId)
            formData.append('type', type) // 'study' or 'lab'

            try {
                await uploadFile(formData)
                setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'success' } : u))
            } catch (error) {
                console.error(error)
                setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'error' } : u))
            }
        }
    }, [eventId, type])

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
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
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

                <div className="mt-4 text-xs font-semibold text-emerald-600 bg-emerald-50 inline-block px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    Soltar para subir
                </div>
            </div>

            {/* Mini Upload List specific to this dropzone */}
            {uploads.length > 0 && (
                <div className="bg-white rounded border border-slate-100 divide-y divide-slate-50 max-h-32 overflow-y-auto">
                    {uploads.map((upload, idx) => (
                        <div key={idx} className="px-3 py-2 flex items-center justify-between text-xs">
                            <span className="text-slate-600 truncate max-w-[150px]">{upload.name}</span>
                            {upload.status === 'uploading' && <span className="text-blue-500">Subiendo...</span>}
                            {upload.status === 'success' && <span className="text-emerald-600">Completo</span>}
                            {upload.status === 'error' && <span className="text-red-500">Error</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
