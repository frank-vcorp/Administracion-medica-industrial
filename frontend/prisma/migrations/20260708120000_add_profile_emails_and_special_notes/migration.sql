-- ===========================================================================
-- ARCH-20260708-01: Datos completos del paciente y perfiles
-- Migración ADITIVA (no destructiva) — solo agrega columnas, tablas y valores enum.
-- Ref: context/SPECs/SPEC_ARCH-20260708-01-PERFILES-PACIENTE-CORREOS-CLONACION.md
-- ===========================================================================

-- 1. Extender enum IntakeSource con dos nuevos valores
ALTER TYPE "IntakeSource" ADD VALUE IF NOT EXISTS 'CLINIC_WALK_IN_MASS';
ALTER TYPE "IntakeSource" ADD VALUE IF NOT EXISTS 'UNIT_MOBILE_MASS';

-- 2. Nueva columna specialNotes en MedicalProfile (nullable, sin default)
ALTER TABLE "medical_profiles" ADD COLUMN IF NOT EXISTS "specialNotes" TEXT;

-- 3. Nueva columna intakeSource en Worker con default seguro
--    (se conserva PROJECT_SAME_DAY para todos los registros históricos).
ALTER TABLE "workers" ADD COLUMN IF NOT EXISTS "intakeSource" "IntakeSource" NOT NULL DEFAULT 'PROJECT_SAME_DAY';

-- 4. Nueva tabla MedicalProfileReportEmail (correos por perfil médico)
CREATE TABLE IF NOT EXISTS "medical_profile_report_emails" (
    "id"        TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "label"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medical_profile_report_emails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "medical_profile_report_emails_profileId_email_key"
    ON "medical_profile_report_emails"("profileId", "email");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'medical_profile_report_emails_profileId_fkey'
    ) THEN
        ALTER TABLE "medical_profile_report_emails"
            ADD CONSTRAINT "medical_profile_report_emails_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "medical_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. Nueva tabla WorkerReportEmail (correos adicionales por paciente, max 5 por UI)
CREATE TABLE IF NOT EXISTS "worker_report_emails" (
    "id"        TEXT NOT NULL,
    "workerId"  TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "worker_report_emails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "worker_report_emails_workerId_email_key"
    ON "worker_report_emails"("workerId", "email");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'worker_report_emails_workerId_fkey'
    ) THEN
        ALTER TABLE "worker_report_emails"
            ADD CONSTRAINT "worker_report_emails_workerId_fkey"
            FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
