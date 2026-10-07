'use server'

import { UserRole } from '@prisma/client'
import { createAppointment } from '@/actions/appointment.actions'
import { getAssignableMedicalProfilesForCompany } from '@/actions/medical-profiles'
import {
  branchOperatingHours,
  checkBranchHourCapacity,
  computeBranchDayAvailabilityForDates,
  countAppointmentsByHourForDay,
} from '@/lib/appointment-capacity'
import {
  addAgendaDays,
  formatAppointmentAgendaTime,
  getAgendaWeekStartMonday,
  parseAppointmentLocalDateTime,
  todayAgendaDateString,
} from '@/lib/appointment-scheduling'
import { logAudit } from '@/actions/audit.actions'
import { getPortalLogisticsWhatsAppPhone } from '@/lib/portal-logistics-whatsapp'
import { sendInstitutionalWhatsAppMessage } from '@/lib/portal-institutional-whatsapp'
import { buildPortalSpecialRequestMessage } from '@/lib/portal-special-request-message'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { resolvePortalCompanyAccess } from '@/lib/portal-access'
import prisma from '@/lib/prisma'

/** Lectura del panel (cliente o staff en vista previa). */
async function resolvePortalBookingViewAccess() {
  const access = await resolvePortalCompanyAccess()
  if (access.isPreview) {
    return { ok: true as const, companyId: access.companyId, isPreview: true as const }
  }
  if (access.actorRole !== UserRole.COMPANY_CLIENT) {
    return { ok: false as const, error: 'Solo usuarios del portal cliente pueden ver esta sección.' }
  }
  return { ok: true as const, companyId: access.companyId, isPreview: false as const }
}

/** Escritura: solo usuario portal real (no vista previa staff). */
async function assertPortalClientCanBook() {
  const access = await resolvePortalCompanyAccess()
  if (access.isPreview) {
    return { ok: false as const, error: 'En vista previa no se guardan citas ni solicitudes.' }
  }
  if (access.actorRole !== UserRole.COMPANY_CLIENT) {
    return { ok: false as const, error: 'Solo usuarios del portal cliente pueden agendar aquí.' }
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

export async function getPortalAppointmentBookingContext() {
  const gate = await resolvePortalBookingViewAccess()
  if (!gate.ok) return { success: false as const, error: gate.error }

  const company = await prisma.company.findUnique({
    where: { id: gate.companyId },
    select: {
      id: true,
      name: true,
      defaultBranchId: true,
      defaultBranch: {
        select: {
          id: true,
          name: true,
          hourlyCapacity: true,
          openingTime: true,
          closingTime: true,
        },
      },
      allowedBranches: {
        select: {
          id: true,
          name: true,
          hourlyCapacity: true,
          openingTime: true,
          closingTime: true,
        },
      },
    },
  })
  if (!company) return { success: false as const, error: 'Empresa no encontrada' }

  const branchMap = new Map<string, NonNullable<typeof company.defaultBranch>>()
  if (company.defaultBranch) branchMap.set(company.defaultBranch.id, company.defaultBranch)
  for (const b of company.allowedBranches) {
    branchMap.set(b.id, b)
  }
  const branches = [...branchMap.values()]

  const workers = await prisma.worker.findMany({
    where: { companyId: gate.companyId },
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

  const profiles = await getAssignableMedicalProfilesForCompany(gate.companyId)

  return {
    success: true as const,
    companyName: company.name,
    defaultBranchId: company.defaultBranchId,
    branches,
    workers,
    profiles,
    suggestedDate: todayAgendaDateString(),
    isPreview: gate.isPreview,
  }
}

export async function getPortalBranchHourAvailability(input: {
  branchId: string
  date: string
}) {
  const gate = await resolvePortalBookingViewAccess()
  if (!gate.ok) return { success: false as const, error: gate.error }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { success: false as const, error: 'Fecha inválida' }
  }
  if (!(await isBranchAllowedForCompany(gate.companyId, input.branchId))) {
    return { success: false as const, error: 'Sucursal no autorizada' }
  }

  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    select: {
      hourlyCapacity: true,
      openingTime: true,
      closingTime: true,
      isActive: true,
    },
  })
  if (!branch?.isActive) {
    return { success: false as const, error: 'Sucursal no disponible' }
  }

  const capacity = branch.hourlyCapacity ?? 15
  const hours = branchOperatingHours(branch.openingTime, branch.closingTime)
  const byHour = await countAppointmentsByHourForDay(prisma, input.branchId, input.date)
  const slots = hours.map((hour) => {
    const count = byHour.get(hour) ?? 0
    return {
      hour,
      count,
      capacity,
      full: count >= capacity,
    }
  })

  return { success: true as const, slots }
}

export async function getPortalBranchMonthAvailability(input: {
  branchId: string
  month: string
}) {
  const gate = await resolvePortalBookingViewAccess()
  if (!gate.ok) return { success: false as const, error: gate.error }

  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    return { success: false as const, error: 'Mes inválido' }
  }
  if (!(await isBranchAllowedForCompany(gate.companyId, input.branchId))) {
    return { success: false as const, error: 'Sucursal no autorizada' }
  }

  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    select: {
      hourlyCapacity: true,
      openingTime: true,
      closingTime: true,
      isActive: true,
    },
  })
  if (!branch?.isActive) {
    return { success: false as const, error: 'Sucursal no disponible' }
  }

  const firstOfMonth = `${input.month}-01`
  const gridStart = getAgendaWeekStartMonday(firstOfMonth)
  const dateStrings: string[] = []
  for (let i = 0; i < 42; i++) {
    dateStrings.push(addAgendaDays(gridStart, i))
  }

  const capacity = branch.hourlyCapacity ?? 15
  const days = await computeBranchDayAvailabilityForDates(
    prisma,
    input.branchId,
    dateStrings,
    {
      hourlyCapacity: capacity,
      openingTime: branch.openingTime,
      closingTime: branch.closingTime,
    },
    todayAgendaDateString(),
  )

  return { success: true as const, month: input.month, days, hourlyCapacity: capacity }
}

export async function getPortalBranchWeekAvailability(input: {
  branchId: string
  weekStart: string
}) {
  const gate = await resolvePortalBookingViewAccess()
  if (!gate.ok) return { success: false as const, error: gate.error }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart)) {
    return { success: false as const, error: 'Semana inválida' }
  }
  if (!(await isBranchAllowedForCompany(gate.companyId, input.branchId))) {
    return { success: false as const, error: 'Sucursal no autorizada' }
  }

  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    select: {
      name: true,
      hourlyCapacity: true,
      openingTime: true,
      closingTime: true,
      isActive: true,
    },
  })
  if (!branch?.isActive) {
    return { success: false as const, error: 'Sucursal no disponible' }
  }

  const weekStart = getAgendaWeekStartMonday(input.weekStart)
  const dateStrings = Array.from({ length: 7 }, (_, i) => addAgendaDays(weekStart, i))
  const capacity = branch.hourlyCapacity ?? 15
  const days = await computeBranchDayAvailabilityForDates(
    prisma,
    input.branchId,
    dateStrings,
    {
      hourlyCapacity: capacity,
      openingTime: branch.openingTime,
      closingTime: branch.closingTime,
    },
    todayAgendaDateString(),
  )

  return {
    success: true as const,
    weekStart,
    days,
    branchName: branch.name,
    hourlyCapacity: capacity,
  }
}

export async function createPortalClientAppointment(input: {
  workerId: string
  branchId: string
  date: string
  time: string
  serviceProfileId?: string | null
  notes?: string
}) {
  const gate = await assertPortalClientCanBook()
  if (!gate.ok) return { success: false as const, error: gate.error }

  const worker = await prisma.worker.findFirst({
    where: { id: input.workerId, companyId: gate.companyId },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!worker) {
    return { success: false as const, error: 'Trabajador no válido para su empresa.' }
  }

  if (!(await isBranchAllowedForCompany(gate.companyId, input.branchId))) {
    return { success: false as const, error: 'Sucursal no autorizada.' }
  }

  const scheduledAt = parseAppointmentLocalDateTime(input.date, input.time)
  const capacityCheck = await checkBranchHourCapacity(prisma, input.branchId, scheduledAt)
  if (!capacityCheck.ok) {
    return {
      success: false as const,
      error: 'BRANCH_HOUR_FULL',
      userMessage:
        'Este horario ya alcanzó el límite de citas por hora. Use la solicitud personalizada e indique cuántas citas necesita.',
      capacity: capacityCheck,
    }
  }

  const result = await createAppointment({
    workerId: input.workerId,
    companyId: gate.companyId,
    branchId: input.branchId,
    scheduledAt,
    notes: input.notes?.trim() || undefined,
    source: 'PORTAL_B2B',
    serviceProfileId: input.serviceProfileId ?? null,
  })

  if (!result.success) {
    if (result.error === 'BRANCH_HOUR_FULL') {
      return {
        success: false as const,
        error: 'BRANCH_HOUR_FULL',
        userMessage:
          'Este horario ya alcanzó el límite de citas por hora. Use la solicitud personalizada e indique cuántas citas necesita.',
        capacity: result.capacity ?? capacityCheck,
      }
    }
    return {
      success: false as const,
      error: result.error ?? 'No se pudo crear la cita',
    }
  }

  const apt = result.appointment
  return {
    success: true as const,
    appointment: apt
      ? {
          id: apt.id,
          expedientId: apt.expedientId,
          scheduledAt: apt.scheduledAt.toISOString(),
          scheduledTimeLabel: formatAppointmentAgendaTime(apt.scheduledAt),
        }
      : null,
  }
}

export async function submitPortalSpecialRequestContact(input: {
  appointmentCount: number
  branchId: string
  date?: string
  time?: string
  reason: 'capacity_full' | 'custom'
  contactPhone: string
  comment?: string
}) {
  const gate = await assertPortalClientCanBook()
  if (!gate.ok) return { success: false as const, error: gate.error }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false as const, error: 'Sesión no válida.' }
  }

  const count = Math.floor(input.appointmentCount)
  if (!Number.isFinite(count) || count < 1 || count > 500) {
    return { success: false as const, error: 'Indique cuántas citas necesita (1–500).' }
  }

  const contactPhone = input.contactPhone.trim()
  if (contactPhone.replace(/\D/g, '').length < 10) {
    return { success: false as const, error: 'Ingrese un teléfono de contacto válido.' }
  }

  if (!(await isBranchAllowedForCompany(gate.companyId, input.branchId))) {
    return { success: false as const, error: 'Sucursal no autorizada.' }
  }

  const [branch, company] = await Promise.all([
    prisma.branch.findUnique({ where: { id: input.branchId }, select: { name: true } }),
    prisma.company.findUnique({
      where: { id: gate.companyId },
      select: {
        name: true,
        phone: true,
        seller: { select: { fullName: true, phone: true } },
      },
    }),
  ])
  if (!branch || !company) {
    return { success: false as const, error: 'Datos no disponibles.' }
  }

  const message = buildPortalSpecialRequestMessage({
    companyName: company.name,
    appointmentCount: count,
    branchName: branch.name,
    dateLabel: input.date,
    timeLabel: input.time,
    reason: input.reason,
    contactName: session.user.fullName ?? 'Portal cliente',
    contactEmail: session.user.email ?? '',
    contactPhone,
    comment: input.comment,
  })

  await logAudit('CREATE', 'Company', gate.companyId, {
    action: 'PORTAL_SPECIAL_REQUEST',
    appointmentCount: count,
    branchId: input.branchId,
    reason: input.reason,
    contactPhoneSuffix: contactPhone.replace(/\D/g, '').slice(-4),
  })

  const actor = { actorUserId: session.user.id, actorRole: session.user.role as string }
  const logistics = await sendInstitutionalWhatsAppMessage({
    toPhone: getPortalLogisticsWhatsAppPhone(),
    text: message,
    ...actor,
  })

  const sellerPhone = company.seller?.phone?.trim() || null
  let seller = { sent: false }
  if (sellerPhone) {
    seller = await sendInstitutionalWhatsAppMessage({
      toPhone: sellerPhone,
      text: message,
      ...actor,
    })
  }

  if (!logistics.sent && !seller.sent) {
    return {
      success: false as const,
      error:
        'No pudimos enviar su solicitud en este momento. Intente de nuevo en unos minutos o comuníquese con AMI por teléfono.',
    }
  }

  return {
    success: true as const,
    message:
      'Recibimos su solicitud de atención personalizada. Nuestro equipo se pondrá en contacto con usted pronto.',
  }
}
