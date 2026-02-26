'use server'

/**
 * @fileoverview Server Actions para Gestión de Citas (Appointments)
 * @description CRUD y operaciones críticas en el flujo de citas médicas
 * @author SOFIA - Builder
 * @version 1.0.0
 * @id IMPL-20260225-05
 * 
 * Implementa:
 * - Creación de citas
 * - Listado con filtros
 * - Actualización de estado
 * - Check-in que genera MedicalEvent
 * - Integración con auditoría
 */

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/actions/audit.actions'
import { generateExpedientId } from '@/lib/id.utils'

/**
 * Crea una nueva cita y registra en auditoría
 * @param data - Datos de la cita (workerId, companyId, branchId, scheduledAt, notes)
 * @returns Cita creada o error
 */
export async function createAppointment(data: {
  workerId: string
  companyId: string
  branchId: string
  scheduledAt: Date | string
  notes?: string
}) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      throw new Error('Usuario no autenticado')
    }

    // Convertir scheduledAt a Date si es string
    const scheduledDate = typeof data.scheduledAt === 'string'
      ? new Date(data.scheduledAt)
      : data.scheduledAt

    // Generar ID de Papeleta automático (EXP-YYYYNNN)
    const expedientId = await generateExpedientId(prisma)

    // Generar QR (Mock Base64 por ahora para evitar dependencias pesadas en el build)
    const qrCode = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200 text-anchor="middle"><rect width="100%" height="100%" fill="white"/><text x="100" y="100" font-family="Arial" font-size="12" fill="black">${expedientId}</text></svg>`).toString('base64')}`

    const appointment = await prisma.appointment.create({
      data: {
        workerId: data.workerId,
        companyId: data.companyId,
        branchId: data.branchId,
        scheduledAt: scheduledDate,
        notes: data.notes || null,
        status: 'SCHEDULED',
        expedientId,
        qrCode
      },
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true, universalId: true },
        },
        company: {
          select: { id: true, name: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    })

    // Registrar en auditoría
    await logAudit('CREATE', 'Appointment', appointment.id, {
      workerId: data.workerId,
      companyId: data.companyId,
      branchId: data.branchId,
      scheduledAt: scheduledDate,
    })

    revalidatePath('/appointments')
    revalidatePath('/dashboard')

    return {
      success: true,
      appointment,
    }
  } catch (error) {
    console.error('[CREATE APPOINTMENT ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear cita',
    }
  }
}

/**
 * Obtiene listado de citas con filtros opcionales
 * @param date - Filtrar por fecha (YYYY-MM-DD)
 * @param branchId - Filtrar por sucursal
 * @returns Listado de citas o error
 */
export async function getAppointments(date?: string, branchId?: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      throw new Error('Usuario no autenticado')
    }

    const filters: Record<string, unknown> = {}

    // Filtro por fecha
    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)

      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      filters.scheduledAt = {
        gte: startOfDay,
        lte: endOfDay,
      }
    }

    // Filtro por sucursal
    if (branchId) {
      filters.branchId = branchId
    }

    const appointments = await prisma.appointment.findMany({
      where: filters,
      include: {
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            universalId: true,
            email: true,
          },
        },
        company: {
          select: { id: true, name: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        scheduledAt: 'asc',
      },
    })

    return {
      success: true,
      appointments,
    }
  } catch (error) {
    console.error('[GET APPOINTMENTS ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener citas',
    }
  }
}

/**
 * Actualiza el estado de una cita
 * @param appointmentId - ID de la cita
 * @param status - Nuevo estado (SCHEDULED, CONFIRMED, CANCELLED, NO_SHOW, COMPLETED)
 * @returns Cita actualizada o error
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED'
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      throw new Error('Usuario no autenticado')
    }

    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status },
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true },
        },
        company: {
          select: { id: true, name: true },
        },
      },
    })

    // Registrar cambio en auditoría
    await logAudit('UPDATE', 'Appointment', appointmentId, {
      previousStatus: appointment.status,
      newStatus: status,
    })

    revalidatePath('/appointments')

    return {
      success: true,
      appointment,
    }
  } catch (error) {
    console.error('[UPDATE APPOINTMENT STATUS ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar cita',
    }
  }
}

/**
 * OPERACIÓN CRÍTICA: Check-in de una cita
 * 1. Cambia el estado de Appointment a COMPLETED
 * 2. Crea un MedicalEvent asociado
 * 3. Enlaza appointmentId al evento médico
 * 4. Registra en auditoría
 * 
 * @param appointmentId - ID de la cita
 * @returns MedicalEvent creado o error
 */
export async function checkInAppointment(appointmentId: string) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      throw new Error('Usuario no autenticado')
    }

    // Obtener la cita
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        worker: true,
        company: true,
        branch: true,
      },
    })

    if (!appointment) {
      throw new Error('Cita no encontrada')
    }

    // Actualizar estado de Appointment a COMPLETED
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
    })

    // Crear MedicalEvent vinculado
    const medicalEvent = await prisma.medicalEvent.create({
      data: {
        workerId: appointment.workerId,
        branchId: appointment.branchId,
        status: 'CHECKED_IN',
        checkInDate: new Date(),
        appointmentId: appointmentId, // Vincular la cita al evento
      },
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true, universalId: true },
        },
        branch: {
          select: { id: true, name: true },
        },
      },
    })

    // Registrar en auditoría
    await logAudit('CHECK_IN', 'Appointment', appointmentId, {
      medicalEventId: medicalEvent.id,
      workerId: appointment.workerId,
      companyId: appointment.companyId,
      branchId: appointment.branchId,
    })

    revalidatePath('/appointments')
    revalidatePath('/dashboard')
    revalidatePath('/events')

    return {
      success: true,
      medicalEvent,
      appointment: {
        id: appointment.id,
        status: 'COMPLETED',
      },
    }
  } catch (error) {
    console.error('[CHECK-IN APPOINTMENT ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al hacer check-in de cita',
    }
  }
}
