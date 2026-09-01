-- Perfil médico directo en Worker (sustituye puesto de trabajo en alta de paciente).
ALTER TABLE "workers" ADD COLUMN "medicalProfileId" TEXT;

ALTER TABLE "workers" ADD CONSTRAINT "workers_medicalProfileId_fkey"
  FOREIGN KEY ("medicalProfileId") REFERENCES "medical_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: perfil default del puesto legacy → medicalProfileId
UPDATE "workers" w
SET "medicalProfileId" = jp."defaultProfileId"
FROM "job_positions" jp
WHERE w."jobPositionId" = jp."id"
  AND jp."defaultProfileId" IS NOT NULL
  AND w."medicalProfileId" IS NULL;
