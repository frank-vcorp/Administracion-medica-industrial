'use server'

import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

/**
 * Obtiene la sesión segura del servidor + valida que el usuario sea COMPANY_CLIENT
 * @id IMPL-20260225-01
 */
async function getSessionOrThrow() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    throw new Error('No autorizado: sesión no encontrada')
  }
  
  if (session.user.role !== 'COMPANY_CLIENT') {
    throw new Error('No autorizado: solo usuarios CLIENT pueden acceder a portal')
  }
  
  if (!session.user.companyId) {
    throw new Error('No autorizado: usuario CLIENT sin empresa asignada')
  }
  
  return session
}

/**
 * Obtiene las métricas generales de una empresa para el Dashboard B2B
 * El companyId se extrae de la sesión segura del servidor (NO del cliente)
 * @fix IMPL-20260225-01 - Elimina vulnerabilidad de Acceso Inadecuado a Datos
 */
export async function getCompanyDashboardStats() {
  try {
    const session = await getSessionOrThrow()
    const companyId = session.user.companyId!

    const workersCount = await prisma.worker.count({
      where: { companyId }
    })

    // FIX REFERENCE: FIX-20260225-02 - Optimización de consultas para evitar DoS lógico
    const totalEvents = await prisma.medicalEvent.count({
      where: { worker: { companyId } }
    })

    const completedEvents = await prisma.medicalEvent.count({
      where: { worker: { companyId }, status: 'COMPLETED' }
    })

    const inProgressEvents = totalEvents - completedEvents

    // Calcular dictámenes aptos vs no aptos usando agregaciones
    const verdicts = await prisma.medicalVerdict.findMany({
      where: { event: { worker: { companyId } } },
      select: { finalDiagnosis: true }
    })

    let aptos = 0
    let noAptos = 0
    verdicts.forEach(v => {
      const diag = v.finalDiagnosis.toLowerCase()
      if (diag.includes('no apto')) noAptos++
      else aptos++
    })

    return {
      success: true,
      stats: {
        workers: workersCount,
        totalEvents,
        completed: completedEvents,
        inProgress: inProgressEvents,
        aptos,
        noAptos
      }
    }
  } catch (error) {
    // FIX REFERENCE: FIX-20260225-02 - Sanitización de logs
    console.error("Error fetching company stats:", error instanceof Error ? error.message : "Unknown error")
    return { success: false, error: 'Hubo un error al cargar las métricas.' }
  }
}

/**
 * Obtiene la lista de trabajadores de una empresa con su último estatus médico
 * Solo retorna datos de la empresa del usuario logueado
 * @fix IMPL-20260225-01 - Optimiza con select() en lugar de include()
 */
export async function getCompanyWorkersWithStatus() {
  try {
    const session = await getSessionOrThrow()
    const companyId = session.user.companyId!

    const workers = await prisma.worker.findMany({
      where: { companyId },
      select: {
        id: true,
        universalId: true,
        nationalId: true,
        firstName: true,
        lastName: true,
        email: true,
        medicalHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            createdAt: true,
            verdict: {
              select: {
                id: true,
                finalDiagnosis: true,
              }
            }
          }
        }
      },
      orderBy: { lastName: 'asc' }
    })

    return { success: true, workers }
  } catch (error) {
    console.error("Error fetching workers for portal:", error)
    return { success: false, error: 'Hubo un error al cargar los trabajadores.' }
  }
}

/**
 * Obtiene el historial de todos los eventos médicos de una empresa
 * Solo retorna datos de la empresa del usuario logueado
 * @fix IMPL-20260225-01 - Elimina vulnerabilidad Broken Access Control
 */
export async function getCompanyEventsHistory() {
  try {
    const session = await getSessionOrThrow()
    const companyId = session.user.companyId!

    const events = await prisma.medicalEvent.findMany({
      where: { worker: { companyId } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            universalId: true,
          }
        },
        verdict: {
          select: {
            id: true,
            finalDiagnosis: true,
            signedAt: true,
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return { success: true, events }
  } catch (error) {
    console.error("Error fetching events history for portal:", error)
    return { success: false, error: 'Hubo un error al cargar el historial.' }
  }
}

