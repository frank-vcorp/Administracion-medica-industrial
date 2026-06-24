/**
 * Extensión de tipos de NextAuth para incluir campos personalizados.
 * @id IMPL-20260225-01
 * @id IMPL-20260623-03 (Fase 7) - role ahora usa enum UserRole de Prisma
 * @id IMPL-20260623-03 (Fase 7.1) - consolidación: archivo único en src/types/ (convención del proyecto)
 *
 * Antes existían dos copias (frontend/types/ y frontend/src/types/) con contenido divergente.
 * Esta versión es el consolidado único, detectado por tsconfig via include glob.
 */
import { DefaultSession, DefaultUser } from "next-auth"
import type { UserRole } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      companyId: string | null
      fullName: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    id: string
    role: UserRole
    companyId: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    email: string
    name: string
    role: UserRole
    companyId: string | null
  }
}

export {}
