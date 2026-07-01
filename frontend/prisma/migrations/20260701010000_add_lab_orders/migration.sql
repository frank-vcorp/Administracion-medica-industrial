-- ============================================================================
-- IMPL-20260701-03: Slice B NOVA absorción — admisión LabOrder + LabOrderItem
-- Ref: context/SPECs/SPEC_IMPL-20260701-SLICE-B-RECEPCION.md
--
-- Migración filtrada manualmente desde `prisma migrate diff` para incluir
-- SOLO los cambios del Slice B (3 enums + 2 modelos + 8 FKs + índices).
-- Se descartan ALTERs espurios detectados por drift en el shadow DB
-- (appointments, company_self_registrations, projects, etc.) que no son
-- scope de este slice.
-- ============================================================================

-- CreateEnum: estado del ciclo de vida
CREATE TYPE "LabOrderStatus" AS ENUM ('DRAFT', 'SAVED', 'SAMPLE_TAKEN', 'IN_PROCESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum: urgencia clínica
CREATE TYPE "LabOrderUrgency" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum: nivel de confidencialidad
CREATE TYPE "LabOrderConfidentiality" AS ENUM ('NORMAL', 'CONFIDENTIAL');

-- CreateTable: lab_orders
CREATE TABLE "lab_orders" (
    "id" TEXT NOT NULL,
    "folio" INTEGER NOT NULL,
    "novaFolio" TEXT,
    "branch" TEXT NOT NULL DEFAULT 'MATRIZ',
    "workerId" TEXT NOT NULL,
    "medicalEventId" TEXT,
    "companyId" TEXT,
    "classificationId" TEXT,
    "doctorName" TEXT NOT NULL,
    "doctorClave" TEXT,
    "patientDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "doctorDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "doctorCommissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "companyDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "urgency" "LabOrderUrgency" NOT NULL DEFAULT 'NORMAL',
    "confidentiality" "LabOrderConfidentiality" NOT NULL DEFAULT 'NORMAL',
    "homeSample" BOOLEAN NOT NULL DEFAULT false,
    "sendResultsByEmail" BOOLEAN NOT NULL DEFAULT false,
    "generateInvoice" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'es',
    "deliveryDate" TIMESTAMP(3),
    "deliveryTime" TEXT,
    "status" "LabOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "isCourtesy" BOOLEAN NOT NULL DEFAULT false,
    "courtesyType" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ivaPct" DOUBLE PRECISION NOT NULL DEFAULT 16,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lab_order_items
CREATE TABLE "lab_order_items" (
    "id" TEXT NOT NULL,
    "labOrderId" TEXT NOT NULL,
    "medicalTestId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resultStatus" TEXT NOT NULL DEFAULT 'P',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lab_orders_folio_key" ON "lab_orders"("folio");
CREATE UNIQUE INDEX "lab_orders_novaFolio_key" ON "lab_orders"("novaFolio");
CREATE INDEX "lab_orders_workerId_idx" ON "lab_orders"("workerId");
CREATE INDEX "lab_orders_medicalEventId_idx" ON "lab_orders"("medicalEventId");
CREATE INDEX "lab_orders_companyId_idx" ON "lab_orders"("companyId");
CREATE INDEX "lab_orders_status_idx" ON "lab_orders"("status");
CREATE INDEX "lab_orders_createdAt_idx" ON "lab_orders"("createdAt");
CREATE INDEX "lab_orders_folio_idx" ON "lab_orders"("folio");
CREATE INDEX "lab_order_items_labOrderId_idx" ON "lab_order_items"("labOrderId");
CREATE INDEX "lab_order_items_medicalTestId_idx" ON "lab_order_items"("medicalTestId");
CREATE INDEX "lab_order_items_resultStatus_idx" ON "lab_order_items"("resultStatus");

-- AddForeignKey: lab_orders
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_medicalEventId_fkey" FOREIGN KEY ("medicalEventId") REFERENCES "medical_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "lab_classifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: lab_order_items
ALTER TABLE "lab_order_items" ADD CONSTRAINT "lab_order_items_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_order_items" ADD CONSTRAINT "lab_order_items_medicalTestId_fkey" FOREIGN KEY ("medicalTestId") REFERENCES "medical_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
