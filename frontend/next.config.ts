import type { NextConfig } from "next";

/**
 * Reverse proxy hacia el backend FastAPI desplegado en Railway.
 *
 * ¿Por qué? El frontend Next.js (Vercel) hace `fetch('/api/v1/upload-only')`
 * desde el código cliente, pero ese endpoint vive en el servicio
 * FastAPI de Railway. Sin este rewrite, Vercel retorna 500 porque la
 * ruta no existe en su runtime.
 *
 * @id FIX-20260624-09
 * @see context/SPECs/SPEC_ARCH-20260624-04-INVESTIGACION-BUGS-FLUIDO-PUBLICO.md
 * @see context/diagnostics/DIAG-20260624-04-bugs-flujo-publico.md
 *
 * BackURL configurable via env var BACKEND_URL (recomendado en Vercel
 * Production para override). Fallback al host público de Railway.
 *
 * CAVEAT — body size limit:
 *   Vercel serverless functions truncan bodies > 4.5 MB en rewrites.
 *   Las secciones "Acta Constitutiva" y "Otra Documentación" del form
 *   permiten hasta 10 MB. Si se的报告 ese límite, considerar la
 *   opción A3 (URL absoluta al backend en SelfRegistrationForm.tsx
 *   para upload-only) en un fix futuro. Para el flujo actual de
 *   "Servicios Robles" los PDFs de prueba caben.
 */
const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://administracion-medica-industrial-production.up.railway.app"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/upload-only",
        destination: `${BACKEND_URL}/api/v1/upload-only`,
      },
      {
        source: "/api/v1/upload-and-analyze",
        destination: `${BACKEND_URL}/api/v1/upload-and-analyze`,
      },
      {
        source: "/api/files/:path*",
        destination: `${BACKEND_URL}/api/files/:path*`,
      },
    ];
  },
};

export default nextConfig;
