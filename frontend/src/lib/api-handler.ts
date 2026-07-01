/**
 * @file Helper para envolver handlers de API route de Next.js con try/catch
 *       y logging server-side, de modo que SIEMPRE devolvamos JSON (nunca
 *       una página HTML 500) ante cualquier excepción.
 *
 * @id IMPL-20260701-07 — Bypass FastAPI (Slice A/B LAB).
 *
 * Por qué: en Vercel, un error no atrapado en un route handler se renderiza
 * como página HTML 500 con stack trace, lo cual rompe a los clientes
 * DataTables/fetch del frontend (que esperan JSON). Este helper garantiza
 * que cualquier excepción — incluyendo las que se originan dentro de
 * `getServerSession()` (NEXTAUTH_SECRET faltante, etc.) o en la primera
 * llamada a Prisma (DATABASE_URL faltante) — se serialice a JSON
 * `{ error, message }` con status 500.
 *
 * Uso:
 *
 *   export const GET = withApiErrors("GET /api/lab/catalogs/[mod]", async (req, ctx) => {
 *     // ... body original del handler ...
 *   });
 *
 * El handler envuelto puede devolver NextResponse | Response | void.
 */

import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = { params: Promise<any> };
type Handler = (
  req: NextRequest,
  ctx: AnyCtx
) => Promise<unknown> | unknown;

export function withApiErrors(
  label: string,
  handler: Handler
): (req: NextRequest, ctx: AnyCtx) => Promise<Response> {
  return async (req: NextRequest, ctx: AnyCtx) => {
    try {
      const out = await handler(req, ctx);
      // Si el handler ya devolvió un Response/NextResponse, lo pasamos tal cual.
      if (out instanceof Response) return out;
      // Si devolvió undefined/null, lo tratamos como { ok: true } 200.
      if (out === undefined || out === null) {
        return NextResponse.json({ ok: true });
      }
      // Objeto plano → NextResponse.json 200.
      return NextResponse.json(out as object);
    } catch (err) {
      // Loguear en server (visible en Vercel Logs).
       
      console.error(`[${label}] error:`, err);
      return NextResponse.json(
        {
          error: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
  };
}
