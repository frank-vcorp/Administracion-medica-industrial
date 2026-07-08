-- ===========================================================================
-- FIX-20260708-01: Drift entre schema.prisma y DB de Railway
-- ===========================================================================
-- Causa: El commit 8213211 (IMPL-20260519-10, sprint recepción operativa
-- del 2026-05-19) agregó 14 columnas a schema.prisma (4 en workers + 10
-- en appointments) pero NUNCA generó una migración Prisma. Las columnas
-- tampoco se aplicaron manualmente a Railway DB, así que la build de
-- 2026-07-07 17:25 falló con:
--   "The column `workers.lastIdentityDocumentType` does not exist"
--
-- Este script es ADITIVO: solo agrega columnas NULL con default null.
-- NO toca datos existentes, NO borra nada, NO renombra.
--
-- Aplicado vía: prisma db execute --url <railway_url> --stdin < este.sql
-- NO se registra como migración Prisma nueva (la tabla _prisma_migrations
-- de Railway está vacía; usamos sync-prisma-migrations.ts para alinearla).
--
-- Referencia: context/Juntas/Junta semanal 2026-07-01
--             + log de error Vercel 2026-07-07 17:25
-- ID: FIX-20260708-01
-- ===========================================================================

-- ─── workers (4 columnas) ──────────────────────────────────────────────────
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "lastIdentityDocumentType" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "lastIdentityFrontFileUrl" TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "lastIdentityBackFileUrl"  TEXT;
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "lastIdentityVerifiedAt"   TIMESTAMP(3);

-- ─── appointments (10 columnas) ────────────────────────────────────────────
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "identityDocumentType"      TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "identityEvidenceMode"      TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "identityFrontFileUrl"      TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "identityBackFileUrl"       TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "corroborationResult"       TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "identityVerifiedAt"        TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "identityVerifiedByUserId"  TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "identityExceptionReason"   TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "identityExceptionComment"  TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "qrOperativo"               TEXT;

-- ===========================================================================
-- FIN. 14 columnas agregadas. Verificación:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name IN ('workers','appointments') ORDER BY table_name, ordinal_position;
-- ===========================================================================