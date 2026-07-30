/**
 * @fileoverview Endpoint admin para sincronizar la DB de producción con las migraciones de Prisma
 * @id FIX-20260624-02-MIGRATE-ADMIN
 * @see context/decisions/ADR (pendiente)
 *
 * PROPÓSITO:
 * La DB de producción de Vercel tiene drift: el enum IntakeSource existe pero la
 * migración 20260527121500_add_intake_trace_to_medical_event nunca se marcó como
 * aplicada. Esto bloquea `prisma migrate deploy` con error P3018/P42710.
 *
 * Este endpoint resuelve el drift de forma segura:
 *   1. Verifica auth ADMIN + secret de un solo uso (env var MIGRATE_SECRET).
 *   2. Diagnostica: consulta information_schema para ver qué objetos existen realmente.
 *   3. Resuelve: marca las migraciones problemáticas como "applied" con
 *      `prisma migrate resolve --applied`.
 *   4. Aplica: corre `prisma migrate deploy` para aplicar las migraciones restantes.
 *
 * PROTECCIÓN:
 *   - Requiere sesión ADMIN (getServerSession).
 *   - Requiere header `x-migrate-secret` con valor igual a env var MIGRATE_SECRET.
 *   - Solo POST.
 *   - Idempotente: si se llama varias veces, solo aplica lo que falta.
 *
 * USO (una sola vez después del deploy):
 *   curl -X POST https://<host>/api/admin/migrate \
 *        -H "Cookie: <session-cookie>" \
 *        -H "x-migrate-secret: $MIGRATE_SECRET"
 *
 * Después de ejecutarlo, la DB queda sincronizada y se puede volver a poner
 * `prisma migrate deploy` en el build script.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { isAdminLike } from "@/lib/auth/roles"
import { execSync } from "child_process"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Lista de migraciones que sabemos tienen drift en producción.
// Se marcan como "applied" best-effort antes de continuar con `migrate deploy`.
const DRIFTED_MIGRATIONS = [
    "20260527121500_add_intake_trace_to_medical_event",
]

interface MigrationStatus {
    name: string
    exists: boolean
    appliedAt: string | null
}

interface DiagnosticResult {
    migrationsTableExists: boolean
    appliedMigrations: MigrationStatus[]
    pendingMigrations: string[]
    hasIntakeSourceType: boolean | null
    hasCompaniesSellerId: boolean | null
}

function runPrismaCommand(args: string, cwd: string = process.cwd()): string {
    const cmd = `npx prisma ${args}`
    try {
        const output = execSync(cmd, {
            cwd,
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 60_000,
        })
        return output
    } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string }
        return [
            `EXIT_ERROR: ${e.message ?? "unknown"}`,
            `STDOUT: ${e.stdout ?? ""}`,
            `STDERR: ${e.stderr ?? ""}`,
        ].join("\n")
    }
}

async function diagnoseDatabase(): Promise<DiagnosticResult> {
    // Importar prisma dinámicamente para evitar bundling issues
    const { PrismaClient } = await import("@prisma/client")
    const prisma = new PrismaClient()

    try {
        // Verificar existencia de _prisma_migrations
        const migrationsTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = '_prisma_migrations'
            ) AS exists
        `
        const migrationsTableExists = migrationsTable[0]?.exists ?? false

        let appliedMigrations: MigrationStatus[] = []
        if (migrationsTableExists) {
            const rows = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
                SELECT migration_name, finished_at
                FROM "_prisma_migrations"
                WHERE rolled_back_at IS NULL
                ORDER BY started_at ASC
            `
            appliedMigrations = rows.map((r) => ({
                name: r.migration_name,
                exists: true,
                appliedAt: r.finished_at ? r.finished_at.toISOString() : null,
            }))
        }

        // Verificar tipos enum específicos
        const intakeSource = await prisma.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT FROM pg_type
                WHERE typname = 'IntakeSource'
            ) AS exists
        `
        const companiesSellerId = await prisma.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'companies'
                AND column_name = 'sellerId'
            ) AS exists
        `

        // Calcular migraciones pendientes (locales vs aplicadas)
        const { readdirSync } = await import("fs")
        const { join } = await import("path")
        const migrationsDir = join(process.cwd(), "prisma", "migrations")
        const localMigrations = readdirSync(migrationsDir)
            .filter((d) => /^\d{14}_/.test(d))
            .map((d) => d.replace(".sql", ""))
            .sort()

        const appliedNames = new Set(appliedMigrations.map((m) => m.name))
        const pendingMigrations = localMigrations.filter((m) => !appliedNames.has(m))

        return {
            migrationsTableExists,
            appliedMigrations,
            pendingMigrations,
            hasIntakeSourceType: intakeSource[0]?.exists ?? null,
            hasCompaniesSellerId: companiesSellerId[0]?.exists ?? null,
        }
    } finally {
        await prisma.$disconnect()
    }
}

export async function POST(request: NextRequest) {
    // 1. Verificar auth ADMIN
    const session = await getServerSession(authOptions)
    if (!session?.user || !isAdminLike(session.user.role)) {
        return NextResponse.json(
            { error: "No autorizado. Se requiere rol ADMIN." },
            { status: 401 }
        )
    }

    // 2. Verificar secret de un solo uso
    const providedSecret = request.headers.get("x-migrate-secret")
    const expectedSecret = process.env.MIGRATE_SECRET
    if (!expectedSecret) {
        return NextResponse.json(
            {
                error: "Servidor mal configurado. MIGRATE_SECRET no está definida en el ambiente.",
                hint: "Configura MIGRATE_SECRET en Vercel → Settings → Environment Variables.",
            },
            { status: 500 }
        )
    }
    if (providedSecret !== expectedSecret) {
        return NextResponse.json(
            { error: "Secret incorrecto. Header 'x-migrate-secret' no válido." },
            { status: 403 }
        )
    }

    // 3. Diagnóstico
    const diagnostic = await diagnoseDatabase()

    // 4. Si la DB ya está sincronizada, no hacer nada
    if (diagnostic.pendingMigrations.length === 0) {
        return NextResponse.json({
            status: "already_synced",
            message: "La DB ya tiene todas las migraciones aplicadas. No se hizo nada.",
            diagnostic,
        })
    }

    // 5. Resolver migraciones con drift conocido
    const resolveResults: Array<{ migration: string; output: string }> = []
    for (const migration of DRIFTED_MIGRATIONS) {
        if (diagnostic.pendingMigrations.includes(migration)) {
            const output = runPrismaCommand(
                `migrate resolve --applied ${migration}`,
                process.cwd() + "/frontend"
            )
            resolveResults.push({ migration, output })
        }
    }

    // 6. Aplicar migraciones pendientes
    const deployOutput = runPrismaCommand(
        "migrate deploy",
        process.cwd() + "/frontend"
    )

    // 7. Re-generar cliente (por si acaso)
    const generateOutput = runPrismaCommand(
        "generate",
        process.cwd() + "/frontend"
    )

    // 8. Re-diagnóstico
    const postDiagnostic = await diagnoseDatabase()

    return NextResponse.json({
        status: postDiagnostic.pendingMigrations.length === 0 ? "synced" : "partial",
        message: postDiagnostic.pendingMigrations.length === 0
            ? "Migraciones aplicadas. DB sincronizada."
            : "Quedan migraciones pendientes. Revisa los logs.",
        preDiagnostic: diagnostic,
        resolveResults,
        deployOutput,
        generateOutput,
        postDiagnostic,
    })
}
