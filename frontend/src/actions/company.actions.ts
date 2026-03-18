/**
 * @file Server Actions: Empresas
 * @id IMPL-20260318-08
 */
'use server'

import { revalidatePath } from 'next/cache'
import * as CompanyService from '@/services/company.service'
import { Prisma } from '@prisma/client'
import { updateCompanyAllowedBranches as _updateCompanyAllowedBranches } from './admin.actions'

export const getCompanies = async () => {
    return await CompanyService.getCompanies()
}

export const getCompanyById = async (id: string) => {
    return await CompanyService.getCompanyById(id)
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

/**
 * Actualiza sucursales permitidas (multi-sucursal).
 * @id IMPL-20260318-08
 */
export const updateCompanyAllowedBranches = _updateCompanyAllowedBranches
