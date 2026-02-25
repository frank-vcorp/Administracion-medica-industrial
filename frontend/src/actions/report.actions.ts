'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'

/**
 * @id IMPL-20260225-03
 * Server Action para generar reporte Excel de eventos médicos
 * Recopila datos de eventos y los envía al backend para generar Excel
 */
export async function generateExcelReport(eventIds?: string[]) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.companyId) {
      return {
        success: false,
        error: 'No autorizado: sesión inválida'
      }
    }

    // Obtener eventos de la empresa del usuario
    const where = eventIds?.length
      ? {
          id: { in: eventIds },
          worker: { companyId: session.user.companyId }
        }
      : {
          worker: { companyId: session.user.companyId }
        }

    const events = await prisma.medicalEvent.findMany({
      where,
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
            finalDiagnosis: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (events.length === 0) {
      return {
        success: false,
        error: 'No hay eventos para exportar'
      }
    }

    // Transformar datos para el reporte
    const dataList = events.map((event) => ({
      id: event.id,
      fecha: new Date(event.createdAt).toISOString().split('T')[0],
      trabajador: `${event.worker.lastName}, ${event.worker.firstName}`,
      cedula: event.worker.universalId,
      nacimiento: event.worker.dob
        ? new Date(event.worker.dob).toISOString().split('T')[0]
        : '',
      diagnostico: event.verdict?.finalDiagnosis || 'Pendiente',
      fechaFirma: event.verdict
        ? new Date(event.verdict.createdAt).toISOString().split('T')[0]
        : 'N/A',
      estado: event.status
    }))


    // Llamar al endpoint del backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const response = await fetch(
      `${backendUrl}/api/v1/generate-excel-report`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data_list: dataList,
          title: `Reporte Expedientes - ${session.user.email}`
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error || `Error en backend: ${response.statusText}`
      }
    }

    const result = await response.json()

    // El backend retorna base64 o ruta del archivo
    if (result.status === 'success' && result.data?.xlsx) {
      return {
        success: true,
        fileName: `expedientes-${new Date().toISOString().split('T')[0]}.xlsx`,
        fileData: result.data.xlsx // base64 string
      }
    }

    return {
      success: false,
      error: result.error || 'No se generó el archivo'
    }
  } catch (error) {
    console.error('Error en generateExcelReport:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * @id IMPL-20260225-03
 * Helper para descargar archivo Excel desde el cliente
 * Se ejecuta después de obtener el archivo
 */
export async function downloadExcelFile(
  fileName: string,
  fileData: string
) {
  try {
    // fileData debería ser base64
    const binaryString = atob(fileData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    // Crear URL y disparar descarga
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    return { success: true }
  } catch (error) {
    console.error('Error descargando archivo:', error)
    return { success: false, error: 'Error al descargar' }
  }
}
