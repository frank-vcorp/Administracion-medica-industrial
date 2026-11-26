'use server'

import { UserRole } from '@prisma/client'
import { createAppointment } from '@/actions/appointment.actions'
import {
  getOwnMedicalProfilesForCompany,
  isMedicalProfileOwnedByCompany,
} from '@/actions/medical-profiles'
import {
  appointmentCapacityUserMessage,
  checkBranchHourCapacity,
  computeBranchDayAvailabilityForDates,
  computeBranchHourSlotsForDay,
  normalizePositiveAppointmentDuration,
  resolveBranchCapacityConfig,
  resolveProfileRequiredDurationMinutes,
} from '@/lib/appointment-capacity'
import { isPrismaMissingColumnError } from '@/lib/prisma/missing-column-error'
import {
  addAgendaDays,
  formatAppointmentAgendaTime,
  getAgendaWeekStartMonday,
  parseAppointmentLocalDateTime,
  todayAgendaDateString,
} from '@/lib/appointment-scheduling'
import { logAudit } from '@/actions/audit.actions'
import { getPortalSpecialRequestRouting } from '@/lib/portal-special-request-logistics'
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

async function resolveEffectivePortalProfileId(
  companyId: string,
  serviceProfileId?: string | null,
  workerId?: string | null,
): Promise<string | null> {
  if (serviceProfileId) {
    return (await isMedicalProfileOwnedByCompany(serviceProfileId, companyId))
      ? serviceProfileId
      : null
  }
  if (!workerId) return null
  const w = await prisma.worker.findFirst({
    where: { id: workerId, companyId },
    select: { medicalProfileId: true },
  })
  return w?.medicalProfileId ?? null
}

export async function getPortalAppointmentBookingContext() {
  const gate = await resolvePortalBookingViewAccess()
  if (!gate.ok) return { success: false as const, error: gate.error }

  const branchSelect = {
    id: true,
    name: true,
    hourlyCapacity: true,
    openingTime: true,
    closingTime: true,
  } as const

  const company = await prisma.company.findUnique({
    where: { id: gate.companyId },
    select: {
      id: true,
      name: true,
      defaultBranchId: true,
      defaultBranch: { select: branchSelect },
      allowedBranches: { select: branchSelect },
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
      medicalProfile: {
        select: {
          id: true,
          name: true,
          calculatedDurationMinutes: true,
          durationOverrideMinutes: true,
        },
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  }).catch(async (err) => {
    if (!isPrismaMissingColumnError(err)) throw err
    const fallbackWorkers = await prisma.worker.findMany({
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
    return fallbackWorkers.map((w) => ({
      ...w,
      medicalProfile: w.medicalProfile
        ? { ...w.medicalProfile, calculatedDurationMinutes: null, durationOverrideMinutes: null }
        : null,
    }))
  })

  const profiles = await getOwnMedicalProfilesForCompany(gate.companyId)

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
  serviceProfileId?: string | null
  workerId?: string | null
}) {
  const gate = await resolvePortalBookingViewAccess()
  if (!gate.ok) return { success: false as const, error: gate.error }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { success: false as const, error: 'Fecha inválida' }
  }
  if (!(await isBranchAllowedForCompany(gate.companyId, input.branchId))) {
    return { success: false as const, error: 'Sucursal no autorizada' }
  }

  const effectiveProfileId = await resolveEffectivePortalProfileId(
    gate.companyId,
    input.serviceProfileId,
    input.workerId,
  )

  const result = await computeBranchHourSlotsForDay(prisma, input.branchId, input.date, {
    serviceProfileId: effectiveProfileId,
  })
  if (!result.ok) {
    if (result.reason === 'BRANCH_CLOSED') {
      return {
        success: true as const,
        closed: true,
        capacityMode: 'HOURLY_COUNT' as const,
        requiredDurationMinutes: 30,
        slots: [],
      }
    }
    return { success: false as const, error: 'Sucursal no disponible' }
  }

  return {
    success: true as const,
    closed: false,
    capacityMode: result.capacityMode,
    requiredDurationMinutes: result.requiredDurationMinutes,
    closingTime: result.closingTime,
    slots: result.slots,
  }
}

export async function getPortalBranchMonthAvailability(input: {
  branchId: string
  month: string
  serviceProfileId?: string | null
  workerId?: string | null
}) {
  const gate = await resolvePortalBookingViewAccess()
  if (!gate.ok) return { success: false as const, error: gate.error }

  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    return { success: false as const, error: 'Mes inválido' }
  }
  if (!(await isBranchAllowedForCompany(gate.companyId, input.branchId))) {
    return { success: false as const, error: 'Sucursal no autorizada' }
  }

  const branch = await resolveBranchCapacityConfig(prisma, input.branchId)
  if (!branch?.isActive) {
    return { success: false as const, error: 'Sucursal no disponible' }
  }

  const effectiveProfileId = await resolveEffectivePortalProfileId(
    gate.companyId,
    input.serviceProfileId,
    input.workerId,
  )
  const requiredDurationMinutes = await resolveProfileRequiredDurationMinutes(
    prisma,
    effectiveProfileId,
  )

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
      weeklySchedule: branch.weeklySchedule,
      capacityMode: branch.capacityMode,
      hourlyMinutesCapacity: branch.hourlyMinutesCapacity,
    },
    todayAgendaDateString(),
    { requiredDurationMinutes },
  )

  return {
    success: true as const,
    month: input.month,
    days,
    hourlyCapacity: capacity,
    capacityMode: branch.capacityMode,
  }
}

export async function getPortalBranchWeekAvailability(input: {
  branchId: string
  weekStart: string
  serviceProfileId?: string | null
  workerId?: string | null
}) {
  const gate = await resolvePortalBookingViewAccess()
  if (!gate.ok) return { success: false as const, error: gate.error }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart)) {
    return { success: false as const, error: 'Semana inválida' }
  }
  if (!(await isBranchAllowedForCompany(gate.companyId, input.branchId))) {
    return { success: false as const, error: 'Sucursal no autorizada' }
  }

  const [branch, branchNameRow] = await Promise.all([
    resolveBranchCapacityConfig(prisma, input.branchId),
    prisma.branch.findUnique({ where: { id: input.branchId }, select: { name: true } }),
  ])
  if (!branch?.isActive) {
    return { success: false as const, error: 'Sucursal no disponible' }
  }

  const effectiveProfileId = await resolveEffectivePortalProfileId(
    gate.companyId,
    input.serviceProfileId,
    input.workerId,
  )
  const requiredDurationMinutes = await resolveProfileRequiredDurationMinutes(
    prisma,
    effectiveProfileId,
  )

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
      weeklySchedule: branch.weeklySchedule,
      capacityMode: branch.capacityMode,
      hourlyMinutesCapacity: branch.hourlyMinutesCapacity,
    },
    todayAgendaDateString(),
    { requiredDurationMinutes },
  )

  return {
    success: true as const,
    weekStart,
    days,
    branchName: branchNameRow?.name ?? '',
    hourlyCapacity: capacity,
    capacityMode: branch.capacityMode,
    requiredDurationMinutes: normalizePositiveAppointmentDuration(requiredDurationMinutes),
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
    select: { id: true, firstName: true, lastName: true, medicalProfileId: true },
  })
  if (!worker) {
    return { success: false as const, error: 'Trabajador no válido para su empresa.' }
  }

  if (!(await isBranchAllowedForCompany(gate.companyId, input.branchId))) {
    return { success: false as const, error: 'Sucursal no autorizada.' }
  }

  if (input.serviceProfileId) {
    const owned = await isMedicalProfileOwnedByCompany(input.serviceProfileId, gate.companyId)
    if (!owned) {
      return {
        success: false as const,
        error: 'El perfil seleccionado no pertenece a su empresa.',
      }
    }
  }

  const effectiveProfileId = input.serviceProfileId || worker.medicalProfileId || null
  const scheduledAt = parseAppointmentLocalDateTime(input.date, input.time)
  const capacityCheck = await checkBranchHourCapacity(prisma, input.branchId, scheduledAt, {
    serviceProfileId: effectiveProfileId,
  })
  if (!capacityCheck.ok) {
    const isCapacityLimit =
      !capacityCheck.reason ||
      capacityCheck.reason === 'INSUFFICIENT_MINUTES' ||
      capacityCheck.reason === 'EXCEEDS_CLOSING_TIME'
    const fallbackMessage =
      capacityCheck.capacityMode === 'DURATION_MINUTES'
        ? appointmentCapacityUserMessage(capacityCheck)
        : 'Este horario ya alcanzó el límite de citas por hora. Use la solicitud personalizada e indique cuántas citas necesita.'

    return {
      success: false as const,
      error: isCapacityLimit ? 'BRANCH_HOUR_FULL' : (capacityCheck.reason ?? 'BRANCH_HOUR_FULL'),
      userMessage:
        capacityCheck.reason === 'EXCEEDS_CLOSING_TIME' ||
        capacityCheck.reason === 'INSUFFICIENT_MINUTES' ||
        capacityCheck.reason === 'OUTSIDE_HOURS' ||
        capacityCheck.reason === 'BRANCH_CLOSED' ||
        capacityCheck.reason === 'BRANCH_INACTIVE' ||
        capacityCheck.reason === 'APPOINTMENT_IN_PAST'
          ? appointmentCapacityUserMessage(capacityCheck)
          : fallbackMessage,
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
        capacity: capacityCheck,
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
    whatsApp: result.whatsApp
      ? {
          sent: Boolean(result.whatsApp.sent),
          triptychSent: Boolean(result.whatsApp.triptychSent),
          skipped: Boolean(result.whatsApp.skipped),
          missingPhone: result.whatsApp.error === 'Sin teléfono del paciente',
        }
      : null,
    email: result.email
      ? {
          sent: Boolean(result.email.sent),
          skipped: Boolean(result.email.skipped),
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
  const routing = await getPortalSpecialRequestRouting()

  let anyLogisticsSent = false
  let lastWaError: string | undefined
  for (const to of routing.logisticsPhones) {
    const r = await sendInstitutionalWhatsAppMessage({
      toPhone: to,
      text: message,
      ...actor,
    })
    if (r.sent) anyLogisticsSent = true
    else if (r.error) lastWaError = r.error
  }

  const sellerPhone = company.seller?.phone?.trim() || null
  let seller: { sent: boolean; error?: string } = { sent: false }
  if (routing.copyToSeller && sellerPhone) {
    seller = await sendInstitutionalWhatsAppMessage({
      toPhone: sellerPhone,
      text: message,
      ...actor,
    })
    if (!seller.sent && seller.error) lastWaError = seller.error
  }

  if (!anyLogisticsSent && !seller.sent) {
    console.error('[submitPortalSpecialRequestContact] WhatsApp no entregado:', lastWaError ?? 'unknown')
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
