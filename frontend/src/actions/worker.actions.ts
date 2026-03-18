'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { generateUniversalId } from "@/lib/id.utils"

// Get all workers with their company name and jobPosition (includes defaultProfileId for auto-selection)
// @id IMPL-20260313-07
export async function getWorkers() {
    return await prisma.worker.findMany({
        include: {
            company: {
                select: { name: true, defaultBranchId: true }
            },
            jobPosition: {
                select: { id: true, name: true, defaultProfileId: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })
}

/**
 * Retorna los trabajadores de una empresa específica, con incluidos de puesto y empresa.
 * @id IMPL-20260318-07
 */
export async function getWorkersByCompany(companyId: string) {
    return await prisma.worker.findMany({
        where: { companyId },
        include: {
            company: {
                select: { name: true, defaultBranchId: true }
            },
            jobPosition: {
                select: { id: true, name: true, defaultProfileId: true }
            }
        },
        orderBy: { lastName: 'asc' }
    })
}

export async function createWorker(formData: FormData) {
    try {
        const firstName = formData.get('firstName') as string
        const lastName = formData.get('lastName') as string
        const companyId = formData.get('companyId') as string

        if (!firstName || !lastName) {
            return { success: false, error: 'Nombre y apellidos son obligatorios' }
        }

        const dob = formData.get('dob') as string
        const gender = formData.get('gender') as string

        // IMPL-20260318-08: Detección de duplicados fuerte por nombre + apellido + fecha de nacimiento
        // Coincidencia: normalización minúsculas + trim para reducir falsos negativos por tipeo
        const nameNorm = (s: string) => s.trim().toLowerCase()
        const duplicateCandidate = await prisma.worker.findFirst({
            where: {
                firstName: { equals: firstName.trim(), mode: 'insensitive' },
                lastName: { equals: lastName.trim(), mode: 'insensitive' },
                ...(dob ? { dob: new Date(dob) } : {}),
            },
            select: {
                id: true,
                universalId: true,
                firstName: true,
                lastName: true,
                dob: true,
                email: true,
                phone: true,
                company: { select: { id: true, name: true } },
            }
        })

        if (duplicateCandidate) {
            return {
                success: false,
                status: 'duplicate_found',
                existingWorker: duplicateCandidate,
            }
        }

        const universalId = generateUniversalId({ firstName, lastName, dob, gender })

        const jobPositionId = formData.get('jobPositionId') as string

        const worker = await prisma.worker.create({
            data: {
                firstName,
                lastName,
                universalId,
                dob: dob ? new Date(dob) : null,
                nationalId: formData.get('nationalId') as string,
                email: formData.get('email') as string,
                phone: formData.get('phone') as string,
                companyId: companyId || null,
                jobPositionId: jobPositionId || null,
            }
        })
        revalidatePath('/workers')
        // Retornamos también el Id de la empresa y Sucursal Default si la tiene para redirecciones
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true, defaultBranchId: true }
        })
        
        return { 
            success: true, 
            status: 'created',
            worker: { 
                ...worker, 
                company: company ? { id: company.id, defaultBranchId: company.defaultBranchId } : null 
            } 
        }
    } catch (e: unknown) {
        const error = e as Error
        console.error('Error creating worker:', error)
        return { success: false, status: 'error', error: error.message || 'Error al crear el trabajador' }
    }
}

/**
 * Actualiza los datos de un trabajador existente.
 * @id IMPL-20260318-01
 */
export async function updateWorker(id: string, formData: FormData) {
    try {
        const firstName = formData.get('firstName') as string
        const lastName = formData.get('lastName') as string

        if (!firstName || !lastName) {
            return { success: false, error: 'Nombre y apellidos son obligatorios' }
        }

        const companyId = formData.get('companyId') as string
        const jobPositionId = formData.get('jobPositionId') as string
        const dob = formData.get('dob') as string

        await prisma.worker.update({
            where: { id },
            data: {
                firstName,
                lastName,
                dob: dob ? new Date(dob) : null,
                email: (formData.get('email') as string) || null,
                phone: (formData.get('phone') as string) || null,
                companyId: companyId || null,
                jobPositionId: jobPositionId || null,
            }
        })
        revalidatePath('/workers')
        return { success: true }
    } catch (e: unknown) {
        const error = e as Error
        console.error('Error updating worker:', error)
        return { success: false, error: error.message || 'Error al actualizar el trabajador' }
    }
}

/**
 * Actualiza solo los datos de contacto seguros del trabajador en el paso de corroboración.
 * Solo permite teléfono, email y empresa/puesto actual, sin tocar identidad.
 * @id IMPL-20260318-08
 */
export async function updateWorkerContactData(
    workerId: string,
    updates: { phone?: string; email?: string; companyId?: string; jobPositionId?: string }
) {
    try {
        await prisma.worker.update({
            where: { id: workerId },
            data: {
                ...(updates.phone !== undefined ? { phone: updates.phone || null } : {}),
                ...(updates.email !== undefined ? { email: updates.email || null } : {}),
                ...(updates.companyId !== undefined ? { companyId: updates.companyId || null } : {}),
                ...(updates.jobPositionId !== undefined ? { jobPositionId: updates.jobPositionId || null } : {}),
            }
        })
        revalidatePath('/workers')
        return { success: true }
    } catch (e: unknown) {
        const error = e as Error
        return { success: false, error: error.message || 'Error al actualizar datos de contacto' }
    }
}
