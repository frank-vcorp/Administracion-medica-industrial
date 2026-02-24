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
    const companyId = formData.get('companyId') as string

    await prisma.worker.create({
        data: {
            firstName: formData.get('firstName') as string,
            lastName: formData.get('lastName') as string,
            universalId: formData.get('universalId') as string,
            nationalId: formData.get('nationalId') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            companyId: companyId || null, // Handle connection
        }
    })
    revalidatePath('/workers')
}
