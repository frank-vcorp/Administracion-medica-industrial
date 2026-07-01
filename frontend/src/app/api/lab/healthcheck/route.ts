/**
 * Endpoint público de diagnóstico.
 * IMPL-20260701-08: ayuda a Frank a saber qué env var falta.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV ?? "NOT_SET",
    has_database_url: !!process.env.DATABASE_URL,
    database_url_preview: process.env.DATABASE_URL
      ? `${process.env.DATABASE_URL.substring(0, 20)}...${process.env.DATABASE_URL.substring(process.env.DATABASE_URL.length - 20)}`
      : "NOT_SET",
    has_nextauth_secret: !!process.env.NEXTAUTH_SECRET,
    nextauth_url: process.env.NEXTAUTH_URL ?? "NOT_SET",
    nextauth_trust_host: process.env.NEXTAUTH_TRUST_HOST ?? "NOT_SET",
    prisma_can_load: false,
    prisma_can_connect: false,
    prisma_can_query: false,
    labunit_count: -1,
    error_chain: [] as string[],
  };

  try {
    const { PrismaClient } = await import("@prisma/client");
    checks.prisma_can_load = true;
    const prisma = new PrismaClient({ log: ["error"] });
    try {
      await prisma.$connect();
      checks.prisma_can_connect = true;
      try {
        checks.labunit_count = await prisma.labUnit.count();
        checks.prisma_can_query = true;
      } catch (qErr) {
        checks.error_chain.push(`QUERY_ERROR: ${qErr instanceof Error ? qErr.message : String(qErr)}`);
      }
      await prisma.$disconnect();
    } catch (cErr) {
      checks.error_chain.push(`CONNECT_ERROR: ${cErr instanceof Error ? cErr.message : String(cErr)}`);
    }
  } catch (lErr) {
    checks.error_chain.push(`LOAD_ERROR: ${lErr instanceof Error ? lErr.message : String(lErr)}`);
  }

  return NextResponse.json(checks, { status: 200 });
}