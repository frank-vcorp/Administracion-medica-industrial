import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: "ADMIN" | "RECEPTIONIST" | "DOCTOR_GENERAL" | "DOCTOR_VALIDATOR" | "CAPTURIST" | "COMPANY_CLIENT"
            companyId: string | null
            fullName: string
        } & DefaultSession["user"]
    }

    interface User extends DefaultUser {
        role: "ADMIN" | "RECEPTIONIST" | "DOCTOR_GENERAL" | "DOCTOR_VALIDATOR" | "CAPTURIST" | "COMPANY_CLIENT"
        companyId: string | null
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role: "ADMIN" | "RECEPTIONIST" | "DOCTOR_GENERAL" | "DOCTOR_VALIDATOR" | "CAPTURIST" | "COMPANY_CLIENT"
        companyId: string | null
    }
}
