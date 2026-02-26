import prisma from '@/lib/prisma'
import { Prisma, EventStatus } from '@prisma/client'

// --- EVENT ---

export const getEvents = async (workerId?: string) => {
    const where = workerId ? { workerId } : {}
    return await prisma.medicalEvent.findMany({
        where,
        include: {
            worker: true,
            branch: true,
            verdict: true
        },
        orderBy: { createdAt: 'desc' }
    })
}

export const getEventById = async (id: string) => {
    return await prisma.medicalEvent.findUnique({
        where: { id },
        include: {
            worker: {
                include: { company: true }
            },
            branch: true,
            exam: true,
            studies: true,
            labs: true,
            verdict: true
        }
    })
}

export const createEvent = async (data: Prisma.MedicalEventCreateInput) => {
    return await prisma.medicalEvent.create({
        data
    })
}

export const updateEventStatus = async (id: string, status: EventStatus) => {
    return await prisma.medicalEvent.update({
        where: { id },
        data: { status }
    })
}

// --- STUDIES & LABS (Sub-items) ---

export const addStudyRecord = async (data: Prisma.StudyRecordCreateInput) => {
    return await prisma.studyRecord.create({
        data
    })
}

export const updateStudyRecord = async (id: string, data: Prisma.StudyRecordUpdateInput) => {
    return await prisma.studyRecord.update({
        where: { id },
        data
    })
}

// --- VERDICT ---

export const upsertVerdict = async (eventId: string, data: Prisma.MedicalVerdictCreateWithoutEventInput) => {
    return await prisma.medicalVerdict.upsert({
        where: { eventId },
        create: { ...data, event: { connect: { id: eventId } } },
        update: data
    })
}
