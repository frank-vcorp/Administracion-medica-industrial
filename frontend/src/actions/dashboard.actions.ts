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

function getMonthBounds(offsetMonths = 0) {
  const anchor = new Date()
  const start = new Date(anchor.getFullYear(), anchor.getMonth() + offsetMonths, 1, 0, 0, 0, 0)
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + offsetMonths + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

function formatTrendVsPrevious(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? '+100% vs mes anterior' : 'Sin variación vs mes anterior'
  }
  const delta = Math.round(((current - previous) / previous) * 100)
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}% vs mes anterior`
}

async function countAppointmentsBetween(start: Date, end: Date) {
  return prisma.appointment.count({
    where: {
      scheduledAt: { gte: start, lte: end },
    },
  })
}

async function countEventsBetween(start: Date, end: Date) {
  return prisma.medicalEvent.count({
    where: {
      OR: [
        { checkInDate: { gte: start, lte: end } },
        { checkInDate: null, createdAt: { gte: start, lte: end } },
      ],
    },
  })
}

async function countCompletedEventsBetween(start: Date, end: Date) {
  return prisma.medicalEvent.count({
    where: {
      status: 'COMPLETED',
      updatedAt: { gte: start, lte: end },
    },
  })
}

async function countWorkersCreatedBetween(start: Date, end: Date) {
  return prisma.worker.count({
    where: {
      createdAt: { gte: start, lte: end },
    },
  })
}

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

    const { start: monthStart, end: monthEnd } = getMonthBounds(0)
    const { start: prevMonthStart, end: prevMonthEnd } = getMonthBounds(-1)

    const [
      appointmentsThisMonth,
      appointmentsLastMonth,
      eventsThisMonth,
      completedThisMonth,
      workersThisMonth,
      workersLastMonth,
    ] = await Promise.all([
      countAppointmentsBetween(monthStart, monthEnd),
      countAppointmentsBetween(prevMonthStart, prevMonthEnd),
      countEventsBetween(monthStart, monthEnd),
      countCompletedEventsBetween(monthStart, monthEnd),
      countWorkersCreatedBetween(monthStart, monthEnd),
      countWorkersCreatedBetween(prevMonthStart, prevMonthEnd),
    ])

    const closureRate =
      eventsThisMonth > 0
        ? `${Math.round((completedThisMonth / eventsThisMonth) * 100)}% cerrados`
        : 'Sin atenciones este mes'

    return {
      success: true,
      kpis: {
        appointmentsToday,
        activeEvents,
        completedEvents,
        totalWorkers,
      },
      monthlySummary: {
        monthLabel: monthStart.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }),
        appointmentsThisMonth,
        appointmentsTrend: formatTrendVsPrevious(appointmentsThisMonth, appointmentsLastMonth),
        eventsThisMonth,
        completedThisMonth,
        closureRate,
        workersThisMonth,
        workersTrend:
          workersThisMonth > 0
            ? `+${workersThisMonth} nuevos`
            : workersLastMonth > 0
              ? 'Sin altas este mes'
              : 'Sin altas recientes',
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
      monthlySummary: {
        monthLabel: new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }),
        appointmentsThisMonth: 0,
        appointmentsTrend: 'Sin variación vs mes anterior',
        eventsThisMonth: 0,
        completedThisMonth: 0,
        closureRate: 'Sin atenciones este mes',
        workersThisMonth: 0,
        workersTrend: 'Sin altas recientes',
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
