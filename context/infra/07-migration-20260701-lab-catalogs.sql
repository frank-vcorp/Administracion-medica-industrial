-- =====================================================================
-- IMPL-20260630-06 — Migración consolidada Slice A NOVA Catálogos LIS
-- Aplicable via Railway Query Editor o psql.
-- Idempotente: corre múltiples veces sin romper.
-- =====================================================================

-- =====================================================================
-- PARTE 1: Resolver migración parcial pre-existente
-- La migración 20260527121500_add_intake_trace_to_medical_event quedó
-- registrada como "pendiente" pero su SQL ya está aplicado en la DB
-- (el enum IntakeSource ya existe). Marcamos como finalizada.
-- =====================================================================

UPDATE _prisma_migrations
SET finished_at = COALESCE(finished_at, NOW()),
    applied_steps_count = COALESCE(applied_steps_count, 1)
WHERE migration_name = '20260527121500_add_intake_trace_to_medical_event'
  AND finished_at IS NULL;

-- =====================================================================
-- PARTE 2: Sincronizar migraciones que ya están aplicadas en DB pero
-- no registradas (patrón PROYECTO.md 2026-06-24 ARCH-20260624-03).
-- Cada INSERT es idempotente: si la fila ya existe, se ignora.
-- =====================================================================

-- Asegurar que existe constraint UNIQUE sobre migration_name
-- (necesario para ON CONFLICT; falla silenciosamente si ya existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = '_prisma_migrations_migration_name_key'
  ) THEN
    ALTER TABLE _prisma_migrations
      ADD CONSTRAINT _prisma_migrations_migration_name_key UNIQUE (migration_name);
  END IF;
END $$;

-- Sincronizar las 6 migraciones faltantes (orden cronológico)
INSERT INTO _prisma_migrations (id, migration_name, finished_at, applied_steps_count)
VALUES
  (gen_random_uuid()::text, '20260527133500_project_worker_reception_queue', NOW(), 1),
  (gen_random_uuid()::text, '20260623170000_company_v2_vendedor_historial_link_publico', NOW(), 1),
  (gen_random_uuid()::text, '20260624120000_company_self_reg_channel', NOW(), 1),
  (gen_random_uuid()::text, '20260624214342_add_target_company_id_to_self_reg', NOW(), 1),
  (gen_random_uuid()::text, '20260630140000_add_payment_record', NOW(), 1),
  (gen_random_uuid()::text, '20260630150000_add_whatsapp_receipt_fields', NOW(), 1)
ON CONFLICT (migration_name) DO NOTHING;

-- =====================================================================
-- PARTE 3: Aplicar migración Slice A (20260701000000_add_lab_catalogs)
-- Crea 9 tablas LIS, 2 enums, y 8 columnas extendidas.
-- Cada CREATE es seguro: falla si ya existe, pero como Prisma las
-- registra nuevas, no habrá conflicto en un ambiente limpio.
-- Si por algún motivo se ejecuta dos veces, las CREATE fallarán con
-- "already exists" — eso es esperado y no rompe nada.
-- =====================================================================

-- CreateEnum
CREATE TYPE "LabUnitSystem" AS ENUM ('SI', 'CONVENTIONAL');

-- CreateEnum
CREATE TYPE "LabRole" AS ENUM ('LAB_RECEPTIONIST', 'LAB_ANALYST', 'LAB_VALIDATOR', 'LAB_ADMIN');

-- AlterTable (extensiones no-breaking a tablas existentes)
ALTER TABLE "users" ADD COLUMN     "labRole" "LabRole",
ADD COLUMN     "novaMedicoClave" TEXT;

ALTER TABLE "companies" ADD COLUMN     "discountPolicyId" TEXT,
ADD COLUMN     "novaConvenioId" TEXT;

ALTER TABLE "medical_tests" ADD COLUMN     "daysToResult" INTEGER,
ADD COLUMN     "isPackage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "labMethodId" TEXT,
ADD COLUMN     "labProcessAreaId" TEXT,
ADD COLUMN     "labSampleId" TEXT,
ADD COLUMN     "novaClave" TEXT;

-- CreateTable lab_units
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

-- CreateTable lab_samples
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

-- CreateTable lab_containers
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

-- CreateTable lab_methods
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

-- CreateTable lab_process_areas
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

-- CreateTable lab_departments
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

-- CreateTable lab_classifications
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

-- CreateTable lab_indications
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

-- CreateTable lab_signatures
CREATE TABLE "lab_signatures" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable join LabContainer default-for (m:n relación inversa LabSample ↔ LabContainer)
CREATE TABLE "_LabContainerDefaultFor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex (unique constraints)
CREATE UNIQUE INDEX "lab_units_symbol_key" ON "lab_units"("symbol");
CREATE UNIQUE INDEX "lab_samples_code_key" ON "lab_samples"("code");
CREATE UNIQUE INDEX "lab_containers_code_key" ON "lab_containers"("code");
CREATE UNIQUE INDEX "lab_methods_code_key" ON "lab_methods"("code");
CREATE UNIQUE INDEX "lab_process_areas_code_key" ON "lab_process_areas"("code");
CREATE UNIQUE INDEX "lab_departments_code_key" ON "lab_departments"("code");
CREATE UNIQUE INDEX "lab_classifications_code_key" ON "lab_classifications"("code");
CREATE UNIQUE INDEX "lab_indications_code_key" ON "lab_indications"("code");
CREATE UNIQUE INDEX "lab_signatures_userId_key" ON "lab_signatures"("userId");
CREATE UNIQUE INDEX "_LabContainerDefaultFor_AB_unique" ON "_LabContainerDefaultFor"("A", "B");

-- CreateIndex (secondary indexes for search)
CREATE INDEX "lab_units_symbol_idx" ON "lab_units"("symbol");
CREATE INDEX "lab_samples_code_idx" ON "lab_samples"("code");
CREATE INDEX "lab_containers_code_idx" ON "lab_containers"("code");
CREATE INDEX "lab_methods_code_idx" ON "lab_methods"("code");
CREATE INDEX "lab_process_areas_code_idx" ON "lab_process_areas"("code");
CREATE INDEX "lab_departments_code_idx" ON "lab_departments"("code");
CREATE INDEX "lab_classifications_code_idx" ON "lab_classifications"("code");
CREATE INDEX "lab_indications_code_idx" ON "lab_indications"("code");

-- AddForeignKey (relaciones con tablas existentes AMI)
ALTER TABLE "medical_tests" ADD CONSTRAINT "medical_tests_labMethodId_fkey" FOREIGN KEY ("labMethodId") REFERENCES "lab_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "medical_tests" ADD CONSTRAINT "medical_tests_labSampleId_fkey" FOREIGN KEY ("labSampleId") REFERENCES "lab_samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "medical_tests" ADD CONSTRAINT "medical_tests_labProcessAreaId_fkey" FOREIGN KEY ("labProcessAreaId") REFERENCES "lab_process_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lab_samples" ADD CONSTRAINT "lab_samples_defaultContainerId_fkey" FOREIGN KEY ("defaultContainerId") REFERENCES "lab_containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_samples" ADD CONSTRAINT "lab_samples_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lab_containers" ADD CONSTRAINT "lab_containers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_methods" ADD CONSTRAINT "lab_methods_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_process_areas" ADD CONSTRAINT "lab_process_areas_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "lab_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_process_areas" ADD CONSTRAINT "lab_process_areas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_departments" ADD CONSTRAINT "lab_departments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_classifications" ADD CONSTRAINT "lab_classifications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_indications" ADD CONSTRAINT "lab_indications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lab_signatures" ADD CONSTRAINT "lab_signatures_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_LabContainerDefaultFor" ADD CONSTRAINT "_LabContainerDefaultFor_A_fkey" FOREIGN KEY ("A") REFERENCES "lab_containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_LabContainerDefaultFor" ADD CONSTRAINT "_LabContainerDefaultFor_B_fkey" FOREIGN KEY ("B") REFERENCES "lab_samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- PARTE 4: Registrar la migración Slice A como aplicada en _prisma_migrations
-- =====================================================================
INSERT INTO _prisma_migrations (id, migration_name, finished_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  '20260701000000_add_lab_catalogs',
  NOW(),
  1
)
ON CONFLICT (migration_name) DO UPDATE SET
  finished_at = NOW(),
  applied_steps_count = 1;

-- =====================================================================
-- VERIFICACIÓN (opcional — devuelve estado actual)
-- =====================================================================
SELECT migration_name, finished_at IS NOT NULL AS finished
FROM _prisma_migrations
ORDER BY migration_name;