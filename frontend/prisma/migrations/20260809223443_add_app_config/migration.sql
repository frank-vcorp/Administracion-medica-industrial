-- ARCH-20260809-05: Espejo de la migración backend para el schema del frontend.
-- Crea tabla app_config para configuración runtime editable por UI.
-- Ver context/SPECs/SPEC_ARCH-20260809-05-AI-KEYS-PROBE-CONEXION-DEFAULT-EXTRACCION.md.

CREATE TABLE "app_config" (
    "key"        TEXT NOT NULL,
    "value"      JSONB NOT NULL,
    "updatedBy"  TEXT,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

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
