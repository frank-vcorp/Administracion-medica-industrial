'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getEventsKanban() {
    const events = await prisma.medicalEvent.findMany({
        include: {
            worker: true,
            branch: true
        },
        orderBy: { createdAt: 'desc' }
    })

    // Group by status for Kanban
    return {
        scheduled: events.filter(e => e.status === 'SCHEDULED'),
        inProgress: events.filter(e => e.status === 'IN_PROGRESS' || e.status === 'CHECKED_IN'),
        completed: events.filter(e => e.status === 'COMPLETED' || e.status === 'VALIDATING'),
    }
}

export async function createEvent(formData: FormData) {
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
}
