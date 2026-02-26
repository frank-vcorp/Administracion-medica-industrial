'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// Get all workers with their company name
export async function getWorkers() {
    return await prisma.worker.findMany({
        include: {
            company: {
                select: { name: true }
            }
        },
        orderBy: { createdAt: 'desc' }
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

        const worker = await prisma.worker.create({
            data: {
                firstName,
                lastName,
                universalId: formData.get('universalId') as string,
                nationalId: formData.get('nationalId') as string,
                email: formData.get('email') as string,
                phone: formData.get('phone') as string,
                companyId: companyId || null,
            }
        })
        revalidatePath('/workers')
        return { success: true, worker }
    } catch (e: unknown) {
        const error = e as Error
        console.error('Error creating worker:', error)
        return { success: false, error: error.message || 'Error al crear el trabajador' }
    }
}
