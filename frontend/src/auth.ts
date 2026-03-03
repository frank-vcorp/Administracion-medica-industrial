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
import bcryptjs from "bcryptjs"
import prisma from "@/lib/prisma"

/**
 * Helper defensivo para comparar contraseñas con bcryptjs v3
 * FIX REFERENCE: FIX-20260303-01 - bcryptjs v3 ESM/CJS interop
 */
async function safeCompare(password: string, hash: string): Promise<boolean> {
  // bcryptjs v3 puede exportar compare como named export o dentro de default
  if (typeof bcryptjs === "function") {
    // Si bcryptjs se importó como el objeto default que tiene .compare
    return false
  }
  if (typeof bcryptjs.compare === "function") {
    return bcryptjs.compare(password, hash)
  }
  // Fallback: import dinámico
  const mod = await import("bcryptjs")
  const compareFn = mod.compare || mod.default?.compare
  if (typeof compareFn === "function") {
    return compareFn(password, hash)
  }
  throw new Error("bcryptjs.compare no disponible")
}

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

        try {
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

          // FIX REFERENCE: FIX-20260303-01 - Usar safeCompare para interop bcryptjs v3
          const passwordMatch = await safeCompare(
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
            role: user.role,
            companyId: user.companyId,
          }
        } catch (error: unknown) {
          // FIX REFERENCE: FIX-20260303-01 - Log detallado para diagnosticar 401 en producción
          const err = error as Error
          console.error("[NextAuth authorize] Error:", err.message, err.stack)
          throw error
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email || ""
        token.name = user.name || ""
        token.role = user.role
        token.companyId = user.companyId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email || ""
        session.user.fullName = token.name || ""
        session.user.role = token.role
        session.user.companyId = token.companyId
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
