-- Salida de paciente en recepción (checkout post-cierre clínico)
ALTER TABLE "medical_events" ADD COLUMN "dischargedAt" TIMESTAMP(3);
ALTER TABLE "medical_events" ADD COLUMN "dischargedByUserId" TEXT;

ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_dischargedByUserId_fkey"
  FOREIGN KEY ("dischargedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "medical_events_dischargedAt_idx" ON "medical_events"("dischargedAt");
