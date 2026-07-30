-- ARCH-20260730-01: Eliminación masiva de empresas (sólo SUPERADMIN).
-- IMPL-20260730-01 (retry).
-- Ref: context/SPECs/SPEC_ARCH-20260730-01-DELETE-COMPANIES-SUPERADMIN.md
--
-- Esta migración:
--   1. Añade SUPERADMIN al enum UserRole (al final, no reordena).
--   2. Vuelve nullable `companyId` en appointments, job_positions y projects
--      para que el flujo de eliminación masiva pueda desvincular historia
--      clínica sin romper FKs NOT NULL.
--
-- No se hace DROP de tablas. No se borran filas. La asignación masiva de
-- SUPERADMIN a usuarios NO está incluida — Frank lo hace manualmente vía SQL
-- sobre el usuario que considere.

-- =====================================================================
-- 1. Extender enum UserRole con SUPERADMIN (al final)
-- =====================================================================
ALTER TYPE "UserRole" ADD VALUE 'SUPERADMIN';

-- =====================================================================
-- 2. Volver nullable companyId en tablas con FK NOT NULL hacia Company.
-- Preserva historia clínica: appointments, job_positions y projects se
-- desvinculan (companyId = NULL) en vez de borrarse en cascada.
-- =====================================================================
ALTER TABLE "appointments" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "job_positions" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "companyId" DROP NOT NULL;