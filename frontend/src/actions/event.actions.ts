'use server'

/**
 * @intervention IMPL-20260527-01
 * @see context/interconsultas/HANDOFF_ARCH-20260527-11_SOFIA_SLICE-A-TRAZABILIDAD-EVENT.md
 * @backup context/interconsultas/HANDOFF_ARCH-20260527-14_SOFIA_SLICE-D-ADMISION-EXTERNA.md
 */
import { Prisma } from '@prisma/client'
import prisma from "@/lib/prisma"
import { authOptions } from "@/auth"
import { getServerSession } from "next-auth"
import { revalidatePath } from "next/cache"
import {
    buildNotPerformedTestIdSet,
    isCheckoutEnabled,
    getCheckoutEligibility,
} from "@/lib/clinical/reception-checkout"

/** Límites del día local (YYYY-MM-DD) para filtrar eventos del kanban. */
function localDayBounds(dateStr: string): { start: Date; end: Date } {
    const [y, m, d] = dateStr.split('-').map(Number)
    if (!y || !m || !d) {
        const now = new Date()
        return {
            start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
            end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
        }
    }
    return {
        start: new Date(y, m - 1, d, 0, 0, 0, 0),
        end: new Date(y, m - 1, d, 23, 59, 59, 999),
    }
}

function todayLocalDateString(): string {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

const RECEPTION_DISCHARGE_ROLES = ['ADMIN', 'SUPERADMIN', 'RECEPTIONIST', 'CAPTURIST'] as const

function eventDayFilter(start: Date, end: Date): Prisma.MedicalEventWhereInput {
    return {
        OR: [
            { checkInDate: { gte: start, lte: end } },
            { checkInDate: null, createdAt: { gte: start, lte: end } },
        ],
    }
}

const kanbanEventSelect = {
    id: true,
    status: true,
    intakeSource: true,
    appointmentId: true,
    checkInDate: true,
    createdAt: true,
    worker: {
        include: { company: true },
    },
    branch: true,
} as const

const kanbanCheckoutSelect = {
    ...kanbanEventSelect,
    dischargedAt: true,
    worker: {
        select: {
            firstName: true,
            lastName: true,
            phone: true,
            company: true,
        },
    },
    eventTests: {
        select: { id: true, status: true },
    },
} as const

export async function getEventsKanban(date?: string) {
    try {
        const dateStr = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayLocalDateString()
        const { start, end } = localDayBounds(dateStr)
        const dayFilter = eventDayFilter(start, end)

        const clinicEvents = await prisma.medicalEvent.findMany({
            where: {
                dischargedAt: null,
                status: { notIn: ['CANCELED'] },
                ...dayFilter,
            },
            select: kanbanCheckoutSelect,
            orderBy: { createdAt: 'desc' },
        })

        const eventIds = clinicEvents.map((e) => e.id)
        const timelineEntries =
            eventIds.length === 0
                ? []
                : await prisma.papeletaTimelineEntry.findMany({
                      where: {
                          eventId: { in: eventIds },
                          eventTestId: { not: null },
                          entryType: { in: ['ADMIN_INCIDENCE', 'STUDY_NOT_PERFORMED'] },
                      },
                      select: { eventId: true, eventTestId: true, entryType: true },
                  })

        const incidencesByEvent = new Map<string, Set<string>>()
        for (const entry of timelineEntries) {
            if (!entry.eventTestId) continue
            const set = incidencesByEvent.get(entry.eventId) ?? new Set<string>()
            for (const id of buildNotPerformedTestIdSet([entry])) {
                set.add(id)
            }
            incidencesByEvent.set(entry.eventId, set)
        }

        type KanbanEvent = (typeof clinicEvents)[number]
        const scheduled: KanbanEvent[] = []
        const inProgress: KanbanEvent[] = []
        const readyForCheckout: KanbanEvent[] = []

        for (const event of clinicEvents) {
            const notPerformedIds = incidencesByEvent.get(event.id) ?? new Set<string>()
            const checkoutInput = {
                dischargedAt: event.dischargedAt,
                eventTests: event.eventTests,
            }

            if (isCheckoutEnabled(checkoutInput, notPerformedIds)) {
                readyForCheckout.push(event)
                continue
            }

            if (event.status === 'CHECKED_IN') {
                scheduled.push(event)
                continue
            }

            inProgress.push(event)
        }

        return { scheduled, inProgress, readyForCheckout }
    } catch (error) {
        console.error("Error fetching events kanban:", error)
        return { scheduled: [], inProgress: [], readyForCheckout: [] }
    }
}

/**
 * Checkout en recepción: marca salida física del paciente (#13 F-017).
 * Requiere paso 1 completado en todos los estudios (SPEC §4.4), no dictamen firmado.
 */
export async function dischargePatientFromReception(eventId: string) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return { success: false, error: 'Sesión no válida.' }
        }

        const role = session.user.role
        if (!RECEPTION_DISCHARGE_ROLES.includes(role as (typeof RECEPTION_DISCHARGE_ROLES)[number])) {
            return { success: false, error: 'No tienes permiso para registrar salidas.' }
        }

        const event = await prisma.medicalEvent.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                dischargedAt: true,
                workerId: true,
                eventTests: { select: { id: true, status: true } },
            },
        })

        if (!event) {
            return { success: false, error: 'Expediente no encontrado.' }
        }

        const timelineEntries = await prisma.papeletaTimelineEntry.findMany({
            where: {
                eventId,
                eventTestId: { not: null },
                entryType: { in: ['ADMIN_INCIDENCE', 'STUDY_NOT_PERFORMED'] },
            },
            select: { eventTestId: true, entryType: true },
        })
        const notPerformedIds = buildNotPerformedTestIdSet(timelineEntries)

        const eligibility = getCheckoutEligibility(
            { dischargedAt: event.dischargedAt, eventTests: event.eventTests },
            notPerformedIds,
        )

        if (!eligibility.eligible) {
            const messages: Record<typeof eligibility.reason, string> = {
                already_discharged: 'Este paciente ya tiene salida registrada.',
                no_tests: 'El expediente no tiene estudios asignados.',
                pending_studies: 'Aún hay estudios sin realizar (paso 1 pendiente).',
                invalid_skipped: 'Hay estudios omitidos sin incidencia documentada.',
            }
            return { success: false, error: messages[eligibility.reason] }
        }

        const now = new Date()
        await prisma.$transaction([
            prisma.medicalEvent.update({
                where: { id: eventId },
                data: {
                    dischargedAt: now,
                    dischargedByUserId: session.user.id,
                },
            }),
            prisma.auditLog.create({
                data: {
                    action: 'RECEPTION_PATIENT_DISCHARGED',
                    entity: 'MedicalEvent',
                    entityId: eventId,
                    userId: session.user.id,
                    details: {
                        workerId: event.workerId,
                        dischargedAt: now.toISOString(),
                    },
                },
            }),
        ])

        revalidatePath('/reception')
        revalidatePath(`/events/${eventId}`)
        return { success: true, dischargedAt: now.toISOString() }
    } catch (error) {
        console.error('[dischargePatientFromReception]', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al registrar la salida.',
        }
    }
}

export async function createEvent(formData: FormData) {
    try {
        const workerId = formData.get('workerId') as string
        const branchIdFromForm = formData.get('branchId') as string | null
        const session = await getServerSession(authOptions)
        const intakeCreatedByUserId = session?.user?.id ?? null

        // For MVP, we auto-assign to the first branch if not specified (or hardcode for now)
        // Ideally we pick proper branch from session or input
        const branch = branchIdFromForm
            ? await prisma.branch.findUnique({ where: { id: branchIdFromForm } })
            : await prisma.branch.findFirst()
        if (!branch) throw new Error("No branches defined")

        const created = await prisma.medicalEvent.create({
            data: {
                workerId,
                branchId: branch.id,
                status: 'CHECKED_IN', // Auto check-in for this MVP flow
                checkInDate: new Date(),
                intakeSource: 'DIRECT_RECEPTION',
                intakeCreatedByUserId
            },
            select: { id: true }
        })
        revalidatePath('/reception')
        return { success: true, eventId: created.id }
    } catch (error) {
        console.error("Error creating event:", error)
        return { success: false, error: 'Hubo un error al crear el expediente.' }
    }
}

/**
 * @intervention IMPL-20260527-01
 * @see context/interconsultas/HANDOFF_ARCH-20260527-14_SOFIA_SLICE-D-ADMISION-EXTERNA.md
 */
export async function createExternalWalkInEvent(input: { workerId: string, branchId: string }) {
    try {
        const session = await getServerSession(authOptions)
        const intakeCreatedByUserId = session?.user?.id ?? null

        const branch = await prisma.branch.findUnique({ where: { id: input.branchId } })
        if (!branch) {
            return { success: false, error: 'Sucursal no encontrada.' }
        }

        const created = await prisma.medicalEvent.create({
            data: {
                workerId: input.workerId,
                branchId: input.branchId,
                status: 'CHECKED_IN',
                checkInDate: new Date(),
                intakeSource: 'EXTERNAL_WALK_IN',
                appointmentId: null,
                billingCompanyId: null,
                intakeCreatedByUserId,
            },
            select: { id: true }
        })

        revalidatePath('/reception')
        return { success: true, eventId: created.id }
    } catch (error) {
        console.error('Error creating external walk-in event:', error)
        return { success: false, error: 'No se pudo registrar el ingreso externo.' }
    }
}

/**
 * @intervention IMPL-20260527-01
 * @see context/interconsultas/HANDOFF_ARCH-20260527-12_SOFIA_SLICE-B-RECEPCION-PROJECT.md
 */
export async function createProjectReceptionEvent(input: {
    workerId: string
    branchId: string
    projectId: string
    billingCompanyId: string
    intakeCreatedByUserId?: string | null
}) {
    const created = await prisma.medicalEvent.create({
        data: {
            workerId: input.workerId,
            branchId: input.branchId,
            status: 'CHECKED_IN',
            checkInDate: new Date(),
            intakeSource: 'PROJECT_PRE_REGISTERED',
            projectId: input.projectId,
            billingCompanyId: input.billingCompanyId,
            intakeCreatedByUserId: input.intakeCreatedByUserId ?? null
        },
        select: { id: true }
    })

    revalidatePath('/reception')
    return created.id
}

export async function updateEventStatus(eventId: string, status: 'IN_PROGRESS' | 'VALIDATING') {
    try {
        await prisma.medicalEvent.update({
            where: { id: eventId },
            data: { status }
        })
        revalidatePath('/reception')
        return { success: true }
    } catch (error) {
        console.error("Error updating event status:", error)
        return { success: false, error: 'Hubo un error al actualizar el estado.' }
    }
}
