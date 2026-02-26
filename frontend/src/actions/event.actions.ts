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
            if (e.status === 'SCHEDULED') acc.scheduled.push(e)
            else if (e.status === 'IN_PROGRESS' || e.status === 'CHECKED_IN') acc.inProgress.push(e)
            else if (e.status === 'COMPLETED' || e.status === 'VALIDATING') acc.completed.push(e)
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
                status: 'SCHEDULED',
                checkInDate: new Date() // Auto check-in for this MVP flow
            }
        })
        revalidatePath('/reception')
        return { success: true }
    } catch (error) {
        console.error("Error creating event:", error)
        return { success: false, error: 'Hubo un error al crear el expediente.' }
    }
}
