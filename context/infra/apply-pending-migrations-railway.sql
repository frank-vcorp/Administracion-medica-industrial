-- =====================================================================
-- APLICACIÓN DIRECTA DE MIGRACIONES PENDIENTES EN RAILWAY (PostgreSQL)
-- =====================================================================
-- ID: FIX-20260624-05
-- Fecha: 2026-06-24
-- Autor: INTEGRA
--
-- PROPÓSITO:
-- Sincronizar la DB de producción con las 3 migraciones locales pendientes
-- sin pasar por `prisma migrate deploy` (que falla por drift).
--
-- MIGRACIONES APLICADAS:
--   1. 20260527121500_add_intake_trace_to_medical_event
--   2. 20260623170000_company_v2_vendedor_historial_link_publico
--   3. 20260624120000_company_self_reg_channel
--
-- INSTRUCCIONES:
--   1. Conectar a Railway Postgres (vía Railway Dashboard → Query).
--   2. Limpiar el query actual.
--   3. Pegar este script completo.
--   4. Ejecutar (Run).
--   5. Al final aparecerá una tabla con la verificación.
--   6. Refrescar el navegador y abrir /workers, /companies.
--
-- ⚠️ El script es IDEMPOTENTE. Cada CREATE usa IF NOT EXISTS o verificación
--    con EXISTS() para evitar duplicados. Puedes ejecutarlo varias veces.
-- =====================================================================

-- =====================================================================
-- 0. Verificación inicial
-- =====================================================================
SELECT
  (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prisma_migrations')) AS "_prisma_migrations_existe",
  (SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'IntakeSource')) AS "IntakeSource_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'sellerId')) AS "companies_sellerId_existe",
  (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_self_registrations')) AS "company_self_registrations_existe",
  (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_seller_history')) AS "company_seller_history_existe",
  (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'estados_mexico')) AS "estados_mexico_existe";

-- =====================================================================
-- 1. MIGRACIÓN 20260527121500_add_intake_trace_to_medical_event
-- =====================================================================

-- 1.1 CREATE TYPE IntakeSource (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntakeSource') THEN
    CREATE TYPE "IntakeSource" AS ENUM (
      'APPOINTMENT',
      'PROJECT_PRE_REGISTERED',
      'PROJECT_SAME_DAY',
      'EXTERNAL_WALK_IN',
      'DIRECT_RECEPTION'
    );
  END IF;
END $$;

-- 1.2 ALTER TABLE medical_events ADD COLUMN (idempotente)
ALTER TABLE "medical_events"
  ADD COLUMN IF NOT EXISTS "intakeSource" "IntakeSource",
  ADD COLUMN IF NOT EXISTS "projectId" TEXT,
  ADD COLUMN IF NOT EXISTS "intakeCreatedByUserId" TEXT;

-- 1.3 Foreign keys (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'medical_events_projectId_fkey' AND table_name = 'medical_events') THEN
    ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'medical_events_intakeCreatedByUserId_fkey' AND table_name = 'medical_events') THEN
    ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_intakeCreatedByUserId_fkey"
      FOREIGN KEY ("intakeCreatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 1.4 Índices
CREATE INDEX IF NOT EXISTS "medical_events_projectId_idx" ON "medical_events"("projectId");
CREATE INDEX IF NOT EXISTS "medical_events_intakeCreatedByUserId_idx" ON "medical_events"("intakeCreatedByUserId");

-- =====================================================================
-- 2. MIGRACIÓN 20260623170000_company_v2_vendedor_historial_link_publico
-- =====================================================================

-- 2.1 ALTER TYPE UserRole ADD VALUE 'VENDEDOR' (idempotente)
-- ⚠️ NOTA: en PG <12, ALTER TYPE ADD VALUE no se puede usar en la misma
-- transacción que otras operaciones que usen el enum. Si falla, ejecuta
-- este DO block por separado.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'VENDEDOR'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'VENDEDOR' AFTER 'COMPANY_CLIENT';
  END IF;
END $$;

-- 2.2 Crear enums nuevos (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanyStatus') THEN
    CREATE TYPE "CompanyStatus" AS ENUM ('PENDIENTE_REVISION', 'HABILITADO', 'DESHABILITADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanyOrigin') THEN
    CREATE TYPE "CompanyOrigin" AS ENUM ('MANUAL', 'AUTO_ALTA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanySelfRegStatus') THEN
    CREATE TYPE "CompanySelfRegStatus" AS ENUM ('ACTIVE', 'SUBMITTED', 'EXPIRED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CfdiUso') THEN
    CREATE TYPE "CfdiUso" AS ENUM (
      'G01', 'G02', 'G03',
      'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10',
      'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20',
      'P01', 'S01', 'CP01', 'CN01'
    );
  END IF;
END $$;

-- 2.3 ALTER TABLE companies ADD COLUMN (idempotente)
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "sellerId"          TEXT,
  ADD COLUMN IF NOT EXISTS "sellerAssignedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "origen"            "CompanyOrigin" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "estado"            "CompanyStatus" NOT NULL DEFAULT 'HABILITADO',
  ADD COLUMN IF NOT EXISTS "enabledAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "enabledByUserId"   TEXT,
  ADD COLUMN IF NOT EXISTS "fiscalData"        JSONB,
  ADD COLUMN IF NOT EXISTS "repLegalData"      JSONB,
  ADD COLUMN IF NOT EXISTS "rhData"            JSONB,
  ADD COLUMN IF NOT EXISTS "cuentasPagarData"  JSONB,
  ADD COLUMN IF NOT EXISTS "referenciasData"   JSONB,
  ADD COLUMN IF NOT EXISTS "terminosAceptados" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "documentosAdjuntos" JSONB;

-- 2.4 Backfill de filas existentes
UPDATE "companies"
SET "origen"    = 'MANUAL',
    "estado"    = 'HABILITADO',
    "enabledAt" = COALESCE("enabledAt", NOW())
WHERE "origen" IS NULL OR "estado" IS NULL;

UPDATE "companies" c
SET "enabledByUserId" = (
  SELECT u.id FROM "users" u
  WHERE u.role = 'ADMIN'
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE c."enabledByUserId" IS NULL;

-- 2.5 Foreign keys de companies (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'companies_sellerId_fkey' AND table_name = 'companies') THEN
    ALTER TABLE "companies" ADD CONSTRAINT "companies_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'companies_enabledByUserId_fkey' AND table_name = 'companies') THEN
    ALTER TABLE "companies" ADD CONSTRAINT "companies_enabledByUserId_fkey"
      FOREIGN KEY ("enabledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2.6 Índices de companies
CREATE INDEX IF NOT EXISTS "companies_sellerId_idx" ON "companies"("sellerId");
CREATE INDEX IF NOT EXISTS "companies_estado_idx" ON "companies"("estado");
CREATE INDEX IF NOT EXISTS "companies_origen_idx" ON "companies"("origen");

-- 2.7 Crear tabla company_seller_history
CREATE TABLE IF NOT EXISTS "company_seller_history" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId"        TEXT NOT NULL,
  "previousSellerId" TEXT,
  "newSellerId"      TEXT,
  "changedByUserId"  TEXT NOT NULL,
  "changedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason"           TEXT,
  CONSTRAINT "company_seller_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "company_seller_history_companyId_changedAt_idx"
  ON "company_seller_history"("companyId", "changedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'company_seller_history_companyId_fkey') THEN
    ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'company_seller_history_previousSellerId_fkey') THEN
    ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_previousSellerId_fkey"
      FOREIGN KEY ("previousSellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'company_seller_history_newSellerId_fkey') THEN
    ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_newSellerId_fkey"
      FOREIGN KEY ("newSellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'company_seller_history_changedByUserId_fkey') THEN
    ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_changedByUserId_fkey"
      FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 2.8 Crear tabla company_self_registrations
CREATE TABLE IF NOT EXISTS "company_self_registrations" (
  "id"                 TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tokenHash"          TEXT NOT NULL,
  "companyDraft"       JSONB,
  "uploadedFiles"      JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status"             "CompanySelfRegStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "openedCount"        INTEGER NOT NULL DEFAULT 0,
  "submittedAt"        TIMESTAMP(3),
  "submittedCompanyId" TEXT,
  "createdByUserId"    TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_self_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_self_registrations_tokenHash_key"
  ON "company_self_registrations"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "company_self_registrations_submittedCompanyId_key"
  ON "company_self_registrations"("submittedCompanyId");
CREATE INDEX IF NOT EXISTS "company_self_registrations_status_idx"
  ON "company_self_registrations"("status");
CREATE INDEX IF NOT EXISTS "company_self_registrations_expiresAt_idx"
  ON "company_self_registrations"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'company_self_registrations_submittedCompanyId_fkey') THEN
    ALTER TABLE "company_self_registrations" ADD CONSTRAINT "company_self_registrations_submittedCompanyId_fkey"
      FOREIGN KEY ("submittedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'company_self_registrations_createdByUserId_fkey') THEN
    ALTER TABLE "company_self_registrations" ADD CONSTRAINT "company_self_registrations_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2.9 Crear tabla estados_mexico
CREATE TABLE IF NOT EXISTS "estados_mexico" (
  "id"        INTEGER NOT NULL,
  "nombre"    TEXT NOT NULL,
  "municipios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "estados_mexico_pkey" PRIMARY KEY ("id")
);

-- =====================================================================
-- 3. MIGRACIÓN 20260624120000_company_self_reg_channel
-- =====================================================================

ALTER TABLE "company_self_registrations"
  ADD COLUMN IF NOT EXISTS "channel" TEXT DEFAULT 'VENDOR_LINK';

-- =====================================================================
-- 4. SINCRONIZAR _prisma_migrations (CRÍTICO)
-- =====================================================================

-- Crear tabla _prisma_migrations si no existe
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                  VARCHAR(36)  NOT NULL,
    "checksum"            VARCHAR(64)  NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      VARCHAR(255) NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- Limpiar registros fallidos de las 3 migraciones que vamos a marcar como aplicadas
DELETE FROM "_prisma_migrations"
WHERE "migration_name" IN (
    '20260527121500_add_intake_trace_to_medical_event',
    '20260623170000_company_v2_vendedor_historial_link_publico',
    '20260624120000_company_self_reg_channel'
);

-- Insertar las 3 migraciones como aplicadas
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES
    (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260527121500_add_intake_trace_to_medical_event', NOW(), 1),
    (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260623170000_company_v2_vendedor_historial_link_publico', NOW(), 1),
    (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260624120000_company_self_reg_channel', NOW(), 1)
ON CONFLICT ("migration_name") DO UPDATE SET
    "finished_at" = NOW(),
    "rolled_back_at" = NULL,
    "applied_steps_count" = 1;

-- =====================================================================
-- 5. Verificación final
-- =====================================================================

SELECT
  (SELECT COUNT(*) FROM "_prisma_migrations"
   WHERE "migration_name" IN (
     '20260527121500_add_intake_trace_to_medical_event',
     '20260623170000_company_v2_vendedor_historial_link_publico',
     '20260624120000_company_self_reg_channel'
   ) AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL) AS "migraciones_aplicadas_de_3",

  (SELECT EXISTS (SELECT FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'sellerId')) AS "companies_sellerId_existe",

  (SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'IntakeSource')) AS "enum_IntakeSource_existe",

  (SELECT EXISTS (SELECT FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'company_self_registrations')) AS "tabla_company_self_registrations_existe",

  (SELECT EXISTS (SELECT FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'company_seller_history')) AS "tabla_company_seller_history_existe",

  (SELECT EXISTS (SELECT FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'estados_mexico')) AS "tabla_estados_mexico_existe",

  CASE
    WHEN (SELECT COUNT(*) FROM "_prisma_migrations"
          WHERE "migration_name" IN (
            '20260527121500_add_intake_trace_to_medical_event',
            '20260623170000_company_v2_vendedor_historial_link_publico',
            '20260624120000_company_self_reg_channel'
          ) AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL) = 3
    THEN 'OK - Refresca /workers y /companies en el navegador'
    ELSE 'INCOMPLETO - Revisa los mensajes de error arriba'
  END AS "estado";
