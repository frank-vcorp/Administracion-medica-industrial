'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { UserRole, Prisma } from "@prisma/client"
import type { User } from "@prisma/client"
import bcrypt from 'bcryptjs'

export type UserListItem = Pick<User, 'id' | 'email' | 'fullName' | 'role' | 'isActive'>

export async function getUsers(): Promise<UserListItem[]> {
    return await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            isActive: true
        },
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

export async function updateUser(formData: FormData) {
    const id = formData.get('id') as string
    const fullName = formData.get('fullName') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string | null
    const role = formData.get('role') as UserRole
    const isActive = formData.getAll('isActive').includes('true')

    const data: Prisma.UserUpdateInput = {
        fullName,
        email,
        role,
        isActive
    }

    if (password && password.length > 0) {
        data.hashedPassword = await bcrypt.hash(password, 10)
    }

    await prisma.user.update({
        where: { id },
        data
    })

    revalidatePath('/admin/users')
}
