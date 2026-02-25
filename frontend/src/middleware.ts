/**
 * @fileoverview Middleware de protección de rutas
 * @author SOFIA - Builder
 * @id IMPL-20260225-01
 * 
 * Protege:
 * - /portal/* -> Solo usuarios auténticos (validación de sesión)
 * - /admin/* -> Solo ADMIN (validación de rol)
 */

import { getToken } from "next-auth/jwt"
import { NextRequest, NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = await getToken({ req: request })

  // Rutas públicas (sin protección)
  const publicRoutes = ["/login", "/", "/api/auth"]
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Si no hay sesión (token), redirigir a login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Protección específica para /admin/*
  if (pathname.startsWith("/admin")) {
    if (token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  // Protección específica para /portal/*
  if (pathname.startsWith("/portal")) {
    if (token.role !== "COMPANY_CLIENT") {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}
