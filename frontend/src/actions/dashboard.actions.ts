'use server'

/**
 * @fileoverview Server Actions para el Dashboard de Administración
 * @description Calcula KPIs y métricas clave del sistema para el dashboard
 * @author SOFIA - Builder
 * @version 1.0.0
 * @id IMPL-20260225-05
 * 
 * Retorna:
 * - Conteo de citas del día
 * - Conteo de eventos en progreso
 * - Conteo de eventos completados
 * - Total de trabajadores en el sistema
 */

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'

/**
 * Obtiene los KPIs principales del dashboard
 * @returns Objeto con métricas del sistema o error
 */
export async function getDashboardKPIs() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      throw new Error('Usuario no autenticado')
    }

    // Obtener fecha de hoy (inicio y fin del día)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    // KPI 1: Conteo de citas de hoy
    const appointmentsToday = await prisma.appointment.count({
      where: {
        scheduledAt: {
          gte: today,
          lte: endOfDay,
        },
      },
    })

    // KPI 2: Eventos en progreso (IN_PROGRESS)
    const activeEvents = await prisma.medicalEvent.count({
      where: {
        status: 'IN_PROGRESS',
      },
    })

    // KPI 3: Eventos completados (COMPLETED)
    // Nota: Se cuenta el total de completados, no solo los del día
    const completedEvents = await prisma.medicalEvent.count({
      where: {
        status: 'COMPLETED',
      },
    })

    // KPI 4: Total de trabajadores únicos en el sistema
    const totalWorkers = await prisma.worker.count()

    return {
      success: true,
      kpis: {
        appointmentsToday,
        activeEvents,
        completedEvents,
        totalWorkers,
      },
    }
  } catch (error) {
    console.error('[DASHBOARD KPIs ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener KPIs del dashboard',
      kpis: {
        appointmentsToday: 0,
        activeEvents: 0,
        completedEvents: 0,
        totalWorkers: 0,
      },
    }
  }
}

/**
 * Obtiene desglose de eventos por estado (para análisis avanzado)
 * @returns Conteo de eventos agrupados por estado o error
 */
export async function getEventsByStatus() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      throw new Error('Usuario no autenticado')
    }

    const eventCounts = await prisma.medicalEvent.groupBy({
      by: ['status'],
      _count: true,
    })

    const summary = {
      SCHEDULED: 0,
      CHECKED_IN: 0,
      IN_PROGRESS: 0,
      VALIDATING: 0,
      COMPLETED: 0,
      CANCELED: 0,
    }

    eventCounts.forEach((group) => {
      summary[group.status as keyof typeof summary] = group._count
    })

    return {
      success: true,
      summary,
    }
  } catch (error) {
    console.error('[EVENTS BY STATUS ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener eventos por estado',
    }
  }
}

/**
 * Obtiene desglose de citas por estado (para análisis del flujo de citas)
 * @returns Conteo de citas agrupadas por estado o error
 */
export async function getAppointmentsByStatus() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      throw new Error('Usuario no autenticado')
    }

    const appointmentCounts = await prisma.appointment.groupBy({
      by: ['status'],
      _count: true,
    })

    const summary = {
      SCHEDULED: 0,
      CONFIRMED: 0,
      CANCELLED: 0,
      NO_SHOW: 0,
      COMPLETED: 0,
    }

    appointmentCounts.forEach((group) => {
      summary[group.status as keyof typeof summary] = group._count
    })

    return {
      success: true,
      summary,
    }
  } catch (error) {
    console.error('[APPOINTMENTS BY STATUS ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener citas por estado',
    }
  }
}
