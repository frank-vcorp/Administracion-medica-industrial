'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getEventsKanban() {
    try {
        const events = await prisma.medicalEvent.findMany({
            include: {
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

        // For MVP, we auto-assign to the first branch if not specified (or hardcode for now)
        // Ideally we pick proper branch from session or input
        const branch = await prisma.branch.findFirst()
        if (!branch) throw new Error("No branches defined")

        await prisma.medicalEvent.create({
            data: {
                workerId,
                branchId: branch.id,
                status: 'CHECKED_IN', // Auto check-in for this MVP flow
                checkInDate: new Date() 
            }
        })
        revalidatePath('/reception')
        return { success: true }
    } catch (error) {
        console.error("Error creating event:", error)
        return { success: false, error: 'Hubo un error al crear el expediente.' }
    }
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
