'use server'

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { revalidatePath } from 'next/cache'
import * as EventService from '@/services/medical-event.service'
import prisma from '@/lib/prisma'

export async function uploadFile(formData: FormData) {
    const file = formData.get('file') as File
    const eventId = formData.get('eventId') as string
    const type = (formData.get('type') as string) || 'study' // 'study' | 'lab'

    if (!file || !eventId) {
        return { success: false, error: 'Missing file or eventId' }
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const filename = `${Date.now()}-${file.name.replace(/\s/g, '_')}`
    const relativePath = `/uploads/${filename}`
    // Use generic uploads dir for any type
    const uploadDir = join(process.cwd(), '../uploads')
    const savePath = join(uploadDir, filename)

    try {
        // Ensure write
        const fs = await import('fs/promises')
        // Defensive mkdir just in case
        // await fs.mkdir(uploadDir, { recursive: true }).catch(() => {})

        await writeFile(savePath, buffer)
        console.log(`✅ File saved locally to ${savePath}`)

        // ---------------------------------------------------------
        // 🧠 CALL AI BRAIN
        // ---------------------------------------------------------
        let finalName = type === 'lab' ? 'Laboratorio (Pendiente)' : 'Estudio (Pendiente)'
        let aiData = null

        try {
            // Should be env var, defaulting to docker service name
            const PYTHON_API = process.env.PYTHON_API_URL || 'http://backend:8000'

            const response = await fetch(`${PYTHON_API}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_path: relativePath })
            })

            if (response.ok) {
                const result = await response.json()
                console.log('🧠 AI Result:', result)

                // Update name based on AI classification
                if (result.classification?.detected_type) {
                    finalName = `${result.classification.detected_type} (IA)`
                }
                aiData = result.extraction
            } else {
                console.error('AI Processing Failed:', await response.text())
            }
        } catch (e) {
            console.error('Could not connect to AI Brain:', e)
        }

        // ---------------------------------------------------------
        // SAVE TO DB
        // ---------------------------------------------------------

        if (type === 'lab') {
            await prisma.labRecord.create({
                data: {
                    eventId: eventId,
                    serviceName: finalName,
                    fileUrl: relativePath,
                    extractedData: aiData || undefined,
                    isCompleted: true // Processed
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
        console.error('Upload Error:', error)
        return { success: false, error: 'Failed to save file' }
    }
}
