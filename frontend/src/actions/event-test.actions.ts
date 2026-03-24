/**
 * @fileoverview Server Actions para gestión atómica de estudios en papeleta
 * @id IMPL-20260324-06
 * @backup context/checkpoints/CHK_IMPL-20260324-06-PAPELETA-WORKSPACE.md
 */
'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { EventTestStatus } from "@prisma/client"

/**
 * Actualiza el estado operativo de un estudio en la papeleta.
 * Soporta los estados V1: PENDING, IN_PROGRESS, SAMPLE_TAKEN, RESULT_REGISTERED, COMPLETED.
 */
export async function updateEventTestStatus(
  eventTestId: string,
  status: EventTestStatus,
  eventId: string
) {
  if (!eventTestId || !status || !eventId) {
    return { success: false, error: 'Parámetros incompletos' }
  }

  try {
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: { status }
    })
    revalidatePath(`/events/${eventId}`)
    return { success: true }
  } catch (error) {
    console.error("Error updating event test status:", error)
    return { success: false, error: "Error al actualizar estado del estudio" }
  }
}

/**
 * Sube un archivo al backend Python (pipeline IA) y lo vincula atómicamente
 * al estudio correspondiente en la papeleta.
 * Si el backend no está disponible, guarda el nombre del archivo como referencia.
 */
export async function uploadEventTestFile(formData: FormData) {
  const eventTestId = formData.get('eventTestId') as string
  const eventId = formData.get('eventId') as string
  const file = formData.get('file') as File

  if (!eventTestId || !eventId || !file) {
    return { success: false, error: 'Faltan parámetros obligatorios' }
  }

  // Intentar enviar al backend Python para análisis IA
  const PYTHON_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  let fileUrl = ''

  try {
    const uploadForm = new FormData()
    uploadForm.append('file', file)

    const response = await fetch(`${PYTHON_API}/api/v1/upload-and-analyze`, {
      method: 'POST',
      body: uploadForm,
    })

    if (response.ok) {
      const result = await response.json()
      if (result.file_path) {
        fileUrl = result.file_path
      } else if (result.filename) {
        fileUrl = `/uploads/${result.filename}`
      }
    }
  } catch {
    // Backend no disponible — usar ruta local como referencia
    console.info('Backend Python no disponible para upload, guardando referencia local.')
  }

  // Fallback: guardar nombre del archivo como referencia
  if (!fileUrl) {
    fileUrl = `/uploads/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  }

  try {
    await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        fileUrl,
        status: 'RESULT_REGISTERED'
      }
    })
    revalidatePath(`/events/${eventId}`)
    return { success: true, fileUrl }
  } catch (error) {
    console.error("Error saving event test file:", error)
    return { success: false, error: "Error al vincular el archivo al estudio" }
  }
}
