import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const getCompanies = async () => {
    return await prisma.company.findMany({
        orderBy: { updatedAt: 'desc' }
    })
}

export const getCompanyById = async (id: string) => {
    return await prisma.company.findUnique({
        where: { id },
        include: { workers: true }
    })
}

export const createCompany = async (data: Prisma.CompanyCreateInput) => {
    return await prisma.company.create({
        data
    })
}

export const updateCompany = async (id: string, data: Prisma.CompanyUpdateInput) => {
    return await prisma.company.update({
        where: { id },
        data
    })
}

export const deleteCompany = async (id: string) => {
    return await prisma.company.delete({
        where: { id }
    })
}
