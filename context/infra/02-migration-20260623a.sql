-- =====================================================================
-- SCRIPT 2/4: MIGRACIÓN 20260623170000_company_v2_vendedor (PARTE A: enums + columnas companies + backfill + FKs + índices)
-- =====================================================================
-- Ejecutar SEGUNDO. Es idempotente.

-- 2.1 ALTER TYPE UserRole ADD VALUE 'VENDEDOR'
-- ⚠️ Si PG <12, esto puede no funcionar en la misma transacción. Si falla, ejecuta SOLO esta línea primero.
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'VENDEDOR'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'VENDEDOR' AFTER 'COMPANY_CLIENT';
  END IF;
END
$body$;

-- 2.2 Enums nuevos
DO $body$
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
END
$body$;

-- 2.3 Columnas en companies
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

-- 2.5 Foreign keys de companies
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'companies_sellerId_fkey' AND table_name = 'companies') THEN
    ALTER TABLE "companies" ADD CONSTRAINT "companies_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'companies_enabledByUserId_fkey' AND table_name = 'companies') THEN
    ALTER TABLE "companies" ADD CONSTRAINT "companies_enabledByUserId_fkey"
      FOREIGN KEY ("enabledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$body$;

-- 2.6 Índices de companies
CREATE INDEX IF NOT EXISTS "companies_sellerId_idx" ON "companies"("sellerId");
CREATE INDEX IF NOT EXISTS "companies_estado_idx" ON "companies"("estado");
CREATE INDEX IF NOT EXISTS "companies_origen_idx" ON "companies"("origen");

-- Verificación
SELECT
  (SELECT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'VENDEDOR' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole'))) AS "UserRole_VENDEDOR_existe",
  (SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'CompanyStatus')) AS "CompanyStatus_existe",
  (SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'CompanyOrigin')) AS "CompanyOrigin_existe",
  (SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'CompanySelfRegStatus')) AS "CompanySelfRegStatus_existe",
  (SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'CfdiUso')) AS "CfdiUso_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'sellerId')) AS "companies_sellerId_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'origen')) AS "companies_origen_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'estado')) AS "companies_estado_existe";
