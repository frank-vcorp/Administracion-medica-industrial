'use server'

/**
 * @fileoverview Server Actions para Auditoría del Sistema
 * @description Registra todas las acciones críticas en la bitácora de auditoría (AuditLog)
 * @author SOFIA - Builder
 * @version 1.0.0
 * @id IMPL-20260225-05
 * 
 * Implementa funcionalidad de logging de auditoría para compliance y forensics.
 */

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

/**
 * Registra una acción en la bitácora de auditoría
 * @param action - Tipo de acción (CREATE, UPDATE, DELETE, LOGIN, CHECK_IN, etc.)
 * @param entity - Entidad afectada (Worker, Appointment, MedicalEvent, etc.)
 * @param entityId - ID de la entidad (opcional)
 * @param details - Datos adicionales como cambios antes/después (opcional)
 * @returns Registro de auditoría creado o error
 */
export async function logAudit(
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  try {
    // Obtener usuario autenticado de la sesión
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      throw new Error('Usuario no autenticado para registrar auditoría')
    }

    const auditRecord = await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        details: (details as Prisma.InputJsonValue) || {},
        userId: session.user.id,
        // ipAddress se podría obtener de headers si fuera necesario
        // Por ahora se omite por simplicidad
      },
    })

    return {
      success: true,
      auditId: auditRecord.id,
    }
  } catch (error) {
    console.error(`[AUDIT ERROR] ${action}/${entity}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al registrar auditoría',
    }
  }
}

/**
 * Obtiene los registros de auditoría (con permisos de ADMIN)
 * @param limit - Cantidad de registros a retornar
 * @param offset - Desplazamiento para paginación
 * @returns Registros de auditoría
 */
export async function getAuditLogs(limit: number = 50, offset: number = 0) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      throw new Error('Usuario no autenticado')
    }

    // Validar que sea ADMIN (opcional, depende de requerimientos)
    if (session.user.role !== 'ADMIN') {
      throw new Error('Permisos insuficientes para leer auditoría')
    }

    const logs = await prisma.auditLog.findMany({
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      success: true,
      logs,
    }
  } catch (error) {
    console.error('[AUDIT LOGS ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener auditoría',
    }
  }
}
