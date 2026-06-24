-- =====================================================================
-- SCRIPT 4/4: SINCRONIZAR _prisma_migrations + VERIFICACIÓN FINAL
-- =====================================================================
-- Ejecutar ÚLTIMO. CRÍTICO para que el build de Vercel no falle después.

-- 4.1 Crear tabla _prisma_migrations si no existe
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                  VARCHAR(36)  NOT NULL,
    "checksum"            VARCHAR(64)  NOT NULL,
    "finished_at"         TIMESTAMPTZ,
    "migration_name"      VARCHAR(255) NOT NULL,
    "logs"                TEXT,
    "rolled_back_at"      TIMESTAMPTZ,
    "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- 4.2 Limpiar registros fallidos de las 3 migraciones
DELETE FROM "_prisma_migrations"
WHERE "migration_name" IN (
    '20260527121500_add_intake_trace_to_medical_event',
    '20260623170000_company_v2_vendedor_historial_link_publico',
    '20260624120000_company_self_reg_channel'
);

-- 4.3 Insertar las 3 migraciones como aplicadas
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES
    (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260527121500_add_intake_trace_to_medical_event', NOW(), 1),
    (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260623170000_company_v2_vendedor_historial_link_publico', NOW(), 1),
    (gen_random_uuid()::text, 'manual-railway-fix', NOW(), '20260624120000_company_self_reg_channel', NOW(), 1)
ON CONFLICT ("migration_name") DO UPDATE SET
    "finished_at" = NOW(),
    "rolled_back_at" = NULL,
    "applied_steps_count" = 1;

-- 4.4 Verificación final
SELECT
  (SELECT COUNT(*) FROM "_prisma_migrations"
   WHERE "migration_name" IN (
     '20260527121500_add_intake_trace_to_medical_event',
     '20260623170000_company_v2_vendedor_historial_link_publico',
     '20260624120000_company_self_reg_channel'
   ) AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL) AS "migraciones_aplicadas_de_3",

  (SELECT EXISTS (SELECT FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'sellerId')) AS "companies_sellerId",

  (SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'IntakeSource')) AS "IntakeSource",

  (SELECT EXISTS (SELECT FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'company_self_registrations')) AS "company_self_registrations",

  (SELECT EXISTS (SELECT FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'company_seller_history')) AS "company_seller_history",

  (SELECT EXISTS (SELECT FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'estados_mexico')) AS "estados_mexico",

  CASE
    WHEN (SELECT COUNT(*) FROM "_prisma_migrations"
          WHERE "migration_name" IN (
            '20260527121500_add_intake_trace_to_medical_event',
            '20260623170000_company_v2_vendedor_historial_link_publico',
            '20260624120000_company_self_reg_channel'
          ) AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL) = 3
    THEN 'OK - Refresca /workers y /companies en el navegador'
    ELSE 'INCOMPLETO - Avisa a INTEGRA con el error'
  END AS "estado";
