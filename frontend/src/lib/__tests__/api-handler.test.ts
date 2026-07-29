/**
 * @file Tests unitarios para `withApiErrors`.
 * @id IMPL-20260701-07 — Bypass FastAPI (Slice A/B LAB).
 *
 * Verifica que cualquier excepción en el handler (incluyendo errores de
 * sesión, Prisma, etc.) se serialice a JSON `{ error, message }` con
 * status 500 en lugar de devolver HTML.
 */
import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { withApiErrors } from "../api-handler";

function makeReq(): NextRequest {
  return new NextRequest("http://localhost/api/test");
}

const ctx = { params: Promise.resolve({}) } as unknown as {
  params: Promise<Record<string, string>>;
};

describe("withApiErrors", () => {
  it("devuelve la respuesta del handler si todo va bien (NextResponse)", async () => {
    const handler = withApiErrors("TEST", async () => {
      return NextResponse.json({ ok: true, value: 42 });
    });
    const res = await handler(makeReq(), ctx);
    expect(res).toBeInstanceOf(NextResponse);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, value: 42 });
  });

  it("envuelve objetos planos en NextResponse.json 200", async () => {
    const handler = withApiErrors("TEST", async () => ({ items: [1, 2, 3] }));
    const res = await handler(makeReq(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ items: [1, 2, 3] });
  });

  it("convierte undefined/null en { ok: true } 200", async () => {
    const handler = withApiErrors("TEST", async () => undefined);
    const res = await handler(makeReq(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("atrapa excepciones y devuelve JSON 500 con error y message", async () => {
    const handler = withApiErrors("TEST", async () => {
      throw new Error("DATABASE_URL no está definida");
    });
    const res = await handler(makeReq(), ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("INTERNAL_ERROR");
    expect(body.message).toBe("DATABASE_URL no está definida");
  });

  it("atrapa errores de NextAuth (NEXTAUTH_SECRET faltante simulado)", async () => {
    // Simulamos el error típico de next-auth en serverless cuando NEXTAUTH_SECRET
    // no está en env vars.
    const handler = withApiErrors("TEST", async () => {
      throw new Error("NEXTAUTH_SECRET no está definido");
    });
    const res = await handler(makeReq(), ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toContain("NEXTAUTH_SECRET");
  });

  it("atrapa strings lanzados (no solo Error instances)", async () => {
    const handler = withApiErrors("TEST", async () => {
      throw "algo explotó";
    });
    const res = await handler(makeReq(), ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("INTERNAL_ERROR");
    expect(body.message).toBe("algo explotó");
  });

  it("loguea el error con la etiqueta del handler", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withApiErrors("MI_LABEL", async () => {
      throw new Error("boom");
    });
    await handler(makeReq(), ctx);
    expect(spy).toHaveBeenCalledWith("[MI_LABEL] error:", expect.any(Error));
    spy.mockRestore();
  });
});
