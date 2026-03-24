-- ARCH-20260324-10
-- Respaldo: context/checkpoints/CHK_FIX-20260306-03-FULL-REVIEW.md

-- CreateEnum
CREATE TYPE "GenderRestriction" AS ENUM ('ALL', 'MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "EventTestStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED');

-- DropIndex
DROP INDEX IF EXISTS "users_companyId_idx";

-- AlterTable
ALTER TABLE "branches"
ADD COLUMN IF NOT EXISTS "closingTime" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN IF NOT EXISTS "hourlyCapacity" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS "managerName" TEXT,
ADD COLUMN IF NOT EXISTS "openingTime" TEXT NOT NULL DEFAULT '07:00',
ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- AlterTable
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "contactName" TEXT,
ADD COLUMN IF NOT EXISTS "defaultBranchId" TEXT,
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- AlterTable
ALTER TABLE "medical_events"
ADD COLUMN IF NOT EXISTS "appointmentId" TEXT,
ADD COLUMN IF NOT EXISTS "billingCompanyId" TEXT;

-- AlterTable
ALTER TABLE "medical_exams"
ADD COLUMN IF NOT EXISTS "eyeAcuityData" JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "physicalExamData" JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "somatometryData" JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "vitalSignsData" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "workers"
ADD COLUMN IF NOT EXISTS "branchId" TEXT,
ADD COLUMN IF NOT EXISTS "jobPositionId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "clinical_histories" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "test_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "medical_tests" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "targetGender" "GenderRestriction" NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "medical_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "profile_tests" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,

    CONSTRAINT "profile_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "event_tests" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "testId" TEXT,
    "testNameSnapshot" TEXT NOT NULL,
    "selectedOption" TEXT,
    "status" "EventTestStatus" NOT NULL DEFAULT 'PENDING',
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expedientId" TEXT,
    "qrCode" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SUCURSAL',
    "serviceProfileId" TEXT,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "defaultProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "clinical_histories_workerId_key" ON "clinical_histories"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "medical_tests_code_key" ON "medical_tests"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "profile_tests_profileId_testId_key" ON "profile_tests"("profileId", "testId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_expedientId_key" ON "appointments"("expedientId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "medical_events_appointmentId_key" ON "medical_events"("appointmentId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_defaultBranchId_fkey') THEN
        ALTER TABLE "companies" ADD CONSTRAINT "companies_defaultBranchId_fkey" FOREIGN KEY ("defaultBranchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workers_branchId_fkey') THEN
        ALTER TABLE "workers" ADD CONSTRAINT "workers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workers_jobPositionId_fkey') THEN
        ALTER TABLE "workers" ADD CONSTRAINT "workers_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "job_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinical_histories_workerId_fkey') THEN
        ALTER TABLE "clinical_histories" ADD CONSTRAINT "clinical_histories_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_tests_categoryId_fkey') THEN
        ALTER TABLE "medical_tests" ADD CONSTRAINT "medical_tests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "test_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_profiles_companyId_fkey') THEN
        ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profile_tests_profileId_fkey') THEN
        ALTER TABLE "profile_tests" ADD CONSTRAINT "profile_tests_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "medical_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profile_tests_testId_fkey') THEN
        ALTER TABLE "profile_tests" ADD CONSTRAINT "profile_tests_testId_fkey" FOREIGN KEY ("testId") REFERENCES "medical_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_tests_eventId_fkey') THEN
        ALTER TABLE "event_tests" ADD CONSTRAINT "event_tests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_tests_performedById_fkey') THEN
        ALTER TABLE "event_tests" ADD CONSTRAINT "event_tests_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_tests_testId_fkey') THEN
        ALTER TABLE "event_tests" ADD CONSTRAINT "event_tests_testId_fkey" FOREIGN KEY ("testId") REFERENCES "medical_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_events_appointmentId_fkey') THEN
        ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'medical_events_billingCompanyId_fkey') THEN
        ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_billingCompanyId_fkey" FOREIGN KEY ("billingCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_branchId_fkey') THEN
        ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_companyId_fkey') THEN
        ALTER TABLE "appointments" ADD CONSTRAINT "appointments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_serviceProfileId_fkey') THEN
        ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceProfileId_fkey" FOREIGN KEY ("serviceProfileId") REFERENCES "medical_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_workerId_fkey') THEN
        ALTER TABLE "appointments" ADD CONSTRAINT "appointments_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_userId_fkey') THEN
        ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_positions_companyId_fkey') THEN
        ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_positions_defaultProfileId_fkey') THEN
        ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_defaultProfileId_fkey" FOREIGN KEY ("defaultProfileId") REFERENCES "medical_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;