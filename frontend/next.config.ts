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
  experimental: {
    // La firma autógrafa se envía como data URL al Server Action. El límite
    // predeterminado de 1 MB rechaza firmas PNG/JPEG válidas antes de ejecutar
    // la acción; se mantiene por debajo del límite de Vercel para funciones.
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  async rewrites() {
    return [
      // Reglas V1 legacy (FIX-20260624-09). Mantener por compat y porque
      // están probadas en prod.
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
      // FIX-20260812-16: rewrite catch-all de /api/v2/* hacia Railway.
      // Antes los endpoints V2 (/api/v2/studies/upload-and-analyze,
      // /api/v2/event-tests/upload-xml-audiometry, /api/v2/admin/ai-keys,
      // /api/v2/ai/status) NO se reescribían desde Vercel. Si el frontend
      // Next.js no tenía `NEXT_PUBLIC_API_URL` configurada en Vercel, los
      // Server Actions hacían fetch a `http://localhost:8000/api/v2/...`
      // (fallback del código ai-prediagnosis.actions.ts:22 y
      // event-test.actions.ts:658) → conexión rechazada → error genérico
      // que el wrapper transformaba en un mensaje confuso al usuario
      // (incluyendo el `M3_CREDENTIALS_UNAVAILABLE` cuando el backend que
      // sí respondía tenía el código antiguo).
      //
      // Con este rewrite catch-all, cualquier llamada a /api/v2/* desde
      // Server Actions pasa por el proxy de Vercel → Railway, sin depender
      // de env var de runtime.
      //
      // CAVEAT: Vercel trunca bodies >4.5MB en rewrites (FIX-20260624-09 doc).
      // Para uploads grandes (>4.5MB), considerar migración a URL absoluta
      // (NEXT_PUBLIC_API_URL) en un fix futuro.
      {
        source: "/api/v2/:path*",
        destination: `${BACKEND_URL}/api/v2/:path*`,
      },
    ];
  },
};

export default nextConfig;
