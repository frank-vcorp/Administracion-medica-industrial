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
  // IMPL-20260325-01: /prefill es portal público de prellenado (sin sesión, validado por token)
  // IMPL-20260623-02: /demo/* es público (datos estáticos, sin tocar backend)
  // IMPL-20260624-01: /solicitar-alta es portal público de auto-registro (validado por service, no auth)
  // IMPL-20260624-01: /auto-alta/[token] es portal público de auto-alta por link (validado por token)
  // FIX-20260624-08: /api/* se permite sin sesión — los endpoints de flujo público (upload-only, files, etc.)
  //   son llamados desde el navegador sin token de NextAuth. La autorización fina la hace el handler
  //   (validación de token propio, scope público, etc.). NO usar `(.*)` que haría todo público: el matcher
  //   ya excluye _next/static, _next/image, favicon.ico y public.
  const isPublicRoute = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/api/") || pathname.startsWith("/prefill") || pathname.startsWith("/demo") || pathname.startsWith("/auto-alta") || pathname.startsWith("/solicitar-alta")
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
