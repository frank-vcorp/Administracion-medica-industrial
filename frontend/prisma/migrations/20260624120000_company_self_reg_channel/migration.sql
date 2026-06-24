-- IMPL-20260624-01: Ruta pública sin token para auto-alta (ARCH-20260624-01)
-- Ref: context/SPECs/SPEC_ARCH-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md
-- Ref: context/decisions/ADR-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md
--
-- Agrega columna opcional `channel` a company_self_registrations para
-- distinguir el origen del link:
--   - 'VENDOR_LINK'   → link generado por vendedor/admin (flujo existente)
--   - 'PUBLIC_DIRECT' → submit desde ruta pública /solicitar-alta (sin token)
--
-- Migración ADITIVA: el default 'VENDOR_LINK' mantiene retrocompatibilidad
-- con todos los registros existentes. No requiere backfill explícito.

ALTER TABLE "company_self_registrations"
  ADD COLUMN "channel" TEXT DEFAULT 'VENDOR_LINK';