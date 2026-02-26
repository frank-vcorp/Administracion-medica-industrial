'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

/**
 * @id IMPL-20260225-03
 * @fix FIX-20260225-03
 * Server Action para firmar un dictamen médico (PDF)
 * Obtiene el evento, genera el PDF del dictamen y lo firma
 */
export async function signMedicalDictamPDF(eventId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return {
        success: false,
        error: 'No autorizado'
      }
    }

    // Validar que el evento existe y tiene dictamen
    const event = await prisma.medicalEvent.findUnique({
      where: { id: eventId },
      include: {
        worker: {
          select: {
            firstName: true,
            lastName: true,
            universalId: true,
            dob: true,
            nationalId: true
          }
        },
        verdict: {
          select: {
            id: true,
            finalDiagnosis: true,
            recommendations: true,
            createdAt: true,
            signedAt: true,
            signatureHash: true,
            pdfUrl: true
          }
        },
        branch: {
          select: {
            name: true,
            address: true
          }
        }
      }
    })

    if (!event) {
      return {
        success: false,
        error: 'Evento no encontrado'
      }
    }

    if (!event.verdict) {
      return {
        success: false,
        error: 'No hay dictamen para firmar'
      }
    }

    // Construir el nombre del archivo temporal
    const fileName = `dictamen-${event.id}-${Date.now()}.pdf`

    // Preparar datos para enviar al backend
    // TODO: Mover PDF rendering a API Route (renderToStream requiere contexto de cliente)
    // Por ahora se envía directamente al backend para firmar
    // const stream = await renderToStream(<MedicalDictamenPDF data={dictamData as any} />)

    // Llamar al backend para firmar
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/api/v1/sign-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input_pdf: fileName,
        output_pdf: `dictamen-${event.id}-signed.pdf`,
        reason: 'Dictamen Médico AMI',
        password: process.env.PDF_SIGN_PASSWORD || 'default1234'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error || `Error: ${response.statusText}`
      }
    }

    const result = await response.json()

    if (result.status === 'success') {
      // Actualizar el evento para marcar que fue firmado
      await prisma.medicalEvent.update({
        where: { id: eventId },
        data: {
          status: 'COMPLETED'
        }
      })

      // Actualizar el veredicto con la firma y URL del PDF
      await prisma.medicalVerdict.update({
        where: { eventId },
        data: {
          signatureHash: result.signature_hash || result.output_pdf,
          pdfUrl: result.output_pdf || `dictamen-${event.id}-signed.pdf`,
          signedAt: new Date()
        }
      })

      revalidatePath('/portal/events')

      return {
        success: true,
        message: 'Dictamen firmado exitosamente',
        pdfUrl: `/api/pdf/${event.id}`,
        fileName: `dictamen-${event.id}-signed.pdf`
      }
    }

    return {
      success: false,
      error: result.error || 'Error al firmar'
    }
  } catch (error) {
    console.error('Error en signMedicalDictamPDF:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * @id IMPL-20260225-03
 * Server Action para obtener un PDF de dictamen
 * Usado por el endpoint de descarga
 */
export async function getMedicalDictamPDF(eventId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return {
        success: false,
        error: 'No autorizado'
      }
    }

    const event = await prisma.medicalEvent.findUnique({
      where: { id: eventId },
      include: {
        worker: { select: { companyId: true } },
        verdict: true
      }
    })

    if (!event) {
      return { success: false, error: 'Evento no encontrado' }
    }

    // Validar que el usuario pertenece a la empresa del trabajador
    if (
      session.user.role === 'COMPANY_CLIENT' &&
      event.worker.companyId !== session.user.companyId
    ) {
      return { success: false, error: 'No autorizado' }
    }

    if (!event.verdict?.pdfUrl) {
      return { success: false, error: 'Dictamen no firmado' }
    }

    return {
      success: true,
      eventId: event.id,
      fileName: `dictamen-${event.id}.pdf`,
      pdfPath: event.verdict.pdfUrl
    }
  } catch (error) {
    console.error('Error en getMedicalDictamPDF:', error)
    return { success: false, error: 'Error al obtener PDF' }
  }
}
