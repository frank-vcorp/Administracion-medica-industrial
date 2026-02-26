import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const getWorkerById = async (id: string) => {
    return await prisma.worker.findUnique({
        where: { id },
        include: {
            company: true,
            medicalHistory: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })
}

export const getWorkerByUniversalId = async (universalId: string) => {
    return await prisma.worker.findUnique({
        where: { universalId },
        include: { medicalHistory: true }
    })
}

export const createWorker = async (data: Prisma.WorkerCreateInput) => {
    return await prisma.worker.create({
        data
    })
}

export const updateWorker = async (id: string, data: Prisma.WorkerUpdateInput) => {
    return await prisma.worker.update({
        where: { id },
        data
    })
}

export const deleteWorker = async (id: string) => {
    return await prisma.worker.delete({
        where: { id }
    })
}
