-- IMPL-20260527-01
-- Ref: context/interconsultas/HANDOFF_ARCH-20260527-11_SOFIA_SLICE-A-TRAZABILIDAD-EVENT.md

CREATE TYPE "IntakeSource" AS ENUM (
  'APPOINTMENT',
  'PROJECT_PRE_REGISTERED',
  'PROJECT_SAME_DAY',
  'EXTERNAL_WALK_IN',
  'DIRECT_RECEPTION'
);

ALTER TABLE "medical_events"
  ADD COLUMN "intakeSource" "IntakeSource",
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "intakeCreatedByUserId" TEXT;

ALTER TABLE "medical_events"
  ADD CONSTRAINT "medical_events_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "medical_events_intakeCreatedByUserId_fkey"
    FOREIGN KEY ("intakeCreatedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "medical_events_projectId_idx" ON "medical_events"("projectId");
CREATE INDEX "medical_events_intakeCreatedByUserId_idx" ON "medical_events"("intakeCreatedByUserId");
