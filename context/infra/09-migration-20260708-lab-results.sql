-- ============================================================================
-- IMPL-20260707-16: Slice C NOVA absorción — LabResult + ciclo de vida
-- Ref: context/SPECs/SPEC_IMPL-20260707-SLICE-C-RESULTADOS.md
--
-- 3 enums + 4 modelos nuevos + back-relations + eventTestId en LabOrderItem.
-- ============================================================================

-- CreateEnum: estado del ciclo de vida de un LabResult
CREATE TYPE "LabResultStatus" AS ENUM ('PENDING', 'REPORTED', 'AUTHORIZED', 'VALIDATED', 'INVALIDATED');

-- CreateEnum: tipo de dato del analito
CREATE TYPE "LabAnalyteDataType" AS ENUM ('NUMERIC', 'TEXT', 'ENUM');

-- CreateEnum: sexo aplicable al rango (A = ambos)
CREATE TYPE "LabSex" AS ENUM ('M', 'F', 'A');

-- CreateTable: lab_analytes
CREATE TABLE "lab_analytes" (
    "id" TEXT NOT NULL,
    "medicalTestId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "dataType" "LabAnalyteDataType" NOT NULL DEFAULT 'NUMERIC',
    "defaultUnitId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_analytes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lab_reference_ranges
CREATE TABLE "lab_reference_ranges" (
    "id" TEXT NOT NULL,
    "analyteId" TEXT NOT NULL,
    "sex" "LabSex" NOT NULL,
    "ageMinMonths" INTEGER,
    "ageMaxMonths" INTEGER,
    "valueMin" DOUBLE PRECISION,
    "valueMax" DOUBLE PRECISION,
    "textValue" TEXT,
    "unitId" TEXT,
    "criticalLow" DOUBLE PRECISION,
    "criticalHigh" DOUBLE PRECISION,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_reference_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lab_results
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "labOrderItemId" TEXT NOT NULL,
    "analyteId" TEXT NOT NULL,
    "eventTestId" TEXT,
    "valueText" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "unitId" TEXT,
    "status" "LabResultStatus" NOT NULL DEFAULT 'PENDING',
    "capturedById" TEXT,
    "capturedAt" TIMESTAMP(3),
    "reportedById" TEXT,
    "reportedAt" TIMESTAMP(3),
    "authorizedById" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "invalidatedById" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "invalidateReason" TEXT,
    "isOutOfRange" BOOLEAN NOT NULL DEFAULT false,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lab_result_audits
CREATE TABLE "lab_result_audits" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "LabResultStatus",
    "toStatus" "LabResultStatus",
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_result_audits_pkey" PRIMARY KEY ("id")
);

-- AlterTable: lab_order_items (nueva columna eventTestId)
ALTER TABLE "lab_order_items" ADD COLUMN "eventTestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "lab_analytes_medicalTestId_code_key" ON "lab_analytes"("medicalTestId", "code");
CREATE INDEX "lab_analytes_medicalTestId_idx" ON "lab_analytes"("medicalTestId");
CREATE INDEX "lab_reference_ranges_analyteId_sex_ageMinMonths_ageMaxMonths_idx" ON "lab_reference_ranges"("analyteId", "sex", "ageMinMonths", "ageMaxMonths");
CREATE UNIQUE INDEX "lab_results_labOrderItemId_analyteId_key" ON "lab_results"("labOrderItemId", "analyteId");
CREATE INDEX "lab_results_analyteId_idx" ON "lab_results"("analyteId");
CREATE INDEX "lab_results_status_idx" ON "lab_results"("status");
CREATE INDEX "lab_results_eventTestId_idx" ON "lab_results"("eventTestId");
CREATE INDEX "lab_result_audits_resultId_createdAt_idx" ON "lab_result_audits"("resultId", "createdAt");

-- AddForeignKey: lab_analytes
ALTER TABLE "lab_analytes" ADD CONSTRAINT "lab_analytes_medicalTestId_fkey" FOREIGN KEY ("medicalTestId") REFERENCES "medical_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_analytes" ADD CONSTRAINT "lab_analytes_defaultUnitId_fkey" FOREIGN KEY ("defaultUnitId") REFERENCES "lab_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: lab_reference_ranges
ALTER TABLE "lab_reference_ranges" ADD CONSTRAINT "lab_reference_ranges_analyteId_fkey" FOREIGN KEY ("analyteId") REFERENCES "lab_analytes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_reference_ranges" ADD CONSTRAINT "lab_reference_ranges_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "lab_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: lab_results
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_labOrderItemId_fkey" FOREIGN KEY ("labOrderItemId") REFERENCES "lab_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_analyteId_fkey" FOREIGN KEY ("analyteId") REFERENCES "lab_analytes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_eventTestId_fkey" FOREIGN KEY ("eventTestId") REFERENCES "event_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "lab_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_invalidatedById_fkey" FOREIGN KEY ("invalidatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: lab_result_audits
ALTER TABLE "lab_result_audits" ADD CONSTRAINT "lab_result_audits_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "lab_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_result_audits" ADD CONSTRAINT "lab_result_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: lab_order_items.eventTestId
ALTER TABLE "lab_order_items" ADD CONSTRAINT "lab_order_items_eventTestId_fkey" FOREIGN KEY ("eventTestId") REFERENCES "event_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- ============================================================================
-- Registrar Slice C como aplicada en _prisma_migrations (idempotente)
-- ============================================================================
INSERT INTO _prisma_migrations (id, migration_name, checksum, finished_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  '20260707120000_add_lab_results',
  md5('20260707120000_add_lab_results') || md5('20260707120000_add_lab_results'),
  NOW(),
  1
)
ON CONFLICT (migration_name) DO UPDATE SET
  finished_at = NOW(),
  applied_steps_count = 1;

-- Verificación
SELECT migration_name, finished_at IS NOT NULL AS finished
FROM _prisma_migrations
WHERE migration_name = '20260707120000_add_lab_results';
