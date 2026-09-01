/**
 * @file Server actions administrativas generales.
 * @id ARCH-20260325-02
 * @backup context/checkpoints/CHK_ARCH-20260325-02.md
 */
'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
    PUBLIC_GENERAL_COMPANY_NAME,
    PUBLIC_GENERAL_COMPANY_RFC,
} from '@/lib/public-general-company'

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
        const allowedBranchIds = formData.getAll('allowedBranchIds').map(String).filter(Boolean)
        // IMPL-20260623-02: vendedor asignado + habilitado (Ficha Cliente v2)
        const sellerId = (formData.get('sellerId') as string) || (formData.get('sellerIdSelect') as string) || null
        const enabled = ((formData.get('enabled') as string) ?? (formData.get('enabledCheckbox') ? 'true' : 'false')) === 'true'

        if (!name || !rfc) {
            return { success: false, error: 'Nombre y RFC son obligatorios' }
        }

        let branchIds = allowedBranchIds
        if (branchIds.length === 0) {
            const tenant = await prisma.tenant.findFirst()
            if (tenant) {
                const allBranches = await prisma.branch.findMany({
                    where: { tenantId: tenant.id },
                    select: { id: true },
                })
                branchIds = allBranches.map((b) => b.id)
            }
        }

        const company = await prisma.company.create({
            data: {
                name,
                rfc,
                address: formData.get('address') as string,
                contactName: formData.get('contactName') as string,
                email: formData.get('email') as string,
                phone: formData.get('phone') as string,
                defaultBranchId: defaultBranchId || branchIds[0] || null,
                sellerId: sellerId || null,
                sellerAssignedAt: sellerId ? new Date() : null,
                enabledAt: enabled ? new Date() : null,
                origen: 'MANUAL',
                estado: enabled ? 'HABILITADO' : 'PENDIENTE_REVISION',
                allowedBranches: branchIds.length > 0
                    ? { connect: branchIds.map((id) => ({ id })) }
                    : undefined,
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

/**
 * Garantiza la empresa interna Público General (particulares / mostrador).
 */
export async function ensurePublicGeneralCompany() {
    const existing = await prisma.company.findFirst({
        where: {
            OR: [
                { rfc: PUBLIC_GENERAL_COMPANY_RFC },
                { name: { equals: PUBLIC_GENERAL_COMPANY_NAME, mode: 'insensitive' } },
            ],
        },
        select: {
            id: true,
            name: true,
            rfc: true,
            email: true,
            phone: true,
            defaultBranchId: true,
        },
    })

    if (existing) return existing

    const tenant = await prisma.tenant.findFirst()
    const branches = tenant
        ? await prisma.branch.findMany({
              where: { tenantId: tenant.id },
              select: { id: true },
              orderBy: { createdAt: 'asc' },
          })
        : []
    const branchIds = branches.map((b) => b.id)

    const created = await prisma.company.create({
        data: {
            name: PUBLIC_GENERAL_COMPANY_NAME,
            rfc: PUBLIC_GENERAL_COMPANY_RFC,
            estado: 'HABILITADO',
            enabledAt: new Date(),
            origen: 'MANUAL',
            defaultBranchId: branchIds[0] ?? null,
            allowedBranches: branchIds.length
                ? { connect: branchIds.map((id) => ({ id })) }
                : undefined,
        },
        select: {
            id: true,
            name: true,
            rfc: true,
            email: true,
            phone: true,
            defaultBranchId: true,
        },
    })

    revalidatePath('/companies')
    revalidatePath('/publico-general')
    return created
}

// --- BRANCHES ---
/**
 * @deprecated desde 2026-07-30 (IMPL-20260730-04, PR-2 de ARCH-20260730-01).
 * Usar `@/actions/branch.actions#getBranches` (nueva fachada con `_count`,
 * `isActive` y búsqueda opcional). Esta fachada legacy NO incluye
 * `isActive` ni `_count`, por lo que las cards no mostrarían badge correcto.
 *
 * Esta función se eliminará en PR-5 (cierre del módulo Sucursales), una vez
 * los 6 consumidores actuales (`AppointmentFormModal`,
 * `companies/[id]/page`, `appointments/page`, `workers/page`,
 * `projects/page`, `projects/new/page`) migren a la fachada nueva.
 */
export async function getBranches() {
    const tenant = await prisma.tenant.findFirst()
    if (!tenant) return []
    return await prisma.branch.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' }
    })
}

/**
 * @deprecated desde 2026-07-30 (IMPL-20260730-04, PR-2).
 * Usar `@/actions/branch.actions#createBranch` (objeto validado por Zod
 * server-side, NO FormData). Esta fachada legacy no valida con Zod y no es
 * consistente con la nueva convención `{ok, error}`.
 *
 * Esta función se eliminará en PR-5.
 */
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

