-- IMPL-20260809-06 — ARCH-20260809-03.
-- Gestión runtime de API Keys IA vía UI (sin env vars ni redeploys).
-- Tabla dedicada para cifrar AES-256-GCM las keys de los proveedores IA
-- (m3, gemini, dr7). Single-tenant (no multi-empresa en este corte).
--
-- Esta migración:
--   1. Crea tabla ai_provider_keys con row único por proveedor.
--   2. No toca tablas existentes. No inserta filas. Frank puebla vía UI
--      cuando active AI_KEYS_FROM_DB_ENABLED.
--
-- Refs:
--   - context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md
--   - context/decisions/ADR-20260809-03-GESTION-API-KEYS-IA-RUNTIME.md

-- =====================================================================
-- 1. Tabla ai_provider_keys
-- =====================================================================
CREATE TABLE "ai_provider_keys" (
    "id"            TEXT NOT NULL,
    "provider"      TEXT NOT NULL,
    "keyCiphertext" BYTEA NOT NULL,
    "keyNonce"      BYTEA NOT NULL,
    "keyTag"        BYTEA NOT NULL,
    "baseUrl"       TEXT,
    "defaultModel"  TEXT,
    "enabled"       BOOLEAN NOT NULL DEFAULT true,
    "updatedBy"     TEXT,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_keys_pkey" PRIMARY KEY ("id")
);

-- UNIQUE sobre provider (un row por proveedor). Crea índice implícito.
CREATE UNIQUE INDEX "ai_provider_keys_provider_key" ON "ai_provider_keys"("provider");

-- FK opcional hacia User.updatedBy (nullable; si el user se borra, queda NULL
-- en updatedBy — preserva trazabilidad histórica sin romper la auditoría).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'ai_provider_keys_updatedBy_fkey'
        ) THEN
            ALTER TABLE "ai_provider_keys"
                ADD CONSTRAINT "ai_provider_keys_updatedBy_fkey"
                FOREIGN KEY ("updatedBy") REFERENCES "User"("id")
                ON DELETE SET NULL
                ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;