-- SME-18 / S8-05: dictamen de salud para el paciente (PDF firmado separado del empleador)
ALTER TABLE "medical_verdicts" ADD COLUMN IF NOT EXISTS "patientPdfUrl" TEXT;
