'use server'

/**
 * @intervention IMPL-20260527-01
 * @see context/interconsultas/HANDOFF_ARCH-20260527-11_SOFIA_SLICE-A-TRAZABILIDAD-EVENT.md
 * @backup context/interconsultas/HANDOFF_ARCH-20260527-14_SOFIA_SLICE-D-ADMISION-EXTERNA.md
 */
import prisma from "@/lib/prisma"
import { authOptions } from "@/auth"
import { getServerSession } from "next-auth"
import { revalidatePath } from "next/cache"

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

export async function getEventsKanban(date?: string) {
    try {
        const dateStr = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayLocalDateString()
        const { start, end } = localDayBounds(dateStr)

        const events = await prisma.medicalEvent.findMany({
            where: {
                status: { in: ['CHECKED_IN', 'IN_PROGRESS', 'VALIDATING'] },
                OR: [
                    { checkInDate: { gte: start, lte: end } },
                    { checkInDate: null, createdAt: { gte: start, lte: end } },
                ],
            },
            select: {
                id: true,
                status: true,
                intakeSource: true,
                appointmentId: true,
                checkInDate: true,
                createdAt: true,
                worker: {
                    include: { company: true }
                },
                branch: true
            },
            orderBy: { createdAt: 'desc' }
        })

        // Group by status for Kanban in a single pass O(N)
        return events.reduce((acc, e) => {
            if (e.status === 'CHECKED_IN') acc.scheduled.push(e) // Sala de espera
            else if (e.status === 'IN_PROGRESS') acc.inProgress.push(e) // En consultorio
            else if (e.status === 'VALIDATING') acc.completed.push(e) // Por validar
            return acc
        }, { scheduled: [] as typeof events, inProgress: [] as typeof events, completed: [] as typeof events })

    } catch (error) {
        console.error("Error fetching events kanban:", error)
        return { scheduled: [], inProgress: [], completed: [] }
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
