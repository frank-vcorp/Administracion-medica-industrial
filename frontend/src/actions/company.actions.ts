'use server'

import { revalidatePath } from 'next/cache'
import * as CompanyService from '@/services/company.service'
import { Prisma } from '@prisma/client'

export const getCompanies = async () => {
    return await CompanyService.getCompanies()
}

export const createCompany = async (data: Prisma.CompanyCreateInput) => {
    const company = await CompanyService.createCompany(data)
    revalidatePath('/companies')
    return company
}

export const updateCompany = async (id: string, data: Prisma.CompanyUpdateInput) => {
    const company = await CompanyService.updateCompany(id, data)
    revalidatePath('/companies')
    return company
}
