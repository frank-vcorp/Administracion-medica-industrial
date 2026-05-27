-- IMPL-20260527-01
-- Ref: context/interconsultas/HANDOFF_ARCH-20260527-12_SOFIA_SLICE-B-RECEPCION-PROJECT.md

CREATE TYPE "ProjectWorkerReceptionStatus" AS ENUM (
  'PENDING',
  'ARRIVED',
  'CHECKED_IN'
);

ALTER TABLE "project_workers"
  ADD COLUMN "receptionStatus" "ProjectWorkerReceptionStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "arrivedAt" TIMESTAMP(3),
  ADD COLUMN "eventId" TEXT;

ALTER TABLE "project_workers"
  ADD CONSTRAINT "project_workers_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "medical_events"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "project_workers_eventId_key" ON "project_workers"("eventId");
CREATE INDEX "project_workers_projectId_receptionStatus_idx" ON "project_workers"("projectId", "receptionStatus");
