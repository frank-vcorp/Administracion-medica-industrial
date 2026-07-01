-- CreateEnum
CREATE TYPE "LabUnitSystem" AS ENUM ('SI', 'CONVENTIONAL');

-- CreateEnum
CREATE TYPE "LabRole" AS ENUM ('LAB_RECEPTIONIST', 'LAB_ANALYST', 'LAB_VALIDATOR', 'LAB_ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "labRole" "LabRole",
ADD COLUMN     "novaMedicoClave" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "discountPolicyId" TEXT,
ADD COLUMN     "novaConvenioId" TEXT;

-- AlterTable
ALTER TABLE "medical_tests" ADD COLUMN     "daysToResult" INTEGER,
ADD COLUMN     "isPackage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "labMethodId" TEXT,
ADD COLUMN     "labProcessAreaId" TEXT,
ADD COLUMN     "labSampleId" TEXT,
ADD COLUMN     "novaClave" TEXT;

-- CreateTable
CREATE TABLE "lab_units" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" "LabUnitSystem" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "lab_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_samples" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultContainerId" TEXT,
    "preservation" TEXT,
    "minVolume" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "lab_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_containers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "cap" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "lab_containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_methods" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "principle" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "lab_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_process_areas" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "lab_process_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "lab_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_classifications" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "lab_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_indications" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "lab_indications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_signatures" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LabContainerDefaultFor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "lab_units_symbol_key" ON "lab_units"("symbol");

-- CreateIndex
CREATE INDEX "lab_units_symbol_idx" ON "lab_units"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "lab_samples_code_key" ON "lab_samples"("code");

-- CreateIndex
CREATE INDEX "lab_samples_code_idx" ON "lab_samples"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lab_containers_code_key" ON "lab_containers"("code");

-- CreateIndex
CREATE INDEX "lab_containers_code_idx" ON "lab_containers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lab_methods_code_key" ON "lab_methods"("code");

-- CreateIndex
CREATE INDEX "lab_methods_code_idx" ON "lab_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lab_process_areas_code_key" ON "lab_process_areas"("code");

-- CreateIndex
CREATE INDEX "lab_process_areas_code_idx" ON "lab_process_areas"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lab_departments_code_key" ON "lab_departments"("code");

-- CreateIndex
CREATE INDEX "lab_departments_code_idx" ON "lab_departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lab_classifications_code_key" ON "lab_classifications"("code");

-- CreateIndex
CREATE INDEX "lab_classifications_code_idx" ON "lab_classifications"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lab_indications_code_key" ON "lab_indications"("code");

-- CreateIndex
CREATE INDEX "lab_indications_code_idx" ON "lab_indications"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lab_signatures_userId_key" ON "lab_signatures"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "_LabContainerDefaultFor_AB_unique" ON "_LabContainerDefaultFor"("A", "B");

-- CreateIndex
CREATE INDEX "_LabContainerDefaultFor_B_index" ON "_LabContainerDefaultFor"("B");

-- CreateIndex
CREATE UNIQUE INDEX "users_novaMedicoClave_key" ON "users"("novaMedicoClave");

-- CreateIndex
CREATE UNIQUE INDEX "medical_tests_novaClave_key" ON "medical_tests"("novaClave");

-- AddForeignKey
ALTER TABLE "medical_tests" ADD CONSTRAINT "medical_tests_labMethodId_fkey" FOREIGN KEY ("labMethodId") REFERENCES "lab_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_tests" ADD CONSTRAINT "medical_tests_labSampleId_fkey" FOREIGN KEY ("labSampleId") REFERENCES "lab_samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_tests" ADD CONSTRAINT "medical_tests_labProcessAreaId_fkey" FOREIGN KEY ("labProcessAreaId") REFERENCES "lab_process_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_units" ADD CONSTRAINT "lab_units_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_samples" ADD CONSTRAINT "lab_samples_defaultContainerId_fkey" FOREIGN KEY ("defaultContainerId") REFERENCES "lab_containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_samples" ADD CONSTRAINT "lab_samples_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_containers" ADD CONSTRAINT "lab_containers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_methods" ADD CONSTRAINT "lab_methods_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_process_areas" ADD CONSTRAINT "lab_process_areas_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "lab_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_process_areas" ADD CONSTRAINT "lab_process_areas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_departments" ADD CONSTRAINT "lab_departments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_classifications" ADD CONSTRAINT "lab_classifications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_indications" ADD CONSTRAINT "lab_indications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_signatures" ADD CONSTRAINT "lab_signatures_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LabContainerDefaultFor" ADD CONSTRAINT "_LabContainerDefaultFor_A_fkey" FOREIGN KEY ("A") REFERENCES "lab_containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LabContainerDefaultFor" ADD CONSTRAINT "_LabContainerDefaultFor_B_fkey" FOREIGN KEY ("B") REFERENCES "lab_samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

