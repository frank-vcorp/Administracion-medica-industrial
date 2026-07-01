-- IMPL-20260630-03: Add ProjectReport model (ARCH-20260623-01)
-- Migración aditiva — no modifica modelos existentes.

CREATE TABLE "project_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileUrlXlsx" TEXT,
    "fileUrlPdf" TEXT,
    "errorMessage" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "project_reports_pkey" PRIMARY KEY ("id")
);

-- Indices
CREATE INDEX "project_reports_projectId_idx" ON "project_reports"("projectId");
CREATE INDEX "project_reports_status_idx" ON "project_reports"("status");

-- Foreign keys
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_generatedById_fkey"
    FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;