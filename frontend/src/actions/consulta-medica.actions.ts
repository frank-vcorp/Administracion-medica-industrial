'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { authOptions } from '@/auth'
import { upsertWorkerClinicalHistory } from '@/actions/clinical-history.actions'
import { createAppointment } from '@/actions/appointment.actions'
import { validateConsultaMedicaPayload } from '@/lib/clinical/consulta-medica-validate'
import type { ConsultaMedicaPayload } from '@/schemas/clinical/consulta-medica.schema'
import { isConsultaMedicaTestName, parseConsultaMedicaClinicalContext } from '@/lib/clinical/consulta-medica'
import { denyIfClosedCaptureUnauthorized } from '@/lib/clinical/papeleta-readonly'
import { formatScheduledFollowUp, listOpenAgendaHourSlots } from '@/lib/clinical/consulta-seguimiento'
import { searchCie10Catalog, type Cie10Entry } from '@/lib/clinical/cie-10-catalog'
import {
  addAgendaDays,
  appointmentAgendaHour,
  formatAppointmentAgendaDateString,
  getAgendaWeekStartMonday,
  parseAppointmentLocalDateTime,
  todayAgendaDateString,
} from '@/lib/appointment-scheduling'
import {
  appointmentCapacityUserMessage,
  checkBranchHourCapacity,
  computeBranchDayAvailabilityForDates,
  countAppointmentsByHourForDay,
  type BranchDayAvailability,
} from '@/lib/appointment-capacity'
import {
  branchOperatingHoursForDate,
  parseBranchWeeklySchedule,
} from '@/lib/branch-weekly-schedule'
import { isPrismaMissingColumnError } from '@/lib/prisma/missing-column-error'

const CLINICAL_ROLES = new Set([
  'SUPERADMIN',
  'ADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'RECEPTIONIST',
  'CAPTURIST',
])

export type SaveConsultaMedicaResult =
  | { success: true; payload: ConsultaMedicaPayload; updatedAt: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]>; technicalDetail?: string }

async function assertClinicalAccess():
  Promise<{ ok: true; userId: string; role: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { ok: false, error: 'No autenticado.' }
  }
  const role = session.user.role ?? ''
  if (!CLINICAL_ROLES.has(role)) {
    return { ok: false, error: 'No tienes permisos para capturar consulta médica.' }
  }
  return { ok: true, userId: session.user.id, role }
}

export async function searchCie10ForConsulta(query: string): Promise<Cie10Entry[]> {
  const access = await assertClinicalAccess()
  if (!access.ok) return []
  return searchCie10Catalog(query, 25)
}

/**
 * Enlace opcional. Si la cita no existe, el id no es UUID o la columna aún
 * no está migrada, la consulta igual queda guardada en clinicalContext.
 */
async function syncFollowUpAppointmentLink(
  eventId: string,
  workerId: string,
  appointmentId: string | undefined,
): Promise<void> {
  const id = appointmentId?.trim() ?? ''
  if (id && !z.string().uuid().safeParse(id).success) return
  try {
    if (!id) {
      await prisma.appointment.updateMany({
        where: { followUpFromMedicalEventId: eventId },
        data: { followUpFromMedicalEventId: null },
      })
      return
    }
    await prisma.appointment.updateMany({
      where: { followUpFromMedicalEventId: eventId, NOT: { id } },
      data: { followUpFromMedicalEventId: null },
    })
    await prisma.appointment.updateMany({
      where: { id, workerId },
      data: { followUpFromMedicalEventId: eventId },
    })
  } catch {
    console.error('[saveConsultaMedica] follow-up link', eventId)
  }
}

export type ScheduleConsultaSeguimientoResult =
  | {
      success: true
      appointmentId: string
      fecha: string
      hora: string
      dateInput: string
      timeInput: string
    }
  | { success: false; error: string }

/**
 * Crea o mueve la cita de seguimiento del mismo paciente, en la sucursal del evento.
 * La fecha y la hora quedan en la nota; el id enlaza la cita de la agenda.
 */
export async function scheduleConsultaSeguimiento(input: {
  eventId: string
  eventTestId: string
  workerId: string
  date: string
  time: string
  existingAppointmentId?: string
}): Promise<ScheduleConsultaSeguimientoResult> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }

  const date = input.date.trim()
  const time = input.time.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { success: false, error: 'Indica una fecha y una hora válidas.' }
  }

  const eventTest = await prisma.eventTest.findUnique({
    where: { id: input.eventTestId },
    select: {
      id: true,
      eventId: true,
      testNameSnapshot: true,
      clinicalContext: true,
      event: {
        select: {
          id: true,
          workerId: true,
          branchId: true,
          billingCompanyId: true,
          worker: { select: { companyId: true, medicalProfileId: true } },
        },
      },
    },
  })
  if (!eventTest || eventTest.eventId !== input.eventId) {
    return { success: false, error: 'El estudio no pertenece a este expediente.' }
  }
  if (eventTest.event.workerId !== input.workerId) {
    return { success: false, error: 'El paciente no coincide con el expediente.' }
  }
  if (!isConsultaMedicaTestName(eventTest.testNameSnapshot)) {
    return { success: false, error: 'Este estudio no es una consulta médica.' }
  }

  const companyId = eventTest.event.billingCompanyId ?? eventTest.event.worker.companyId
  if (!companyId) {
    return {
      success: false,
      error: 'Este paciente no tiene empresa. Agéndalo desde Gestión de citas.',
    }
  }

  const scheduledAt = parseAppointmentLocalDateTime(date, time)
  if (Number.isNaN(scheduledAt.getTime())) {
    return { success: false, error: 'Indica una fecha y una hora válidas.' }
  }

  const branchId = eventTest.event.branchId
  const existingId = input.existingAppointmentId?.trim() ?? ''
  let appointmentId = ''

  try {
    if (existingId && z.string().uuid().safeParse(existingId).success) {
      const existing = await prisma.appointment.findFirst({
        where: { id: existingId, workerId: input.workerId },
        select: { id: true, branchId: true, scheduledAt: true, status: true, notes: true },
      })
      if (existing && existing.status !== 'CANCELLED' && existing.status !== 'RESCHEDULED') {
        const capacity = await checkBranchHourCapacity(prisma, branchId, scheduledAt)
        const sameSlot =
          existing.branchId === branchId &&
          formatAppointmentAgendaDateString(existing.scheduledAt) ===
            formatAppointmentAgendaDateString(scheduledAt) &&
          appointmentAgendaHour(existing.scheduledAt) === appointmentAgendaHour(scheduledAt)
        if (!capacity.ok && !sameSlot) {
          return { success: false, error: appointmentCapacityUserMessage(capacity) }
        }
        const notes = existing.notes?.trim() ? existing.notes : 'Consulta de seguimiento'
        try {
          await prisma.appointment.update({
            where: { id: existing.id },
            data: {
              scheduledAt,
              branchId,
              notes,
              followUpFromMedicalEventId: eventTest.event.id,
            },
          })
        } catch (err) {
          if (!isPrismaMissingColumnError(err)) throw err
          await prisma.appointment.update({
            where: { id: existing.id },
            data: { scheduledAt, branchId, notes },
          })
        }
        appointmentId = existing.id
      }
    }

    if (!appointmentId) {
      const created = await createAppointment({
        workerId: input.workerId,
        companyId,
        branchId,
        scheduledAt,
        notes: 'Consulta de seguimiento',
        source: 'CONSULTA_SEGUIMIENTO',
        serviceProfileId: eventTest.event.worker.medicalProfileId,
      })
      if (!created.success || !created.appointment) {
        const raw = created.success ? '' : created.error
        return {
          success: false,
          error:
            raw === 'CLIENTE_DESHABILITADO'
              ? 'No se puede agendar: la empresa del paciente no está activa.'
              : raw || 'No se pudo agendar la consulta de seguimiento.',
        }
      }
      appointmentId = created.appointment.id
      await syncFollowUpAppointmentLink(eventTest.event.id, input.workerId, appointmentId)
    }
  } catch (err) {
    console.error('[scheduleConsultaSeguimiento]', eventTest.event.id)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'No se pudo agendar la consulta de seguimiento.',
    }
  }

  const formatted = formatScheduledFollowUp(scheduledAt)
  const current = eventTest.clinicalContext
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    await prisma.eventTest.update({
      where: { id: eventTest.id },
      data: {
        clinicalContext: {
          ...(current as Record<string, unknown>),
          proxima_cita_fecha: formatted.fecha,
          proxima_cita_hora: formatted.hora,
          proxima_cita_appointment_id: appointmentId,
        } as Prisma.InputJsonValue,
      },
    })
  }

  revalidatePath(`/events/${input.eventId}`)
  revalidatePath('/appointments')
  return { success: true, appointmentId, ...formatted }
}

export type ConsultaSeguimientoAgendaDay = Pick<
  BranchDayAvailability,
  'date' | 'status' | 'openHourSlots'
>

export type ConsultaSeguimientoAgendaSlot = {
  time: string
  count: number
  capacity: number
}

/**
 * Semana y horas libres de la sucursal del expediente.
 * Usa el mismo cupo y horario que Gestión de citas.
 */
export async function getConsultaSeguimientoAgenda(input: {
  eventId: string
  weekStart?: string
  date?: string
}): Promise<
  | {
      success: true
      branchName: string
      weekStart: string
      days: ConsultaSeguimientoAgendaDay[]
      date: string | null
      closed: boolean
      slots: ConsultaSeguimientoAgendaSlot[]
    }
  | { success: false; error: string }
> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }

  const event = await prisma.medicalEvent.findUnique({
    where: { id: input.eventId },
    select: { id: true, branchId: true },
  })
  if (!event) return { success: false, error: 'Evento no encontrado.' }

  const branchSelect = {
    id: true,
    name: true,
    hourlyCapacity: true,
    openingTime: true,
    closingTime: true,
    isActive: true,
  } as const

  let branch: {
    id: string
    name: string
    hourlyCapacity: number | null
    openingTime: string
    closingTime: string
    isActive: boolean
    weeklySchedule: unknown
  } | null = null
  try {
    branch = await prisma.branch.findUnique({
      where: { id: event.branchId },
      select: { ...branchSelect, weeklySchedule: true },
    })
  } catch (err) {
    if (!isPrismaMissingColumnError(err)) throw err
    const fallback = await prisma.branch.findUnique({
      where: { id: event.branchId },
      select: branchSelect,
    })
    branch = fallback ? { ...fallback, weeklySchedule: null } : null
  }
  if (!branch?.isActive) {
    return { success: false, error: 'La sucursal de este expediente no está activa.' }
  }

  const anchor =
    input.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(input.weekStart)
      ? input.weekStart
      : todayAgendaDateString()
  const weekStart = getAgendaWeekStartMonday(anchor)
  const dateStrings = Array.from({ length: 7 }, (_, i) => addAgendaDays(weekStart, i))
  const capacity = branch.hourlyCapacity ?? 15
  const meta = {
    hourlyCapacity: capacity,
    openingTime: branch.openingTime,
    closingTime: branch.closingTime,
    weeklySchedule: branch.weeklySchedule,
  }
  const days = await computeBranchDayAvailabilityForDates(
    prisma,
    branch.id,
    dateStrings,
    meta,
    todayAgendaDateString(),
  )

  const date =
    input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null
  let slots: ConsultaSeguimientoAgendaSlot[] = []
  let closed = false
  if (date) {
    const hours = branchOperatingHoursForDate(
      date,
      meta,
      parseBranchWeeklySchedule(branch.weeklySchedule),
    )
    if (hours.length === 0) {
      closed = true
    } else {
      const byHour = await countAppointmentsByHourForDay(prisma, branch.id, date)
      slots = listOpenAgendaHourSlots({
        hours,
        counts: byHour,
        capacity,
        date,
      }).map((slot) => ({
        time: slot.time,
        count: slot.count,
        capacity: slot.capacity,
      }))
    }
  }

  return {
    success: true,
    branchName: branch.name,
    weekStart,
    days: days.map((day) => ({
      date: day.date,
      status: day.status,
      openHourSlots: day.openHourSlots,
    })),
    date,
    closed,
    slots,
  }
}

export async function saveConsultaMedica(
  eventTestId: string,
  eventId: string,
  workerId: string,
  rawPayload: unknown,
  options: { finalize?: boolean } = {},
): Promise<SaveConsultaMedicaResult> {
  const access = await assertClinicalAccess()
  if (!access.ok) return { success: false, error: access.error }

  const eventTest = await prisma.eventTest.findUnique({
    where: { id: eventTestId },
    select: {
      id: true,
      eventId: true,
      testNameSnapshot: true,
      clinicalContext: true,
      event: { select: { workerId: true } },
    },
  })
  if (!eventTest) {
    return { success: false, error: 'El estudio no existe.' }
  }
  if (eventTest.eventId !== eventId) {
    return { success: false, error: 'El estudio no pertenece al evento indicado.' }
  }
  if (eventTest.event.workerId !== workerId) {
    return { success: false, error: 'El paciente no coincide con el evento.' }
  }
  if (!isConsultaMedicaTestName(eventTest.testNameSnapshot)) {
    return { success: false, error: 'Este estudio no es una consulta médica.' }
  }

  const priorClosed = Boolean(
    parseConsultaMedicaClinicalContext(eventTest.clinicalContext)?.cerrada_at?.trim(),
  )
  const closedGuard = denyIfClosedCaptureUnauthorized(priorClosed, access.role)
  if (!closedGuard.ok) return { success: false, error: closedGuard.error }

  const validation = validateConsultaMedicaPayload(
    rawPayload,
    priorClosed || !options.finalize ? 'draft' : 'final',
  )
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      fieldErrors: validation.fieldErrors,
    }
  }
  const payload = validation.payload

  const antecedentesPayload = payload.antecedentes
  const hasAntecedentes =
    antecedentesPayload &&
    typeof antecedentesPayload === 'object' &&
    Object.values(antecedentesPayload).some(
      (v) => v !== null && v !== undefined && (typeof v !== 'object' || Object.keys(v as object).length > 0),
    )
  if (hasAntecedentes) {
    const hc = await upsertWorkerClinicalHistory(workerId, antecedentesPayload)
    if (!hc.success) {
      return { success: false, error: hc.error ?? 'No se pudo actualizar el historial clínico.' }
    }
  }

  const priorCerradaAt = parseConsultaMedicaClinicalContext(eventTest.clinicalContext)?.cerrada_at
  const toStore: ConsultaMedicaPayload = {
    ...payload,
    cerrada_at: priorClosed
      ? (payload.cerrada_at ?? priorCerradaAt)
      : options.finalize
        ? new Date().toISOString()
        : payload.cerrada_at,
  }

  try {
    const updated = await prisma.eventTest.update({
      where: { id: eventTestId },
      data: {
        clinicalContext: toStore as unknown as Prisma.InputJsonValue,
        status: options.finalize ? 'RESULT_REGISTERED' : 'IN_PROGRESS',
      },
      select: { updatedAt: true },
    })
    await syncFollowUpAppointmentLink(
      eventId,
      workerId,
      toStore.proxima_cita_appointment_id,
    )
    revalidatePath(`/events/${eventId}`)
    return {
      success: true,
      payload: toStore,
      updatedAt: updated.updatedAt.toISOString(),
    }
  } catch (err) {
    console.error('[saveConsultaMedica]', err)
    return {
      success: false,
      error: 'No se pudo guardar la consulta por un problema del servidor o de red.',
      technicalDetail: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}
