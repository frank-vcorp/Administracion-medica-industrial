'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// --- COMPANIES ---
export async function getCompanies() {
    return await prisma.company.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function createCompany(formData: FormData) {
    const name = formData.get('name') as string
    const rfc = formData.get('rfc') as string
    const plan = formData.get('plan') as string // Note: We might need a field for 'plan' later, for now we can store it in a generic way or ignore if strictly following schema. Let's add it to schema or use a JSON field if user wants strict adherence. For MVP, we'll skip 'plan' if not in schema or add it. *Wait, schema doesn't have plan.* I'll stick to schema fields.
    // Schema: name, rfc, address, contactName, email, phone.

    await prisma.company.create({
        data: {
            name,
            rfc,
            address: formData.get('address') as string,
            contactName: formData.get('contactName') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
        }
    })
    revalidatePath('/companies')
}

// --- BRANCHES ---
export async function getBranches() {
    // We need a tenant first. For MVP we'll pick the first one or create default
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) return []
    // Wait, we need to handle tenant creation if not exists.
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
