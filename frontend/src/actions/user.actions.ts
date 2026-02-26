'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { UserRole } from "@prisma/client"
import bcrypt from 'bcryptjs'

export async function getUsers() {
    return await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
    })
}

export async function createUser(formData: FormData) {
    const fullName = formData.get('fullName') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const role = formData.get('role') as UserRole

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.create({
        data: {
            fullName,
            email,
            hashedPassword,
            role
        }
    })

    revalidatePath('/admin/users')
}
