'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// --- COMPANIES ---
/**
 * @id IMPL-20260318-08
 * Retorna empresas con sucursal predeterminada y sucursales permitidas
 */
export async function getCompanies() {
    return await prisma.company.findMany({ 
        include: {
            defaultBranch: true,
            allowedBranches: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' } 
    })
}

/**
 * Actualiza las sucursales permitidas de una empresa (multi-sucursal).
 * @id IMPL-20260318-08
 */
export async function updateCompanyAllowedBranches(companyId: string, branchIds: string[]) {
    try {
        await prisma.company.update({
            where: { id: companyId },
            data: {
                allowedBranches: {
                    set: branchIds.map(id => ({ id })),
                },
            },
        })
        revalidatePath('/companies')
        revalidatePath(`/companies/${companyId}`)
        return { success: true }
    } catch (e: unknown) {
        const error = e as Error
        return { success: false, error: error.message }
    }
}

// --- JOB POSITIONS ---
// @id IMPL-20260318-01
export async function getJobPositions() {
    return await prisma.jobPosition.findMany({
        select: { id: true, name: true, companyId: true },
        orderBy: { name: 'asc' }
    })
}

export async function createCompany(formData: FormData) {
    try {
        const name = formData.get('name') as string
        const rfc = formData.get('rfc') as string
        const defaultBranchId = formData.get('defaultBranchId') as string

        if (!name || !rfc) {
            return { success: false, error: 'Nombre y RFC son obligatorios' }
        }

        const company = await prisma.company.create({
            data: {
                name,
                rfc,
                address: formData.get('address') as string,
                contactName: formData.get('contactName') as string,
                email: formData.get('email') as string,
                phone: formData.get('phone') as string,
                defaultBranchId: defaultBranchId || null
            }
        })
        revalidatePath('/companies')
        return { success: true, company }
    } catch (e: unknown) {
        const error = e as Error
        console.error('Error creating company:', error)
        return { success: false, error: error.message || 'Error al crear la empresa' }
    }
}

// --- BRANCHES ---
export async function getBranches() {
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) return []
    return await prisma.branch.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' }
    })
}

export async function createBranch(formData: FormData) {
    let tenant = await prisma.tenant.findFirst()
    if (!tenant) {
        tenant = await prisma.tenant.create({ data: { name: 'Default Tenant' } })
    }

    await prisma.branch.create({
        data: {
            name: formData.get('name') as string,
            address: formData.get('address') as string,
            phone: formData.get('phone') as string,
            managerName: formData.get('managerName') as string,
            hourlyCapacity: Number(formData.get('hourlyCapacity')) || 15,
            openingTime: formData.get('openingTime') as string || '07:00',
            closingTime: formData.get('closingTime') as string || '17:00',
            tenantId: tenant.id
        }
    })
    revalidatePath('/branches')
}

// --- SERVICES ---
export async function getServices() {
    return await prisma.service.findMany({ orderBy: { code: 'asc' } })
}

export async function createService(formData: FormData) {
    await prisma.service.create({
        data: {
            name: formData.get('name') as string,
            code: formData.get('code') as string,
            category: formData.get('category') as string,
            price: Number(formData.get('price')),
            description: formData.get('description') as string,
        }
    })
    revalidatePath('/services')
}

// --- PROFILES (BATERÍAS) ---
export async function getProfiles() {
    return await prisma.serviceProfile.findMany({
        include: { ProfileServices: true },
        orderBy: { createdAt: 'desc' }
    })
}

export async function createProfile(formData: FormData) {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    await prisma.serviceProfile.create({
        data: {
            name,
            description
        }
    })
    revalidatePath('/admin/profiles')
}
