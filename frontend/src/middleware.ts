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
  // FIX REFERENCE: FIX-20260225-02 - Pasar secret explícito a getToken
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  // Rutas públicas (sin protección)
  // FIX REFERENCE: FIX-20260225-02 - Evitar startsWith("/") que hace match con todo
  const isPublicRoute = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/api/auth")
  if (isPublicRoute) {
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
