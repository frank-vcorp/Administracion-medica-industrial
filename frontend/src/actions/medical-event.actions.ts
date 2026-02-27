'use server'

import { revalidatePath } from 'next/cache'
import * as EventService from '@/services/medical-event.service'
import { Prisma, EventStatus } from '@prisma/client'

// --- EVENT ---

export const createEvent = async (data: Prisma.MedicalEventCreateInput) => {
    const event = await EventService.createEvent(data)
    revalidatePath(`/workers/${data.worker.connect?.id}`)
    return event
}

export const updateEventStatus = async (id: string, status: EventStatus) => {
    const event = await EventService.updateEventStatus(id, status)
    revalidatePath(`/events/${id}`)
    revalidatePath('/reception') // Update Kanban board when status changes from detail page
    return event
}

export const getEventById = async (id: string) => {
    return await EventService.getEventById(id)
}

// --- SUB-ITEMS ---

export const addStudy = async (eventId: string, serviceName: string, fileUrl?: string) => {
    const study = await EventService.addStudyRecord({
        event: { connect: { id: eventId } },
        serviceName,
        fileUrl
    })
    revalidatePath(`/events/${eventId}`)
    return study
}

// --- VERDICT ---

export const saveVerdict = async (eventId: string, diagnosis: string, recommendations: string, validatorId: string) => {
    const verdict = await EventService.upsertVerdict(eventId, {
        finalDiagnosis: diagnosis,
        recommendations,
        validator: { connect: { id: validatorId } }
    })
    revalidatePath(`/events/${eventId}`)
    return verdict
}
