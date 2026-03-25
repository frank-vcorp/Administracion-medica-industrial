'use server'

/**
 * @fileoverview Server Actions para Portal de Prellenado Temporal — Corte A1 Backend-Safe
 * @description Lógica de generación de invitaciones, validación de tokens y persistencia
 *              del Módulo 1 del Examen Médico.
 *              NO expone rutas públicas. El portal public route se implementará en Corte A2+.
 * @see SPEC ARCH-20260324-09 (Portal Temporal), ARCH-20260324-08 (Examen Médico Dividido)
 * @id IMPL-20260324-07
 */

import { createHash, randomBytes } from 'crypto'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import {
  GenerateInvitationInputSchema,
  SaveModule1InputSchema,
} from '@/schemas/clinical/prefilled.schema'

/** Vigencia de la invitación según SPEC: 6 horas */
const INVITATION_TTL_HOURS = 6

/** Genera un token aleatorio seguro (32 bytes → base64url, ~43 caracteres) */
function generatePlainToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Hashea el token plano con SHA-256 para almacenamiento seguro en DB */
function hashToken(plainToken: string): string {
  return createHash('sha256').update(plainToken).digest('hex')
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions de staff (autenticadas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera una invitación temporal de prellenado para una cita.
 * Si existe una invitación activa previa para la misma cita, la invalida (CANCELLED)
 * antes de crear la nueva. Devuelve el token plano UNA SOLA VEZ.
 *
 * @param rawInput - { appointmentId: string, channel?: 'WHATSAPP'|'LINK'|'QR'|'TABLET' }
 * @returns plainToken y expiresAt para construir el enlace de invitación
 */
export async function generateInvitation(rawInput: unknown) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false, error: 'No autenticado' }
  }

  const parsed = GenerateInvitationInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: 'Datos de entrada inválidos', details: parsed.error.flatten() }
  }

  const { appointmentId, channel } = parsed.data

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true },
  })
  if (!appointment) {
    return { success: false, error: 'Cita no encontrada' }
  }

  const plainToken = generatePlainToken()
  const tokenHash  = hashToken(plainToken)
  const expiresAt  = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000)

  // Cancelar invitaciones previas activas y crear la nueva, de forma atómica
  await prisma.$transaction(async (tx) => {
    await tx.prefilledInvitation.updateMany({
      where: {
        appointmentId,
        status: { in: ['INVITATION_ACTIVE', 'OPENED', 'PARTIAL'] },
      },
      data: { status: 'CANCELLED' },
    })

    await tx.prefilledInvitation.create({
      data: {
        appointmentId,
        tokenHash,
        expiresAt,
        status: 'INVITATION_ACTIVE',
        channel: channel ?? null,
        generatedById: session.user.id,
      },
    })
  })

  return {
    success: true,
    data: {
      plainToken,  // Mostrar una sola vez para construir la URL de invitación
      expiresAt,
      channel: channel ?? null,
    },
  }
}

/**
 * Devuelve el estado actual de la invitación para una cita.
 * Uso exclusivo de staff autenticado (recepción, médico).
 * Auto-expira el registro si la vigencia ya pasó.
 *
 * @param appointmentId - UUID de la cita
 */
export async function getInvitationStatus(appointmentId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { success: false, error: 'No autenticado' }
  }

  const invitation = await prisma.prefilledInvitation.findUnique({
    where: { appointmentId },
    select: {
      id:          true,
      status:      true,
      expiresAt:   true,
      channel:     true,
      openedCount: true,
      submittedAt: true,
      createdAt:   true,
    },
  })

  if (!invitation) {
    return { success: true, data: { status: 'NOT_GENERATED' as const } }
  }

  // Auto-expirar si la vigencia terminó y aún está en estado abierto
  const needsExpiry =
    ['INVITATION_ACTIVE', 'OPENED', 'PARTIAL'].includes(invitation.status) &&
    invitation.expiresAt < new Date()

  if (needsExpiry) {
    await prisma.prefilledInvitation.update({
      where: { appointmentId },
      data: { status: 'EXPIRED' },
    })
    return { success: true, data: { ...invitation, status: 'EXPIRED' as const } }
  }

  return { success: true, data: invitation }
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions del portal público (SIN autenticación de sesión — validación por token)
// Preparadas para Corte A2+; sin rutas UI todavía.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida un token público e incrementa el contador de aperturas.
 * Retorna únicamente los datos mínimos necesarios para renderizar el portal:
 * nombre del trabajador, empresa, expiración y datos previamente guardados.
 * NO expone IDs internos consecutivos ni información clínica del médico.
 *
 * @param plainToken - Token plano recibido en la URL del portal
 */
export async function validatePublicToken(plainToken: string) {
  if (!plainToken || plainToken.length < 10) {
    return { success: false, error: 'TOKEN_INVALID' }
  }

  const tokenHash = hashToken(plainToken)

  const invitation = await prisma.prefilledInvitation.findUnique({
    where: { tokenHash },
    include: {
      appointment: {
        select: {
          id:          true,
          scheduledAt: true,
          worker: {
            select: {
              firstName: true,
              lastName:  true,
              dob:       true,
              company:   { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (!invitation) {
    return { success: false, error: 'TOKEN_INVALID' }
  }

  if (invitation.expiresAt < new Date()) {
    // Marcar como expirado si aún no lo está
    if (!['EXPIRED', 'SUBMITTED', 'CANCELLED'].includes(invitation.status)) {
      await prisma.prefilledInvitation.update({
        where: { tokenHash },
        data: { status: 'EXPIRED' },
      })
    }
    return { success: false, error: 'TOKEN_EXPIRED' }
  }

  if (invitation.status === 'CANCELLED') {
    return { success: false, error: 'TOKEN_CANCELLED' }
  }

  if (invitation.status === 'SUBMITTED') {
    return { success: false, error: 'TOKEN_ALREADY_SUBMITTED' }
  }

  // Registrar apertura
  const newStatus = invitation.status === 'INVITATION_ACTIVE' ? 'OPENED' : invitation.status
  await prisma.prefilledInvitation.update({
    where: { tokenHash },
    data: {
      status:      newStatus,
      openedCount: { increment: 1 },
    },
  })

  return {
    success: true,
    data: {
      invitationId:  invitation.id,
      expiresAt:     invitation.expiresAt,
      workerName:    `${invitation.appointment.worker.firstName} ${invitation.appointment.worker.lastName}`,
      companyName:   invitation.appointment.worker.company?.name ?? null,
      scheduledAt:   invitation.appointment.scheduledAt,
      existingData:  invitation.module1Data ?? null,
    },
  }
}

/**
 * Guarda avance parcial del Módulo 1 (guardado automático o manual).
 * Puede llamarse múltiples veces mientras el token esté vigente.
 * No marca el formulario como enviado.
 *
 * @param plainToken - Token plano del portal
 * @param rawData    - Datos del Módulo 1 (parciales)
 */
export async function savePartialModule1(plainToken: string, rawData: unknown) {
  if (!plainToken) return { success: false, error: 'Token requerido' }

  const tokenHash  = hashToken(plainToken)
  const invitation = await prisma.prefilledInvitation.findUnique({
    where: { tokenHash },
    select: { status: true, expiresAt: true },
  })

  if (!invitation)                           return { success: false, error: 'TOKEN_INVALID' }
  if (invitation.expiresAt < new Date())     return { success: false, error: 'TOKEN_EXPIRED' }
  if (invitation.status === 'SUBMITTED')     return { success: false, error: 'YA_ENVIADO' }
  if (['CANCELLED', 'EXPIRED'].includes(invitation.status)) {
    return { success: false, error: 'TOKEN_INACTIVO' }
  }

  const parsed = SaveModule1InputSchema.safeParse({ plainToken, data: rawData, isFinal: false })
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos', details: parsed.error.flatten() }
  }

  await prisma.prefilledInvitation.update({
    where: { tokenHash },
    data: {
      module1Data: parsed.data.data as object,
      status:      'PARTIAL',
    },
  })

  return { success: true }
}

/**
 * Envío final del Módulo 1 por parte del trabajador.
 * Marca la invitación como SUBMITTED y registra la fecha/hora de envío.
 * El token queda inactivo para nuevas modificaciones después de esto.
 *
 * @param plainToken - Token plano del portal
 * @param rawData    - Datos completos del Módulo 1
 */
export async function submitModule1(plainToken: string, rawData: unknown) {
  if (!plainToken) return { success: false, error: 'Token requerido' }

  const tokenHash  = hashToken(plainToken)
  const invitation = await prisma.prefilledInvitation.findUnique({
    where: { tokenHash },
    select: { status: true, expiresAt: true },
  })

  if (!invitation)                           return { success: false, error: 'TOKEN_INVALID' }
  if (invitation.expiresAt < new Date())     return { success: false, error: 'TOKEN_EXPIRED' }
  if (invitation.status === 'SUBMITTED')     return { success: false, error: 'YA_ENVIADO' }
  if (['CANCELLED', 'EXPIRED'].includes(invitation.status)) {
    return { success: false, error: 'TOKEN_INACTIVO' }
  }

  const parsed = SaveModule1InputSchema.safeParse({ plainToken, data: rawData, isFinal: true })
  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos', details: parsed.error.flatten() }
  }

  await prisma.prefilledInvitation.update({
    where: { tokenHash },
    data: {
      module1Data: parsed.data.data as object,
      status:      'SUBMITTED',
      submittedAt: new Date(),
    },
  })

  return { success: true }
}
