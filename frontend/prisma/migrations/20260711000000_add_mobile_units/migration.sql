-- IMPL-20260711-01 — Módulo de Unidades Móviles (ARCH-20260711-01)
-- Ref: context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
--
-- Crea el catálogo de unidades móviles de AMI (6 trailers/vehículos equipados
-- como clínicas móviles) y el historial de mantenimientos, más columnas de
-- trazabilidad en projects / medical_events / lab_orders.

-- ============================================================================
-- 1) Enums
-- ============================================================================
CREATE TYPE "MobileUnitStatus" AS ENUM ('ACTIVA', 'MANTENIMIENTO', 'REPARACION', 'FUERA_SERVICIO', 'BAJA_PERMANENTE');
CREATE TYPE "MaintenanceType"     AS ENUM ('PREVENTIVO', 'CORRECTIVO', 'VERIFICACION', 'LIMPIEZA');
CREATE TYPE "MaintenanceStatus"   AS ENUM ('PROGRAMADO', 'COMPLETADO', 'CANCELADO', 'REPROGRAMADO');

-- ============================================================================
-- 2) Tabla mobile_units
-- ============================================================================
CREATE TABLE "mobile_units" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "plate"          TEXT,
    "vin"            TEXT,
    "year"           INTEGER,
    "capacity"       INTEGER,
    "economicNumber" TEXT,
    "imageUrl"       TEXT,
    "status"         "MobileUnitStatus" NOT NULL DEFAULT 'ACTIVA',
    "equipment"      JSONB,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mobile_units_pkey" PRIMARY KEY ("id")
);

-- Unicidad de nombre (case-sensitive)
CREATE UNIQUE INDEX "mobile_units_name_key" ON "mobile_units"("name");

-- ============================================================================
-- 3) Tabla maintenance_records
-- ============================================================================
CREATE TABLE "maintenance_records" (
    "id"            TEXT NOT NULL,
    "mobileUnitId"  TEXT NOT NULL,
    "type"          "MaintenanceType" NOT NULL,
    "status"        "MaintenanceStatus" NOT NULL DEFAULT 'PROGRAMADO',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "rescheduledTo" TIMESTAMP(3),
    "description"   TEXT NOT NULL,
    "technician"    TEXT,
    "cost"          DECIMAL(65,30),
    "nextDueDate"   TIMESTAMP(3),
    "attachments"   JSONB,
    "createdBy"     TEXT NOT NULL,
    "completedBy"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "maintenance_records_mobileUnitId_idx" ON "maintenance_records"("mobileUnitId");
CREATE INDEX "maintenance_records_scheduledDate_idx" ON "maintenance_records"("scheduledDate");
CREATE INDEX "maintenance_records_status_idx" ON "maintenance_records"("status");

-- ============================================================================
-- 4) Columnas de trazabilidad en modelos existentes
-- ============================================================================
ALTER TABLE "projects"        ADD COLUMN "mobileUnitId" TEXT;
ALTER TABLE "medical_events"  ADD COLUMN "mobileUnitId" TEXT;
ALTER TABLE "lab_orders"      ADD COLUMN "mobileUnitId" TEXT;

CREATE INDEX "projects_mobileUnitId_idx"       ON "projects"("mobileUnitId");
CREATE INDEX "projects_startDate_idx"          ON "projects"("startDate");
CREATE INDEX "projects_endDate_idx"            ON "projects"("endDate");
CREATE INDEX "medical_events_mobileUnitId_idx" ON "medical_events"("mobileUnitId");
CREATE INDEX "lab_orders_mobileUnitId_idx"     ON "lab_orders"("mobileUnitId");

-- ============================================================================
-- 5) Foreign keys
-- ============================================================================
-- maintenance_records: cascade con la unidad, restrict con el usuario (auditoría)
ALTER TABLE "maintenance_records"
    ADD CONSTRAINT "maintenance_records_mobileUnitId_fkey"
        FOREIGN KEY ("mobileUnitId") REFERENCES "mobile_units"("id") ON DELETE CASCADE;

ALTER TABLE "maintenance_records"
    ADD CONSTRAINT "maintenance_records_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "users"("id");

-- Trazabilidad en proyectos / eventos / lab_orders: SET NULL al eliminar unidad
ALTER TABLE "projects"
    ADD CONSTRAINT "projects_mobileUnitId_fkey"
        FOREIGN KEY ("mobileUnitId") REFERENCES "mobile_units"("id") ON DELETE SET NULL;

ALTER TABLE "medical_events"
    ADD CONSTRAINT "medical_events_mobileUnitId_fkey"
        FOREIGN KEY ("mobileUnitId") REFERENCES "mobile_units"("id") ON DELETE SET NULL;

ALTER TABLE "lab_orders"
    ADD CONSTRAINT "lab_orders_mobileUnitId_fkey"
        FOREIGN KEY ("mobileUnitId") REFERENCES "mobile_units"("id") ON DELETE SET NULL;
