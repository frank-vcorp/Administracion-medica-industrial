-- IMPL-20260326-16 | Migración: Modelos IA Prediagnóstico por Estudio
-- Ref: context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md
--
-- Tablas creadas:
--   study_extraction_snapshots  — Snapshot inmutable de extracción estructurada
--   ai_prediagnosis_snapshots   — Snapshot inmutable de prediagnóstico IA
--   doctor_study_reviews        — Revisión médica obligatoria por snapshot
--   clinical_evidence_sources   — Corpus de evidencia clínica controlada
--
-- Columnas añadidas a event_tests:
--   fileUrl, resultNotes
--
-- Variantes añadidas al enum EventTestStatus:
--   IN_PROGRESS, SAMPLE_TAKEN, RESULT_REGISTERED
--
-- NOTA: Esta migración registra el estado ya aplicado a la DB via db push.
-- Se marca como aplicada con: prisma migrate resolve --applied

-- Nuevas variantes del enum EventTestStatus
ALTER TYPE "EventTestStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "EventTestStatus" ADD VALUE IF NOT EXISTS 'SAMPLE_TAKEN';
ALTER TYPE "EventTestStatus" ADD VALUE IF NOT EXISTS 'RESULT_REGISTERED';

-- Nuevas columnas en event_tests
ALTER TABLE "event_tests" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE "event_tests" ADD COLUMN IF NOT EXISTS "resultNotes" TEXT;

-- Tabla: study_extraction_snapshots
CREATE TABLE IF NOT EXISTS "study_extraction_snapshots" (
    "id"                TEXT NOT NULL,
    "eventTestId"       TEXT NOT NULL,
    "version"           INTEGER NOT NULL DEFAULT 1,
    "studyType"         TEXT NOT NULL,
    "sourceFileName"    TEXT,
    "sourceFileUrl"     TEXT,
    "sourceFileHash"    TEXT,
    "structuredData"    JSONB NOT NULL,
    "clinicalState"     TEXT NOT NULL DEFAULT 'DRAFT_EXTRACTED',
    "modelName"         TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "promptVersion"     TEXT NOT NULL DEFAULT 'extract-v2',
    "pipelineVersion"   TEXT NOT NULL DEFAULT 'ai-pipeline-2026-03',
    "triggeredByUserId" TEXT,
    "triggerReason"     TEXT NOT NULL DEFAULT 'initial_upload',
    "isSuperseded"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_extraction_snapshots_pkey" PRIMARY KEY ("id")
);

-- FK: study_extraction_snapshots → event_tests
ALTER TABLE "study_extraction_snapshots"
    ADD CONSTRAINT "study_extraction_snapshots_eventTestId_fkey"
    FOREIGN KEY ("eventTestId") REFERENCES "event_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tabla: ai_prediagnosis_snapshots
CREATE TABLE IF NOT EXISTS "ai_prediagnosis_snapshots" (
    "id"                   TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "version"              INTEGER NOT NULL DEFAULT 1,
    "prediagnosisData"     JSONB NOT NULL,
    "clinicalState"        TEXT NOT NULL DEFAULT 'AI_PENDING_REVIEW',
    "modelName"            TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "promptVersion"        TEXT NOT NULL DEFAULT 'predx-v1',
    "corpusVersion"        TEXT,
    "triggeredByUserId"    TEXT,
    "isSuperseded"         BOOLEAN NOT NULL DEFAULT false,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prediagnosis_snapshots_pkey" PRIMARY KEY ("id")
);

-- FK: ai_prediagnosis_snapshots → study_extraction_snapshots
ALTER TABLE "ai_prediagnosis_snapshots"
    ADD CONSTRAINT "ai_prediagnosis_snapshots_extractionSnapshotId_fkey"
    FOREIGN KEY ("extractionSnapshotId") REFERENCES "study_extraction_snapshots"("id") ON UPDATE CASCADE;

-- Tabla: doctor_study_reviews
CREATE TABLE IF NOT EXISTS "doctor_study_reviews" (
    "id"                     TEXT NOT NULL,
    "prediagnosisSnapshotId" TEXT NOT NULL,
    "doctorStatus"           TEXT NOT NULL,
    "doctorDiagnosis"        TEXT,
    "doctorNotes"            TEXT,
    "reviewedByUserId"       TEXT NOT NULL,
    "aiAgreementScore"       INTEGER,
    "aiUsefulnessScore"      INTEGER,
    "differenceType"         TEXT,
    "errorSeverity"          TEXT NOT NULL DEFAULT 'none',
    "errorCategory"          TEXT,
    "doctorFeedbackNote"     TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_study_reviews_pkey" PRIMARY KEY ("id")
);

-- FK: doctor_study_reviews → ai_prediagnosis_snapshots
ALTER TABLE "doctor_study_reviews"
    ADD CONSTRAINT "doctor_study_reviews_prediagnosisSnapshotId_fkey"
    FOREIGN KEY ("prediagnosisSnapshotId") REFERENCES "ai_prediagnosis_snapshots"("id") ON UPDATE CASCADE;

-- FK: doctor_study_reviews → users
ALTER TABLE "doctor_study_reviews"
    ADD CONSTRAINT "doctor_study_reviews_reviewedByUserId_fkey"
    FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON UPDATE CASCADE;

-- Tabla: clinical_evidence_sources
CREATE TABLE IF NOT EXISTS "clinical_evidence_sources" (
    "id"        TEXT NOT NULL,
    "sourceId"  TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "section"   TEXT,
    "excerpt"   TEXT,
    "version"   TEXT,
    "category"  TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_evidence_sources_pkey" PRIMARY KEY ("id")
);

-- Índice único en clinical_evidence_sources.sourceId
CREATE UNIQUE INDEX IF NOT EXISTS "clinical_evidence_sources_sourceId_key"
    ON "clinical_evidence_sources"("sourceId");
