/**
 * @fileoverview Servicio de expedientes médicos
 * @id FIX-20260324-04
 * @backup context/checkpoints/CHK_FIX-20260324-04-EXPEDIENTE-PAPELETA.md
 */

import prisma from '@/lib/prisma'
import { Prisma, EventStatus } from '@prisma/client'
import { isPrismaMissingColumnError } from '@/lib/prisma/missing-column-error'
import { queryMedicalEventById } from '@/services/medical-event-get-by-id.query'

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
    try {
        return await queryMedicalEventById(id, 'full')
    } catch (error) {
        // Migración 20261028170000_cancellation_reason: prod puede desplegar código antes que `migrate deploy`.
        if (!isPrismaMissingColumnError(error)) throw error
        return await queryMedicalEventById(id, 'withoutCancellationColumns')
    }
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
