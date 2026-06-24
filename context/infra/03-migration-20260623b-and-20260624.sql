-- =====================================================================
-- SCRIPT 3/4: MIGRACIÓN 20260623170000 (PARTE B: tablas nuevas)
-- =====================================================================
-- Ejecutar TERCERO. Es idempotente.

-- 3.1 company_seller_history
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

DO $body$
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
END
$body$;

-- 3.2 company_self_registrations
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

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'company_self_registrations_submittedCompanyId_fkey') THEN
    ALTER TABLE "company_self_registrations" ADD CONSTRAINT "company_self_registrations_submittedCompanyId_fkey"
      FOREIGN KEY ("submittedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'company_self_registrations_createdByUserId_fkey') THEN
    ALTER TABLE "company_self_registrations" ADD CONSTRAINT "company_self_registrations_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$body$;

-- 3.3 estados_mexico
CREATE TABLE IF NOT EXISTS "estados_mexico" (
  "id"        INTEGER NOT NULL,
  "nombre"    TEXT NOT NULL,
  "municipios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "estados_mexico_pkey" PRIMARY KEY ("id")
);

-- 3.4 MIGRACIÓN 20260624120000_company_self_reg_channel (columna channel)
ALTER TABLE "company_self_registrations"
  ADD COLUMN IF NOT EXISTS "channel" TEXT DEFAULT 'VENDOR_LINK';

-- Verificación
SELECT
  (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_seller_history')) AS "company_seller_history_existe",
  (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_self_registrations')) AS "company_self_registrations_existe",
  (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'estados_mexico')) AS "estados_mexico_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'company_self_registrations' AND column_name = 'channel')) AS "company_self_registrations_channel_existe";
