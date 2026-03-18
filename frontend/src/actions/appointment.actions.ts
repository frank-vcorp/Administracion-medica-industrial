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
import QRCode from 'qrcode'

/**
 * Crea una nueva cita y registra en auditoría
 * @param data - Datos de la cita (workerId, companyId, branchId, scheduledAt, notes, source)
 * @returns Cita creada o error
 */
export async function createAppointment(data: {
  workerId: string
  companyId: string
  branchId: string
  scheduledAt: Date | string
  notes?: string
  source?: string
  serviceProfileId?: string | null
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

    // Generar QR Real usando librería 'qrcode'
    // Almacenamos DataURL (Base64) directamente en DB para evitar hosting externo
    const qrData = JSON.stringify({
       exp: expedientId,
       uid: data.workerId,
       date: scheduledDate.toISOString()
    });
    
    const qrCode = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      scale: 8,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    const appointment = await prisma.appointment.create({
      data: {
        workerId: data.workerId,
        companyId: data.companyId,
        branchId: data.branchId,
        scheduledAt: scheduledDate,
        notes: data.notes || null,
        source: data.source || 'SUCURSAL',
        status: 'SCHEDULED',
        expedientId,
        qrCode,
        serviceProfileId: data.serviceProfileId || null,
      },
      include: {
        worker: {
          select: { id: true, firstName: true, lastName: true, universalId: true, phone: true },
        },
        company: {
          select: { id: true, name: true },
        },
        branch: {
          select: { id: true, name: true, address: true },
        },
      },
    })

    // Registrar en auditoría
    await logAudit('CREATE', 'Appointment', appointment.id, {
      workerId: data.workerId,
      companyId: data.companyId,
      branchId: data.branchId,
      scheduledAt: scheduledDate,
      source: data.source || 'SUCURSAL'
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

    // Filtro por fecha (Fix: manejar range ampliado para cubrir timezones)
    if (date) {
      // date viene como "2023-10-25"
      // Buscamos con holgura de +/- 1 día para capturar citas que por timezone caen en día anterior/siguiente UTC
      const targetDate = new Date(`${date}T12:00:00.000Z`)
      const startRange = new Date(targetDate)
      startRange.setDate(startRange.getDate() - 1) // Día anterior
      const endRange = new Date(targetDate)
      endRange.setDate(endRange.getDate() + 1) // Día siguiente

      filters.scheduledAt = {
        gte: startRange,
        lte: endRange,
      }
      
      // NOTA: El frontend deberá filtrar visualmente las que no correspondan al día seleccionado localmente
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
          select: { id: true, name: true, hourlyCapacity: true, openingTime: true, closingTime: true },
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
  status: string // Usar string en la firma para compatibilidad con Enum de Prisma
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      throw new Error('Usuario no autenticado')
    }

    // Fix: Obtener el estado anterior para auditoría correcta
    const currentAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { status: true }
    })

    if (!currentAppointment) {
      throw new Error('Cita no encontrada')
    }

    const previousStatus = currentAppointment.status

    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      // @ts-ignore - Prisma genera tipos estrictos para status enum
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
      previousStatus: previousStatus,
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

    /**
     * FIX-20260318-01
     * @see context/checkpoints/CHK_ARCH-20260318-09-VALIDACION-FINAL.md
     * Cargamos el perfil y sus pruebas fuera de la transacción para reducir el tiempo
     * del bloque interactivo y evitar expiraciones al instanciar EventTests.
     */
    const appointmentSnapshot = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        worker: true,
        company: true,
        branch: true,
        medicalEvents: true,
        serviceProfile: {
          include: {
            tests: {
              include: {
                test: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    if (!appointmentSnapshot) {
      throw new Error('Cita no encontrada')
    }

    if (appointmentSnapshot.medicalEvents) {
      throw new Error('Esta cita ya tiene un evento médico asociado')
    }

    if (appointmentSnapshot.status === 'COMPLETED' || appointmentSnapshot.status === 'CANCELLED') {
      throw new Error(`La cita ya está en estado ${appointmentSnapshot.status}`)
    }

    if (!appointmentSnapshot.serviceProfile) {
      throw new Error('No se puede hacer Check-in: la cita no tiene un perfil clínico (serviceProfileId) asignado.')
    }

    const eventTestsData = appointmentSnapshot.serviceProfile.tests.map((profileTest) => ({
      testId: profileTest.test.id,
      testNameSnapshot: profileTest.test.name,
      status: 'PENDING' as const,
    }))

    // Fix: Uso de transacción para garantizar atomicidad (Cita COMPLETADA + Evento Creado + Auditoría)
    const result = await prisma.$transaction(async (tx) => {
      const currentAppointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: {
          id: true,
          status: true,
          workerId: true,
          branchId: true,
          companyId: true,
          medicalEvents: { select: { id: true } },
        },
      })

      if (!currentAppointment) {
        throw new Error('Cita no encontrada')
      }

      if (currentAppointment.medicalEvents) {
        throw new Error('Esta cita ya tiene un evento médico asociado')
      }

      if (currentAppointment.status === 'COMPLETED' || currentAppointment.status === 'CANCELLED') {
        throw new Error(`La cita ya está en estado ${currentAppointment.status}`)
      }

      // 2. Actualizar estado de Cita a COMPLETED
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' },
      })

      // 3. Crear MedicalEvent vinculado
      const newMedicalEvent = await tx.medicalEvent.create({
        data: {
          workerId: currentAppointment.workerId,
          branchId: currentAppointment.branchId,
          status: 'CHECKED_IN',
          checkInDate: new Date(),
          appointmentId: appointmentId, // Usar ID directo si el connect falla, es más seguro y simple
          // IMPL-20260313-04: Ligar empresa facturadora desde la cita
          billingCompanyId: currentAppointment.companyId || null,
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

      // IMPL-20260313-04: Instanciar pruebas del perfil médico como EventTest (PENDING)
      if (eventTestsData.length > 0) {
        await tx.eventTest.createMany({
          data: eventTestsData.map((eventTest) => ({
            eventId: newMedicalEvent.id,
            ...eventTest,
          })),
        })
      }

      // 4. Registrar en auditoría DENTRO de la transacción (Critical Path)
      // FIX-20260313-02: Garantizar atomidad ACID reemplazando `logAudit` (que engullía errores) 
      // por una inserción manual transaccional `tx.auditLog.create`
      await tx.auditLog.create({
        data: {
          action: 'CHECK_IN',
          entity: 'Appointment',
          entityId: appointmentId,
          userId: session.user.id,
          details: {
            medicalEventId: newMedicalEvent.id,
            workerId: newMedicalEvent.workerId,
            branchId: newMedicalEvent.branchId,
            timestamp: new Date().toISOString()
          }
        }
      })

      return { appointment: updatedAppointment, medicalEvent: newMedicalEvent }
    }, {
      maxWait: 10000,
      timeout: 15000,
    })

    // Comentamos la auditoría externa antigua
    /* await logAudit('CHECK_IN', 'Appointment', appointmentId, { ... }) */

    revalidatePath('/appointments')
    revalidatePath('/reception') // Importante actualizar tablero
    revalidatePath('/dashboard')

    return {
      success: true,
      medicalEvent: result.medicalEvent,
      appointment: result.appointment,
    }
  } catch (error) {
    console.error('[CHECK-IN APPOINTMENT ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar check-in',
    }
  }
}

/**
 * Procesa el Check-in mediante escaneo de QR
 * Decodifica el JSON del QR, busca la cita por expediente y ejecuta el check-in.
 * @param qrContent - String JSON escaneado del código QR
 */
export async function processQRCheckIn(qrContent: string) {
  try {
    // 🛡️ SECURITY: Validación de sesión obligatoria
    // Previene enumeración de datos sensibles de trabajadores a externos
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: 'Sesión expirada o no autorizada.' }
    }

    let data;
    try {
      data = JSON.parse(qrContent);
    } catch (e) {
      return { success: false, error: 'Código QR inválido o corrupto.' }
    }

    if (!data.exp) {
      return { success: false, error: 'El QR no contiene un ID de expediente válido.' }
    }

    // Buscar cita por Expedient ID
    const appointment = await prisma.appointment.findUnique({
      where: { expedientId: data.exp },
      select: { 
        id: true, 
        status: true, 
        scheduledAt: true,
        worker: { select: { firstName: true, lastName: true } } 
    }
    });

    if (!appointment) {
      return { success: false, error: 'No se encontró ninguna cita asociada a este QR.' }
    }

    if (appointment.status === 'COMPLETED') {
      return { success: false, error: `El trabajador ${appointment.worker.firstName} ya realizó su Check-in.` }
    }

    if (appointment.status === 'CANCELLED') {
      return { success: false, error: 'Esta cita fue cancelada.' }
    }

    // Validación de horario
    const now = new Date();
    const scheduledDate = new Date(appointment.scheduledAt);

    // Margen de tolerancia: permitir Check-in desde 1 hora antes hasta 2 horas después
    // Usamos diferencia absoluta en horas para manejar correctamente el salto de día (ej. 23:30 -> 00:15)
    // Sin depender de "mismo día calendario", que rompe en la medianoche.
    
    // Cálculo de diferencia en minutos para mayor precisión
    const diffMs = now.getTime() - scheduledDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60000); // positivo = tarde, negativo = temprano

    // Si llega mas de 60 minutos TEMPRANO (-60)
    if (diffMinutes < -60) {
        return { 
            success: false, 
            error: `Cita programada para las ${scheduledDate.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}. Llegaste demasiado temprano.` 
        }
    }

    // Si llega mas de 2 horas (120 min) TARDE
    if (diffMinutes > 120) {
         return { 
            success: false, 
            error: `Tu cita expiró (Máx. 2 hrs de tolerancia). Es necesario reagendar.` 
        }
    }

    // Ejecutar check-in estándar
    return await checkInAppointment(appointment.id);

  } catch (error) {
    console.error('[QR CHECK-IN ERROR]:', error)
    return { success: false, error: 'Error interno al procesar QR.' }
  }
}

/**
 * Obtiene los datos necesarios para el paso de corroboración previo al check-in.
 * Devuelve datos del trabajador y la cita sin alterar ningún estado.
 * @id IMPL-20260318-08
 */
export async function getAppointmentForCorroboration(appointmentId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: 'No autenticado' }
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        expedientId: true,
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            universalId: true,
            phone: true,
            email: true,
            dob: true,
            companyId: true,
            jobPositionId: true,
            company: { select: { id: true, name: true } },
            jobPosition: { select: { id: true, name: true } },
          }
        },
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      }
    })

    if (!appointment) {
      return { success: false, error: 'Cita no encontrada' }
    }

    return { success: true, appointment }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error' }
  }
}

/**
 * Obtiene todas las citas del día para todas las sucursales (vista de monitoreo multi-sucursal).
 * @id IMPL-20260318-08
 */
export async function getAppointmentsForOverview(date: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: 'No autenticado' }
    }

    const targetDate = new Date(`${date}T12:00:00.000Z`)
    const startRange = new Date(targetDate)
    startRange.setDate(startRange.getDate() - 1)
    const endRange = new Date(targetDate)
    endRange.setDate(endRange.getDate() + 1)

    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: startRange, lte: endRange },
      },
      include: {
        worker: { select: { firstName: true, lastName: true } },
        company: { select: { name: true } },
        branch: { select: { id: true, name: true, hourlyCapacity: true, openingTime: true, closingTime: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    })

    return { success: true, appointments }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error' }
  }
}

