'use server'

import prisma from '@/lib/prisma'

/**
 * Obtiene las métricas generales de una empresa para el Dashboard B2B
 */
export async function getCompanyDashboardStats(companyId: string) {
    try {
        const workersCount = await prisma.worker.count({
            where: { companyId }
        })

        const events = await prisma.medicalEvent.findMany({
            where: { worker: { companyId } },
            include: { verdict: true }
        })

        const totalEvents = events.length
        const completedEvents = events.filter(e => e.status === 'COMPLETED').length
        const inProgressEvents = totalEvents - completedEvents

        // Calcular dictámenes aptos vs no aptos (Simplificado para el MVP)
        let aptos = 0
        let noAptos = 0
        events.forEach(e => {
            if (e.verdict) {
                const diag = e.verdict.finalDiagnosis.toLowerCase()
                if (diag.includes('no apto')) noAptos++
                else aptos++
            }
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
        console.error("Error fetching company stats:", error)
        return { success: false, error: 'Hubo un error al cargar las métricas.' }
    }
}

/**
 * Obtiene la lista de trabajadores de una empresa con su último estatus médico
 */
export async function getCompanyWorkersWithStatus(companyId: string) {
    try {
        const workers = await prisma.worker.findMany({
            where: { companyId },
            include: {
                medicalHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { verdict: true }
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
 */
export async function getCompanyEventsHistory(companyId: string) {
    try {
        const events = await prisma.medicalEvent.findMany({
            where: { worker: { companyId } },
            include: {
                worker: true,
                verdict: true,
                branch: true
            },
            orderBy: { createdAt: 'desc' }
        })

        return { success: true, events }
    } catch (error) {
        console.error("Error fetching events history for portal:", error)
        return { success: false, error: 'Hubo un error al cargar el historial.' }
    }
}
