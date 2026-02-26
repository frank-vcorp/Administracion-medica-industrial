'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'

/**
 * @id IMPL-20260226-01
 * Server Action para subir archivos al backend Railway y registrar en DB.
 * Compatible con Vercel (serverless): NO escribe al filesystem local.
 */
export async function uploadFile(formData: FormData) {
    const file = formData.get('file') as File
    const eventId = formData.get('eventId') as string
    const type = (formData.get('type') as string) || 'study' // 'study' | 'lab'

    if (!file || !eventId) {
        return { success: false, error: 'Missing file or eventId' }
    }

    const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`
    const relativePath = `/uploads/${filename}`

    // Valores por defecto en caso de que el backend IA no esté disponible
    let finalName = type === 'lab' ? 'Laboratorio (Pendiente)' : 'Estudio (Pendiente)'
    let aiData = null

    try {
        // ---------------------------------------------------------
        // 🧠 ENVIAR AL BACKEND RAILWAY (Upload + IA Pipeline)
        // ---------------------------------------------------------
        const PYTHON_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

        const uploadForm = new FormData()
        uploadForm.append('file', file)

        const response = await fetch(`${PYTHON_API}/api/v1/upload-and-analyze`, {
            method: 'POST',
            body: uploadForm,
        })

        if (response.ok) {
            const result = await response.json()

            if (result.status === 'success' && result.classification?.detected_type) {
                finalName = `${result.classification.detected_type} (IA)`
                aiData = result.extraction
            }
        } else {
            console.error('Backend IA Error:', await response.text().catch(() => 'No response body'))
        }
    } catch (e) {
        console.error('Could not connect to Backend Railway:', e)
        // Continúa sin IA — registra como pendiente
    }

    // ---------------------------------------------------------
    // GUARDAR EN DB (siempre, con o sin IA)
    // ---------------------------------------------------------
    try {
        if (type === 'lab') {
            await prisma.labRecord.create({
                data: {
                    eventId: eventId,
                    serviceName: finalName,
                    fileUrl: relativePath,
                    extractedData: aiData || undefined,
                    isCompleted: true
                }
            })
        } else {
            await prisma.studyRecord.create({
                data: {
                    eventId: eventId,
                    serviceName: finalName,
                    fileUrl: relativePath,
                    extractedData: aiData || undefined,
                    isCompleted: true
                }
            })
        }

        revalidatePath(`/events/${eventId}`)
        return { success: true, path: relativePath }

    } catch (error) {
        console.error('DB Save Error:', error)
        return { success: false, error: 'Failed to save record' }
    }
}

