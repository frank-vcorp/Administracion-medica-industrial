-- IMPL-20260730-02 (ARCH-20260730-01) — PR-1: añadir soft-disable a Branch.
--
-- Esta migración:
--   1. Añade `isActive` (default true) a `branches` para soft-disable.
--   2. Añade `disabledAt` (nullable) para auditoría temporal de la desactivación.
--   3. Añade `disabledByUserId` (nullable FK → users) para auditoría de autoría.
--   4. Crea índices para el filtro primario (tenantId+isActive) y búsqueda por nombre.
--
-- No se borran datos. No se cambia el comportamiento del modelo Branch existente.
-- Las branches pre-existentes quedan con isActive=true (backfill defensivo vía DEFAULT).

-- =====================================================================
-- 1. Nuevas columnas en `branches`
-- =====================================================================
ALTER TABLE "branches" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "branches" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "branches" ADD COLUMN "disabledByUserId" TEXT;

-- =====================================================================
-- 2. Índices (filtro primario + búsqueda por nombre)
-- =====================================================================
CREATE INDEX "branches_tenantId_isActive_idx" ON "branches"("tenantId", "isActive");
CREATE INDEX "branches_name_idx" ON "branches"("name");

-- =====================================================================
-- 3. FK disabledByUserId → users (SET NULL para no romper historial si se borra el user)
-- =====================================================================
ALTER TABLE "branches" ADD CONSTRAINT "branches_disabledByUserId_fkey" FOREIGN KEY ("disabledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
