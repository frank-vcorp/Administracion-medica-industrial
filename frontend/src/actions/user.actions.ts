'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { UserRole } from "@prisma/client"

export async function getUsers() {
    return await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
    })
}

export async function createUser(formData: FormData) {
    const fullName = formData.get('fullName') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string // In production, hash this!!
    const role = formData.get('role') as UserRole

    await prisma.user.create({
        data: {
            fullName,
            email,
            password, // MVP: storing plain text, but need bcrypt in full prod
            role
        }
    })

    revalidatePath('/admin/users')
}
