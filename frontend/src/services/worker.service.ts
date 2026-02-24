import prisma from '@/lib/prisma'
import { Worker, Prisma } from '@prisma/client'

export const getWorkers = async () => {
    return await prisma.worker.findMany({
        include: { company: true },
        orderBy: { updatedAt: 'desc' }
    })
}

export const getWorkerById = async (id: string) => {
    return await prisma.worker.findUnique({
        where: { id },
        include: {
            company: true,
            medicalHistory: true
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
