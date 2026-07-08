-- ============================================================================
-- IMPL-20260708-19: Fase 3 NOVA absorción (ARCH-20260707-17) — G Caja y Cortesías
-- Ref: context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 3)
--
-- 2 modelos nuevos:
--   * lab_cash_movements — pagos parciales por LabOrder (append-only)
--   * courtesies        — marca única de orden como cortesía (cargo 0)
-- 1 enum nuevo:
--   * PaymentMethod      — CASH | CARD | TRANSFER | CHECK | OTHER
-- ============================================================================

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'CHECK', 'OTHER');

-- CreateTable: lab_cash_movements
CREATE TABLE "lab_cash_movements" (
    "id" TEXT NOT NULL,
    "labOrderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: courtesies
CREATE TABLE "courtesies" (
    "id" TEXT NOT NULL,
    "labOrderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courtesies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_cash_movements_labOrderId_idx" ON "lab_cash_movements"("labOrderId");
CREATE INDEX "lab_cash_movements_createdAt_idx" ON "lab_cash_movements"("createdAt");
CREATE INDEX "lab_cash_movements_method_idx" ON "lab_cash_movements"("method");
CREATE UNIQUE INDEX "courtesies_labOrderId_key" ON "courtesies"("labOrderId");

-- AddForeignKey: lab_cash_movements → lab_orders
ALTER TABLE "lab_cash_movements" ADD CONSTRAINT "lab_cash_movements_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: lab_cash_movements → users
ALTER TABLE "lab_cash_movements" ADD CONSTRAINT "lab_cash_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: courtesies → lab_orders
ALTER TABLE "courtesies" ADD CONSTRAINT "courtesies_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: courtesies → users
ALTER TABLE "courtesies" ADD CONSTRAINT "courtesies_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;