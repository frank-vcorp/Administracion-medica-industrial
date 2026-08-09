-- ARCH-20260809-05: Tabla genérica KV para configuración runtime editable
-- por UI (sin redeploy). Usada por el selector de proveedor de extracción
-- predeterminado (extraction_default_provider) y futuras settings de runtime.
--
-- Esta migración:
--   1. Crea tabla app_config con PK sobre `key`.
--   2. No toca tablas existentes. No inserta filas (ausencia = fallback al default).
--   3. FK opcional hacia User.updatedBy (nullable; si el user se borra, queda NULL).
--
-- Refs:
--   - context/SPECs/SPEC_ARCH-20260809-05-AI-KEYS-PROBE-CONEXION-DEFAULT-EXTRACCION.md

-- =====================================================================
-- 1. Tabla app_config
-- =====================================================================
CREATE TABLE "app_config" (
    "key"        TEXT NOT NULL,
    "value"      JSONB NOT NULL,
    "updatedBy"  TEXT,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- FK opcional hacia User.updatedBy (si existe la tabla User).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'app_config_updatedBy_fkey'
        ) THEN
            ALTER TABLE "app_config"
                ADD CONSTRAINT "app_config_updatedBy_fkey"
                FOREIGN KEY ("updatedBy") REFERENCES "User"("id")
                ON DELETE SET NULL
                ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
