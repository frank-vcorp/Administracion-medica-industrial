/**
 * @file /api/lab/search/[type] — autocomplete para admisión.
 * @id IMPL-20260701-07 — Bypass FastAPI.
 *
 * Tipos:
 *   - workers   → Worker[] por firstName/lastName/universalId
 *   - doctors   → User[] con labRole != null (médicos NOVA) por fullName
 *   - companies → Company[] por name/rfc
 *   - tests     → MedicalTest[] por code/name
 *
 * IMPL-20260701-07 (hotfix): handler envuelto en `withApiErrors`.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/auth";
import prisma from "@/lib/prisma";
import { isAdminLike } from "@/lib/auth/roles";
import { withApiErrors } from "@/lib/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchType = "workers" | "doctors" | "companies" | "tests";

function isValidType(t: string): t is SearchType {
  return ["workers", "doctors", "companies", "tests"].includes(t);
}

export const GET = withApiErrors(
  "GET /api/lab/search/[type]",
  async (
    req: NextRequest,
    { params }: { params: Promise<{ type: string }> }
  ) => {
    let session;
    try {
      session = await getServerSession(authOptions);
    } catch (err) {
       
      console.error("[search] session error:", err);
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const role = session?.user?.role;
    const userId = session?.user?.id;
    if (!session?.user || !userId || !isAdminLike(role)) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { type: rawType } = await params;
    if (!isValidType(rawType)) {
      return NextResponse.json({ type: "tipo inválido" }, { status: 400 });
    }
    const type = rawType as SearchType;

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    if (type === "workers") {
      const where = q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { universalId: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {};
      const list = await prisma.worker.findMany({
        where,
        take: 25,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        include: { company: { select: { name: true } } },
      });
      const today = new Date();
      return NextResponse.json(
        list.map((w) => {
          const age =
            w.dob
              ? Math.floor(
                  (today.getTime() - new Date(w.dob).getTime()) /
                    (365.25 * 24 * 60 * 60 * 1000)
                )
              : null;
          return {
            id: w.id,
            fullName: `${w.firstName} ${w.lastName}`.trim(),
            code: w.universalId,
            age,
            companyName: w.company?.name ?? null,
          };
        })
      );
    }

    if (type === "doctors") {
      // médicos NOVA = users con LabRole (no null)
      const where = q
        ? {
            AND: [
              { labRole: { not: null } },
              { fullName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : { labRole: { not: null } };
      const list = await prisma.user.findMany({
        where,
        take: 25,
        orderBy: { fullName: "asc" },
        select: { fullName: true, novaMedicoClave: true },
      });
      return NextResponse.json(
        list.map((u) => ({
          name: u.fullName,
          clave: u.novaMedicoClave ?? null,
        }))
      );
    }

    if (type === "companies") {
      const where = q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { rfc: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {};
      const list = await prisma.company.findMany({
        where,
        take: 25,
        orderBy: { name: "asc" },
        select: { id: true, name: true, rfc: true },
      });
      return NextResponse.json(list);
    }

    // tests
    // IMPL-20260701-07: MedicalTest no tiene columna `price`; extraemos
    // desde `options` (Json) si existe un campo `price`/`basePrice`,
    // si no devolvemos 0 y el usuario lo edita manualmente.
    const where = q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};
    const list = await prisma.medicalTest.findMany({
      where,
      take: 25,
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, options: true },
    });
    return NextResponse.json(
      list.map((t) => {
        const opts = (t.options ?? {}) as Record<string, unknown>;
        const rawPrice =
          typeof opts.price === "number"
            ? opts.price
            : typeof opts.basePrice === "number"
              ? opts.basePrice
              : 0;
        return {
          id: t.id,
          code: t.code,
          alternateCode:
            typeof opts.alternateCode === "string"
              ? opts.alternateCode
              : typeof opts.alternate_code === "string"
                ? opts.alternate_code
                : null,
          name: t.name,
          price: Number(rawPrice) || 0,
        };
      })
    );
  }
);
