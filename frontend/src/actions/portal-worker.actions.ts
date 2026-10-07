'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { logAudit } from '@/actions/audit.actions'
import { checkBranchHourCapacity } from '@/lib/appointment-capacity'
import { parseAppointmentLocalDateTime } from '@/lib/appointment-scheduling'
import { generateUniversalId } from '@/lib/id.utils'
import { resolvePortalCompanyAccess } from '@/lib/portal-access'
import prisma from '@/lib/prisma'
import { UserRole } from '@prisma/client'

async function assertPortalClientCanMutateWorkers() {
  const access = await resolvePortalCompanyAccess()
  if (access.isPreview) {
    return { ok: false as const, error: 'En vista previa no se registran trabajadores.' }
  }
  if (access.actorRole !== UserRole.COMPANY_CLIENT) {
    return { ok: false as const, error: 'Solo usuarios del portal cliente pueden registrar aquí.' }
  }
  return { ok: true as const, companyId: access.companyId }
}

async function isBranchAllowedForCompany(companyId: string, branchId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      defaultBranchId: true,
      allowedBranches: { select: { id: true } },
    },
  })
  if (!company) return false
  const allowed = new Set<string>()
  if (company.defaultBranchId) allowed.add(company.defaultBranchId)
  for (const b of company.allowedBranches) allowed.add(b.id)
  return allowed.has(branchId)
}

const QuickWorkerRowSchema = z.object({
  firstName: z.string().trim().min(1, 'Nombre obligatorio').max(120),
  lastName: z.string().trim().min(1, 'Apellidos obligatorios').max(120),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => !v || v.replace(/\D/g, '').length >= 10, {
      message: 'Teléfono inválido (mínimo 10 dígitos)',
    }),
})

const QuickRegisterSchema = z.object({
  branchId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{1,2}:\d{2}$/),
  workers: z.array(QuickWorkerRowSchema).min(1),
})

export type PortalWorkerListItem = {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  medicalProfileId: string | null
  medicalProfile: { id: string; name: string } | null
}

export async function listPortalCompanyWorkers(): Promise<
  { success: true; workers: PortalWorkerListItem[] } | { success: false; error: string }
> {
  const access = await resolvePortalCompanyAccess()
  if (!access.isPreview && access.actorRole !== UserRole.COMPANY_CLIENT) {
    return { success: false, error: 'No autorizado' }
  }

  const workers = await prisma.worker.findMany({
    where: { companyId: access.companyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      medicalProfileId: true,
      medicalProfile: { select: { id: true, name: true } },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  return { success: true, workers }
}

export async function quickRegisterPortalWorkers(input: {
  branchId: string
  date: string
  time: string
  workers: Array<{ firstName: string; lastName: string; phone?: string }>
}) {
  const gate = await assertPortalClientCanMutateWorkers()
  if (!gate.ok) return { success: false as const, error: gate.error }

  const parsed = QuickRegisterSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
    }
  }

  const { branchId, date, time, workers: rows } = parsed.data

  if (!(await isBranchAllowedForCompany(gate.companyId, branchId))) {
    return { success: false as const, error: 'Sucursal no autorizada.' }
  }

  const scheduledAt = parseAppointmentLocalDateTime(date, time)
  const capacityCheck = await checkBranchHourCapacity(prisma, branchId, scheduledAt)
  if (!capacityCheck.ok && capacityCheck.capacity === 0) {
    return { success: false as const, error: 'Sucursal no disponible.' }
  }

  const slotsRemaining = Math.max(0, capacityCheck.capacity - capacityCheck.count)
  if (slotsRemaining === 0) {
    return {
      success: false as const,
      error: 'BRANCH_HOUR_FULL',
      userMessage:
        'Este horario ya no tiene cupo. Elija la siguiente hora disponible o solicite atención personalizada.',
    }
  }

  if (rows.length > slotsRemaining) {
    return {
      success: false as const,
      error: 'CAPACITY_EXCEEDED',
      userMessage: `Solo puede registrar hasta ${slotsRemaining} trabajador${slotsRemaining !== 1 ? 'es' : ''} en ${time} (cupo de la sucursal). Agende el resto en otra hora.`,
      slotsRemaining,
    }
  }

  const created: PortalWorkerListItem[] = []
  const skipped: Array<{ name: string; reason: string }> = []

  for (const row of rows) {
    const duplicate = await prisma.worker.findFirst({
      where: {
        firstName: { equals: row.firstName, mode: 'insensitive' },
        lastName: { equals: row.lastName, mode: 'insensitive' },
        companyId: gate.companyId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        medicalProfileId: true,
        medicalProfile: { select: { id: true, name: true } },
      },
    })

    if (duplicate) {
      if (row.phone && !duplicate.phone) {
        await prisma.worker.update({
          where: { id: duplicate.id },
          data: { phone: row.phone.trim() },
        })
        duplicate.phone = row.phone.trim()
      }
      created.push(duplicate)
      skipped.push({
        name: `${row.firstName} ${row.lastName}`,
        reason: 'Ya estaba registrado; se seleccionó el existente.',
      })
      continue
    }

    const universalId = generateUniversalId({
      firstName: row.firstName,
      lastName: row.lastName,
    })

    const worker = await prisma.worker.create({
      data: {
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        phone: row.phone?.trim() || null,
        universalId,
        companyId: gate.companyId,
        branchId,
        intakeSource: 'APPOINTMENT',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        medicalProfileId: true,
        medicalProfile: { select: { id: true, name: true } },
      },
    })
    created.push(worker)
  }

  await logAudit('CREATE', 'Worker', gate.companyId, {
    action: 'PORTAL_QUICK_WORKER_REGISTER',
    count: created.length,
    branchId,
    date,
    time,
    slotsRemainingBefore: slotsRemaining,
  })

  revalidatePath('/portal/appointments/new')
  revalidatePath('/portal/events')

  return {
    success: true as const,
    workers: created,
    skipped,
    message: `Se registraron ${created.length} trabajador${created.length !== 1 ? 'es' : ''} para agendar en ${time}.`,
  }
}
