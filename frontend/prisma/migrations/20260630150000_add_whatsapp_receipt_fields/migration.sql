-- IMPL-20260630-02 — ARCH-20260630-02: Campos WhatsApp para recibo de pago
-- Agrega soporte de envío por WhatsApp Web y link de descarga temporal

ALTER TABLE "payment_records"
    ADD COLUMN "receiptWhatsAppSent" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "receiptWhatsAppPhone" TEXT,
    ADD COLUMN "receiptWhatsAppAt" TIMESTAMP(3),
    ADD COLUMN "receiptDownloadUrl" TEXT,
    ADD COLUMN "receiptDownloadExpires" TIMESTAMP(3);

-- Índice opcional para consultas por teléfono WhatsApp
CREATE INDEX "payment_records_receiptWhatsAppPhone_idx" ON "payment_records"("receiptWhatsAppPhone");