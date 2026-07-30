/**
 * Server Actions para MaintenanceRecord — IMPL-20260711-01
 * @id IMPL-20260711-01
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 * @backup context/interconsultas/HANDOFF_ARCH-20260711-01_SOFIA_UNIDADES-MOVILES.md
 *
 * Reglas de negocio:
 *   - §3.1: una unidad no puede tener proyecto + mantenimiento PROGRAMADO en la misma fecha.
 *   - §3.2: reprogramar mantiene original + crea nuevo registro (status REPROGRAMADO).
 *   - §3.2: al completar, nextDueDate auto-calculado por tipo: PREVENTIVO +90d, VERIFICACION +365d,
 *           LIMPIEZA +30d, CORRECTIVO none.
 *   - §3.5: solo ADMIN crea/edita. Lectura a todos los autenticados.
 */
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { isAdminLike } from '@/lib/auth/roles'
import { calculateNextDueDate } from './maintenance.helpers'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TYPE_VALUES = ['PREVENTIVO', 'CORRECTIVO', 'VERIFICACION', 'LIMPIEZA'] as const
const STATUS_VALUES = ['PROGRAMADO', 'COMPLETADO', 'CANCELADO', 'REPROGRAMADO'] as const
void STATUS_VALUES

const CreateMaintenanceSchema = z.object({
  mobileUnitId: z.string().min(1),
  type: z.enum(TYPE_VALUES),
  scheduledDate: z.string().datetime(),
  description: z.string().min(1).max(2000),
  technician: z.string().max(200).optional(),
  cost: z.number().min(0).optional(),
  nextDueDate: z.string().datetime().optional(),
  attachments: z.array(z.object({
    url: z.string(),
    type: z.string(),
    uploadedAt: z.string().datetime(),
  })).optional(),
})

const UpdateMaintenanceSchema = z.object({
  type: z.enum(TYPE_VALUES).optional(),
  scheduledDate: z.string().datetime().optional(),
  description: z.string().min(1).max(2000).optional(),
  technician: z.string().max(200).optional(),
  cost: z.number().min(0).optional(),
  nextDueDate: z.string().datetime().optional().nullable(),
})

const CompleteMaintenanceSchema = z.object({
  completedDate: z.string().datetime(),
  cost: z.number().min(0),
  attachments: z.array(z.object({
    url: z.string(),
    type: z.string(),
    uploadedAt: z.string().datetime(),
  })).optional(),
  notes: z.string().max(2000).optional(),
})

// ─── Helpers de auth ─────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || !isAdminLike(session.user.role)) return null
  return session
}

async function requireAnyAuth() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  return session
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getMaintenanceRecords(
  mobileUnitId: string,
  status?: (typeof STATUS_VALUES)[number]
) {
  const session = await requireAnyAuth()
  if (!session) return []

  return prisma.maintenanceRecord.findMany({
    where: {
      mobileUnitId,
      ...(status ? { status } : {}),
    },
    orderBy: { scheduledDate: 'desc' },
  })
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

export async function createMaintenanceRecord(
  data: z.infer<typeof CreateMaintenanceSchema>
) {
  const session = await requireAdmin()
  if (!session) return { success: false as const, error: 'No autorizado' }

  const parsed = CreateMaintenanceSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const unit = await prisma.mobileUnit.findUnique({ where: { id: parsed.data.mobileUnitId } })
  if (!unit) return { success: false as const, error: 'Unidad no encontrada' }

  // SPEC §3.1 — validar disponibilidad
  const scheduled = new Date(parsed.data.scheduledDate)
  const conflict = await checkMaintenanceConflicts(parsed.data.mobileUnitId, scheduled)
  if (!conflict.available) {
    const suggestions = conflict.suggestions.map((s) => s.label).join(', ')
    return {
      success: false as const,
      error: `La unidad tiene proyecto el ${scheduled.toISOString().slice(0, 10)}. Alternativas: ${suggestions || ' ninguna en 21 días'}`,
    }
  }

  try {
    const record = await prisma.maintenanceRecord.create({
      data: {
        mobileUnitId: parsed.data.mobileUnitId,
        type: parsed.data.type,
        status: 'PROGRAMADO',
        scheduledDate: scheduled,
        description: parsed.data.description,
        technician: parsed.data.technician ?? null,
        cost: parsed.data.cost ?? null,
        nextDueDate: parsed.data.nextDueDate ? new Date(parsed.data.nextDueDate) : null,
        attachments: parsed.data.attachments
          ? (parsed.data.attachments as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        createdBy: session.user.id,
      },
    })
    revalidatePath(`/admin/mobile-units/${parsed.data.mobileUnitId}/maintenance`)
    revalidatePath('/admin/mobile-units')
    return { success: true as const, record }
  } catch (e: unknown) {
    const err = e as Error
    console.error('[createMaintenanceRecord]', err.message)
    return { success: false as const, error: 'Error al crear el mantenimiento' }
  }
}

export async function updateMaintenanceRecord(
  recordId: string,
  data: z.infer<typeof UpdateMaintenanceSchema>
) {
  const session = await requireAdmin()
  if (!session) return { success: false as const, error: 'No autorizado' }

  const parsed = UpdateMaintenanceSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  try {
    const existing = await prisma.maintenanceRecord.findUnique({ where: { id: recordId } })
    if (!existing) return { success: false as const, error: 'Mantenimiento no encontrado' }

    const updateData: Prisma.MaintenanceRecordUpdateInput = {}
    if (parsed.data.type !== undefined) updateData.type = parsed.data.type
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description
    if (parsed.data.technician !== undefined) updateData.technician = parsed.data.technician
    if (parsed.data.cost !== undefined) updateData.cost = parsed.data.cost
    if (parsed.data.scheduledDate !== undefined) {
      updateData.scheduledDate = new Date(parsed.data.scheduledDate)
    }
    if (parsed.data.nextDueDate !== undefined) {
      updateData.nextDueDate = parsed.data.nextDueDate ? new Date(parsed.data.nextDueDate) : null
    }

    await prisma.maintenanceRecord.update({ where: { id: recordId }, data: updateData })
    revalidatePath(`/admin/mobile-units/${existing.mobileUnitId}/maintenance`)
    return { success: true as const }
  } catch (e: unknown) {
    const err = e as Error
    console.error('[updateMaintenanceRecord]', err.message)
    return { success: false as const, error: 'Error al actualizar el mantenimiento' }
  }
}

/**
 * SPEC §3.2 / §4.2 — reprograma un mantenimiento:
 *   1. Marca el original como REPROGRAMADO (con rescheduledTo).
 *   2. Crea un NUEVO MaintenanceRecord con la nueva fecha (linked al original vía description).
 *   3. Si la nueva fecha también tiene conflicto, rechaza y devuelve alternativas.
 */
export async function reprogramMaintenance(
  recordId: string,
  newDate: string,
  reason?: string
) {
  const session = await requireAdmin()
  if (!session) return { success: false as const, error: 'No autorizado' }

  const newDateObj = new Date(newDate)
  if (Number.isNaN(newDateObj.getTime())) {
    return { success: false as const, error: 'Fecha inválida' }
  }

  try {
    const original = await prisma.maintenanceRecord.findUnique({ where: { id: recordId } })
    if (!original) return { success: false as const, error: 'Mantenimiento no encontrado' }

    // Validar la nueva fecha
    const conflict = await checkMaintenanceConflicts(original.mobileUnitId, newDateObj)
    if (!conflict.available) {
      return {
        success: false as const,
        error: `La nueva fecha (${newDateObj.toISOString().slice(0, 10)}) también tiene conflicto. Alternativas: ${conflict.suggestions.map((s) => s.label).join(', ') || ' ninguna'}`,
      }
    }

    const suffix = `\n[REPROGRAMADO ${new Date().toISOString().slice(0, 10)} → ${newDateObj.toISOString().slice(0, 10)}]` +
      (reason ? ` — ${reason}` : '')

    await prisma.$transaction([
      prisma.maintenanceRecord.update({
        where: { id: recordId },
        data: {
          status: 'REPROGRAMADO',
          rescheduledTo: newDateObj,
          description: (original.description ?? '') + suffix,
        },
      }),
      prisma.maintenanceRecord.create({
        data: {
          mobileUnitId: original.mobileUnitId,
          type: original.type,
          status: 'PROGRAMADO',
          scheduledDate: newDateObj,
          description: (original.description ?? '') + suffix,
          technician: original.technician,
          cost: original.cost,
          nextDueDate: original.nextDueDate,
          createdBy: original.createdBy,
        },
      }),
    ])

    revalidatePath(`/admin/mobile-units/${original.mobileUnitId}/maintenance`)
    return { success: true as const }
  } catch (e: unknown) {
    const err = e as Error
    console.error('[reprogramMaintenance]', err.message)
    return { success: false as const, error: 'Error al reprogramar el mantenimiento' }
  }
}

/**
 * SPEC §3.2 / §4.2 — completa el mantenimiento:
 *   - status = COMPLETADO
 *   - completedDate y completedBy se guardan
 *   - nextDueDate auto-calculado (PREVENTIVO +90d, VERIFICACION +365d, LIMPIEZA +30d, CORRECTIVO null)
 */
export async function completeMaintenance(
  recordId: string,
  data: z.infer<typeof CompleteMaintenanceSchema>
) {
  const session = await requireAdmin()
  if (!session) return { success: false as const, error: 'No autorizado' }

  const parsed = CompleteMaintenanceSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  try {
    const existing = await prisma.maintenanceRecord.findUnique({ where: { id: recordId } })
    if (!existing) return { success: false as const, error: 'Mantenimiento no encontrado' }

    const completedDate = new Date(parsed.data.completedDate)
    const nextDue = calculateNextDueDate(completedDate, existing.type, null)

    await prisma.maintenanceRecord.update({
      where: { id: recordId },
      data: {
        status: 'COMPLETADO',
        completedDate,
        completedBy: session.user.id,
        cost: parsed.data.cost,
        attachments: parsed.data.attachments
          ? (parsed.data.attachments as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        description: parsed.data.notes
          ? `${existing.description}\n[NOTAS] ${parsed.data.notes}`
          : existing.description,
        nextDueDate: nextDue,
      },
    })

    revalidatePath(`/admin/mobile-units/${existing.mobileUnitId}/maintenance`)
    return { success: true as const, nextDueDate: nextDue }
  } catch (e: unknown) {
    const err = e as Error
    console.error('[completeMaintenance]', err.message)
    return { success: false as const, error: 'Error al completar el mantenimiento' }
  }
}

// ─── Helpers internos (testeables por separado) ─────────────────────────────

/**
 * SPEC §3.1 — verifica si hay proyecto activo en una fecha para esa unidad.
 * Devuelve sugerencias +N días (N=7,14,21) que están libres, hasta 3.
 */
export async function checkMaintenanceConflicts(
  mobileUnitId: string,
  scheduledDate: Date
): Promise<{
  available: boolean
  conflicts: Array<{ type: string; id?: string | null; name?: string | null }>
  suggestions: Array<{ iso: string; label: string }>
}> {
  const dayStart = new Date(scheduledDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(scheduledDate)
  dayEnd.setHours(23, 59, 59, 999)

  const conflictingProjects = await prisma.project.findMany({
    where: {
      mobileUnitId,
      NOT: { status: 'CANCELLED' },
      AND: [{ startDate: { lte: dayEnd } }, { endDate: { gte: dayStart } }],
    },
    select: { id: true, name: true },
  })

  const conflictingMaintenances = await prisma.maintenanceRecord.findMany({
    where: {
      mobileUnitId,
      status: { in: ['PROGRAMADO', 'REPROGRAMADO'] },
      scheduledDate: { gte: dayStart, lte: dayEnd },
    },
    select: { id: true, type: true },
  })

  const conflicts: Array<{ type: string; id?: string | null; name?: string | null }> = []
  for (const p of conflictingProjects) {
    conflicts.push({ type: 'project', id: p.id, name: p.name })
  }
  for (const m of conflictingMaintenances) {
    conflicts.push({ type: 'maintenance', id: m.id, name: m.type })
  }

  const suggestions: Array<{ iso: string; label: string }> = []
  for (const days of [7, 14, 21]) {
    if (suggestions.length >= 3) break
    const candidate = new Date(dayStart.getTime() + days * 86400_000)
    const cStart = new Date(candidate)
    cStart.setHours(0, 0, 0, 0)
    const cEnd = new Date(candidate)
    cEnd.setHours(23, 59, 59, 999)
    const pProjects = await prisma.project.count({
      where: {
        mobileUnitId,
        NOT: { status: 'CANCELLED' },
        AND: [{ startDate: { lte: cEnd } }, { endDate: { gte: cStart } }],
      },
    })
    const pMaintenances = await prisma.maintenanceRecord.count({
      where: {
        mobileUnitId,
        status: { in: ['PROGRAMADO', 'REPROGRAMADO'] },
        scheduledDate: { gte: cStart, lte: cEnd },
      },
    })
    if (pProjects === 0 && pMaintenances === 0) {
      suggestions.push({
        iso: candidate.toISOString(),
        label: `+${days} días (${candidate.toISOString().slice(0, 10)})`,
      })
    }
  }

  return {
    available: conflicts.length === 0,
    conflicts,
    suggestions,
  }
}
