-- AlterTable
ALTER TABLE "study_extraction_snapshots" ADD COLUMN     "calibrationVersionId" TEXT,
ADD COLUMN     "calibrationVersionNumber" INTEGER,
ADD COLUMN     "extractionPromptHash" TEXT,
ADD COLUMN     "presentationSchemaSnapshot" JSONB;

-- AlterTable
ALTER TABLE "ai_prediagnosis_snapshots" ADD COLUMN     "calibrationVersionId" TEXT,
ADD COLUMN     "calibrationVersionNumber" INTEGER,
ADD COLUMN     "clinicalCriteriaHash" TEXT,
ADD COLUMN     "clinicalPromptHash" TEXT;

