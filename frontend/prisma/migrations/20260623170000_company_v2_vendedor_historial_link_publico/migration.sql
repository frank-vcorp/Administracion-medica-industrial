-- IMPL-20260623-02: Ficha Cliente v2 (ARCH-20260623-03)
-- Ref: context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
--
-- Reglas:
--   * Solo se AGREGAN columnas opcionales a companies (no se rompen FK existentes).
--   * Backfill: clientes existentes → origen=MANUAL, estado=HABILITADO, enabledAt=NOW().
--   * Nuevos modelos: company_seller_history, company_self_registrations, estados_mexico.
--   * Rol VENDEDOR se suma al final del enum UserRole (no reordenar).

-- =====================================================================
-- 1. Extender enum UserRole con VENDEDOR
-- =====================================================================
ALTER TYPE "UserRole" ADD VALUE 'VENDEDOR' AFTER 'COMPANY_CLIENT';

-- =====================================================================
-- 2. Crear nuevos enums
-- =====================================================================
CREATE TYPE "CompanyStatus" AS ENUM ('PENDIENTE_REVISION', 'HABILITADO', 'DESHABILITADO');
CREATE TYPE "CompanyOrigin" AS ENUM ('MANUAL', 'AUTO_ALTA');
CREATE TYPE "CompanySelfRegStatus" AS ENUM ('ACTIVE', 'SUBMITTED', 'EXPIRED', 'CANCELLED');

-- =====================================================================
-- 3. Crear enum CfdiUso (catálogo SAT de uso de CFDI)
-- =====================================================================
CREATE TYPE "CfdiUso" AS ENUM (
  'G01', 'G02', 'G03',
  'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10',
  'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20',
  'P01', 'S01', 'CP01', 'CN01'
);

-- =====================================================================
-- 4. Agregar columnas a companies (defaults seguros para backfill)
-- =====================================================================
ALTER TABLE "companies"
  ADD COLUMN "sellerId"          TEXT,
  ADD COLUMN "sellerAssignedAt"  TIMESTAMP(3),
  ADD COLUMN "origen"            "CompanyOrigin" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "estado"            "CompanyStatus" NOT NULL DEFAULT 'HABILITADO',
  ADD COLUMN "enabledAt"         TIMESTAMP(3),
  ADD COLUMN "enabledByUserId"   TEXT,
  ADD COLUMN "fiscalData"        JSONB,
  ADD COLUMN "repLegalData"      JSONB,
  ADD COLUMN "rhData"            JSONB,
  ADD COLUMN "cuentasPagarData"  JSONB,
  ADD COLUMN "referenciasData"   JSONB,
  ADD COLUMN "terminosAceptados" BOOLEAN,
  ADD COLUMN "documentosAdjuntos" JSONB;

-- =====================================================================
-- 5. Backfill de filas existentes: MANUAL + HABILITADO + enabledAt=NOW()
-- =====================================================================
UPDATE "companies"
SET "origen"    = 'MANUAL',
    "estado"    = 'HABILITADO',
    "enabledAt" = COALESCE("enabledAt", NOW())
WHERE "origen" IS NULL OR "estado" IS NULL;

-- Asignar enabledByUserId al admin más antiguo si está nulo
UPDATE "companies" c
SET "enabledByUserId" = (
  SELECT u.id FROM "users" u
  WHERE u.role = 'ADMIN'
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE c."enabledByUserId" IS NULL;

-- =====================================================================
-- 6. Foreign keys nuevas en companies
-- =====================================================================
ALTER TABLE "companies" ADD CONSTRAINT "companies_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "companies" ADD CONSTRAINT "companies_enabledByUserId_fkey"
  FOREIGN KEY ("enabledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "companies_sellerId_idx" ON "companies"("sellerId");
CREATE INDEX "companies_estado_idx" ON "companies"("estado");
CREATE INDEX "companies_origen_idx" ON "companies"("origen");

-- =====================================================================
-- 7. Tabla company_seller_history (append-only)
-- =====================================================================
CREATE TABLE "company_seller_history" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId"        TEXT NOT NULL,
  "previousSellerId" TEXT,
  "newSellerId"      TEXT,
  "changedByUserId"  TEXT NOT NULL,
  "changedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason"           TEXT,

  CONSTRAINT "company_seller_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_seller_history_companyId_changedAt_idx"
  ON "company_seller_history"("companyId", "changedAt");

ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_previousSellerId_fkey"
  FOREIGN KEY ("previousSellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_newSellerId_fkey"
  FOREIGN KEY ("newSellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "company_seller_history" ADD CONSTRAINT "company_seller_history_changedByUserId_fkey"
  FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- 8. Tabla company_self_registrations (link público)
-- =====================================================================
CREATE TABLE "company_self_registrations" (
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

CREATE UNIQUE INDEX "company_self_registrations_tokenHash_key"
  ON "company_self_registrations"("tokenHash");

CREATE UNIQUE INDEX "company_self_registrations_submittedCompanyId_key"
  ON "company_self_registrations"("submittedCompanyId");

CREATE INDEX "company_self_registrations_status_idx"
  ON "company_self_registrations"("status");

CREATE INDEX "company_self_registrations_expiresAt_idx"
  ON "company_self_registrations"("expiresAt");

ALTER TABLE "company_self_registrations" ADD CONSTRAINT "company_self_registrations_submittedCompanyId_fkey"
  FOREIGN KEY ("submittedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "company_self_registrations" ADD CONSTRAINT "company_self_registrations_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- 9. Catálogo estados_mexico
-- =====================================================================
CREATE TABLE "estados_mexico" (
  "id"        INTEGER NOT NULL,
  "nombre"    TEXT NOT NULL,
  "municipios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  CONSTRAINT "estados_mexico_pkey" PRIMARY KEY ("id")
);
