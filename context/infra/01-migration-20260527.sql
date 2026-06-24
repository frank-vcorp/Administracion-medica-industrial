-- =====================================================================
-- SCRIPT 1/4: MIGRACIÓN 20260527121500_add_intake_trace_to_medical_event
-- =====================================================================
-- Ejecutar PRIMERO. Es idempotente.

-- 1.1 Enum IntakeSource (solo si no existe)
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntakeSource') THEN
    CREATE TYPE "IntakeSource" AS ENUM (
      'APPOINTMENT',
      'PROJECT_PRE_REGISTERED',
      'PROJECT_SAME_DAY',
      'EXTERNAL_WALK_IN',
      'DIRECT_RECEPTION'
    );
  END IF;
END
$body$;

-- 1.2 Columnas en medical_events
ALTER TABLE "medical_events"
  ADD COLUMN IF NOT EXISTS "intakeSource" "IntakeSource",
  ADD COLUMN IF NOT EXISTS "projectId" TEXT,
  ADD COLUMN IF NOT EXISTS "intakeCreatedByUserId" TEXT;

-- 1.3 Foreign key medical_events_projectId_fkey (solo si no existe)
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'medical_events_projectId_fkey'
      AND table_name = 'medical_events'
  ) THEN
    ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$body$;

-- 1.4 Foreign key medical_events_intakeCreatedByUserId_fkey (solo si no existe)
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'medical_events_intakeCreatedByUserId_fkey'
      AND table_name = 'medical_events'
  ) THEN
    ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_intakeCreatedByUserId_fkey"
      FOREIGN KEY ("intakeCreatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$body$;

-- 1.5 Índices
CREATE INDEX IF NOT EXISTS "medical_events_projectId_idx" ON "medical_events"("projectId");
CREATE INDEX IF NOT EXISTS "medical_events_intakeCreatedByUserId_idx" ON "medical_events"("intakeCreatedByUserId");

-- Verificación
SELECT
  (SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'IntakeSource')) AS "IntakeSource_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_events' AND column_name = 'intakeSource')) AS "medical_events_intakeSource_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_events' AND column_name = 'projectId')) AS "medical_events_projectId_existe",
  (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'medical_events' AND column_name = 'intakeCreatedByUserId')) AS "medical_events_intakeCreatedByUserId_existe";
