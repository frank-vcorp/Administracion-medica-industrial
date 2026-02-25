/**
 * @fileoverview Configuración de NextAuth.js v4 para autenticación segura
 * @author SOFIA - Builder
 * @version 1.0.0
 * @id IMPL-20260225-01
 * 
 * Implementa:
 * - Credentials Provider (Email + Contraseña)
 * - Control Multi-tenant seguro
 * - Protección contra acceso inadecuado a datos ajenos
 */

import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import prisma from "@/lib/prisma"

/**
 * Opciones de NextAuth con tipos extendidos
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña requeridos")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            fullName: true,
            hashedPassword: true,
            role: true,
            isActive: true,
            companyId: true,
          },
        })

        if (!user || !user.isActive) {
          // FIX REFERENCE: FIX-20260225-02 - Mensaje genérico para evitar enumeración de usuarios
          throw new Error("Credenciales inválidas")
        }

        const passwordMatch = await compare(
          credentials.password as string,
          user.hashedPassword
        )

        if (!passwordMatch) {
          // FIX REFERENCE: FIX-20260225-02 - Mensaje genérico para evitar enumeración de usuarios
          throw new Error("Credenciales inválidas")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          image: null,
          role: user.role,
          companyId: user.companyId,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email || ""
        token.name = user.name || ""
        token.role = (user as any).role
        token.companyId = (user as any).companyId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user = {
          id: token.id as string,
          email: token.email as string,
          fullName: token.name as string,
          role: token.role as any,
          companyId: token.companyId as string | null,
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  secret: process.env.NEXTAUTH_SECRET,
}
