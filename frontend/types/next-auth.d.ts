/**
 * Extensión de tipos de NextAuth para incluir campos personalizados
 * @id IMPL-20260225-01
 */

declare module "next-auth" {
  interface User {
    id: string
    role: "ADMIN" | "RECEPTIONIST" | "DOCTOR_GENERAL" | "DOCTOR_VALIDATOR" | "CAPTURIST" | "COMPANY_CLIENT"
    companyId: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      fullName: string
      role: "ADMIN" | "RECEPTIONIST" | "DOCTOR_GENERAL" | "DOCTOR_VALIDATOR" | "CAPTURIST" | "COMPANY_CLIENT"
      companyId: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    email: string
    name: string
    role: "ADMIN" | "RECEPTIONIST" | "DOCTOR_GENERAL" | "DOCTOR_VALIDATOR" | "CAPTURIST" | "COMPANY_CLIENT"
    companyId: string | null
  }
}

export {}
