-- IMPL-20260630-01 — Ref: context/SPECs/SPEC_ARCH-20260630-01-MODAL-PAGO-RECIBO-PAPELETA.md
-- Crea tabla payment_records para trazabilidad contable de pagos por papeleta.
-- Tabla append-only: no se borra, no se sobrescribe.

CREATE TABLE "payment_records" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amount" DECIMAL(10, 2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "receiptSent" BOOLEAN NOT NULL DEFAULT false,
    "receiptEmail" TEXT,
    "receiptPdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "payment_records"
    ADD CONSTRAINT "payment_records_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_records"
    ADD CONSTRAINT "payment_records_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "payment_records_eventId_idx" ON "payment_records"("eventId");
CREATE INDEX "payment_records_workerId_idx" ON "payment_records"("workerId");