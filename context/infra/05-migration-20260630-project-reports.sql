-- =====================================================================
-- SCRIPT: APLICAR MIGRACIÓN 20260630170000_add_project_report (IMPL-20260630-03)
-- =====================================================================
-- Ejecutar en Railway Dashboard → Database → Query, UNA SOLA CORRIDA.
-- Crea tabla project_reports + 2 índices + 2 FKs + sincroniza _prisma_migrations.
-- Idempotente en la tabla de migraciones (ON CONFLICT).
-- =====================================================================

-- 1. Crear tabla project_reports
CREATE TABLE IF NOT EXISTS "project_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileUrlXlsx" TEXT,
    "fileUrlPdf" TEXT,
    "errorMessage" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "project_reports_pkey" PRIMARY KEY ("id")
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS "project_reports_projectId_idx" ON "project_reports"("projectId");
CREATE INDEX IF NOT EXISTS "project_reports_status_idx" ON "project_reports"("status");

-- 3. Foreign keys (idempotente: solo agregar si no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'project_reports_projectId_fkey'
    ) THEN
        ALTER TABLE "project_reports"
            ADD CONSTRAINT "project_reports_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'project_reports_generatedById_fkey'
    ) THEN
        ALTER TABLE "project_reports"
            ADD CONSTRAINT "project_reports_generatedById_fkey"
            FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END
$$;

-- 4. Sincronizar _prisma_migrations para que el próximo build no falle
--    Patrón idempotente SIN ON CONFLICT (Railway no tiene UNIQUE en migration_name).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "_prisma_migrations"
        WHERE "migration_name" = '20260630170000_add_project_report'
    ) THEN
        INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
        VALUES (
            gen_random_uuid()::text,
            'manual-railway-fix-20260630',
            NOW(),
            '20260630170000_add_project_report',
            NOW(),
            1
        );
    ELSE
        UPDATE "_prisma_migrations"
        SET "finished_at" = NOW(),
            "rolled_back_at" = NULL,
            "applied_steps_count" = 1
        WHERE "migration_name" = '20260630170000_add_project_report';
    END IF;
END
$$;

-- 5. Verificación final (debe devolver 1/1/1/1/1)
SELECT
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'project_reports') AS "tabla_existe",

    (SELECT COUNT(*) FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'project_reports'
       AND indexname IN ('project_reports_projectId_idx', 'project_reports_status_idx')) AS "indices_creados",

    (SELECT COUNT(*) FROM pg_constraint
     WHERE conname IN ('project_reports_projectId_fkey', 'project_reports_generatedById_fkey')) AS "fks_creadas",

    (SELECT COUNT(*) FROM "_prisma_migrations"
     WHERE "migration_name" = '20260630170000_add_project_report'
       AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL) AS "migracion_registrada";