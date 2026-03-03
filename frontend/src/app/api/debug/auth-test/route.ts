/**
 * @fileoverview Endpoint de diagnóstico temporal para depurar 401 en login
 * @author DEBY - Lead Debugger
 * @id FIX-20260303-01
 * 
 * ⚠️ TEMPORAL: Eliminar después de diagnosticar el problema
 */

import { NextResponse } from "next/server"

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      DATABASE_URL_set: !!process.env.DATABASE_URL,
      DATABASE_URL_prefix: process.env.DATABASE_URL?.substring(0, 30) + "...",
      NEXTAUTH_SECRET_set: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    },
  }

  // Test 1: Prisma import
  try {
    const prismaModule = await import("@/lib/prisma")
    const prisma = prismaModule.default
    diagnostics.prismaImport = "OK"

    // Test 2: Prisma connection
    try {
      const userCount = await prisma.user.count()
      diagnostics.prismaConnection = "OK"
      diagnostics.userCount = userCount

      // Test 3: Find admin user
      try {
        const admin = await prisma.user.findUnique({
          where: { email: "admin@sistema.com" },
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            hashedPassword: true,
          },
        })
        diagnostics.adminUser = admin
          ? {
              found: true,
              email: admin.email,
              role: admin.role,
              isActive: admin.isActive,
              hashPrefix: admin.hashedPassword.substring(0, 7),
              hashLength: admin.hashedPassword.length,
            }
          : { found: false }

        // Test 4: bcryptjs import & compare
        if (admin) {
          try {
            const bcryptModule = await import("bcryptjs")
            diagnostics.bcryptImport = "OK"
            diagnostics.bcryptExports = Object.keys(bcryptModule)
            diagnostics.bcryptCompareType = typeof bcryptModule.compare
            diagnostics.bcryptDefaultType = typeof bcryptModule.default

            // Try named import compare
            if (typeof bcryptModule.compare === "function") {
              const match = await bcryptModule.compare(
                "Admin@123",
                admin.hashedPassword
              )
              diagnostics.passwordMatchNamed = match
            } else {
              diagnostics.passwordMatchNamed = "compare is not a function"
            }

            // Try default import compare
            if (
              bcryptModule.default &&
              typeof bcryptModule.default.compare === "function"
            ) {
              const match2 = await bcryptModule.default.compare(
                "Admin@123",
                admin.hashedPassword
              )
              diagnostics.passwordMatchDefault = match2
            } else {
              diagnostics.passwordMatchDefault =
                "default.compare is not a function"
            }
          } catch (e: unknown) {
            const err = e as Error
            diagnostics.bcryptError = {
              message: err.message,
              stack: err.stack?.split("\n").slice(0, 3),
            }
          }
        }
      } catch (e: unknown) {
        const err = e as Error
        diagnostics.adminQueryError = {
          message: err.message,
          stack: err.stack?.split("\n").slice(0, 3),
        }
      }
    } catch (e: unknown) {
      const err = e as Error
      diagnostics.prismaConnectionError = {
        message: err.message,
        name: err.name,
        stack: err.stack?.split("\n").slice(0, 5),
      }
    }
  } catch (e: unknown) {
    const err = e as Error
    diagnostics.prismaImportError = {
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 3),
    }
  }

  return NextResponse.json(diagnostics, { status: 200 })
}
