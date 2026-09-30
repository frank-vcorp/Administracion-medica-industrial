-- DEC-20260930-01: auditoría envío parcial de resultados (laboratorio)
CREATE TABLE "result_delivery_logs" (
    "id" TEXT NOT NULL,
    "medicalEventId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'PARTIAL_LAB',
    "eventTestIds" JSONB NOT NULL,
    "recipientEmails" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentByUserId" TEXT,

    CONSTRAINT "result_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "result_delivery_logs_medicalEventId_sentAt_idx" ON "result_delivery_logs"("medicalEventId", "sentAt");

ALTER TABLE "result_delivery_logs" ADD CONSTRAINT "result_delivery_logs_medicalEventId_fkey" FOREIGN KEY ("medicalEventId") REFERENCES "medical_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "result_delivery_logs" ADD CONSTRAINT "result_delivery_logs_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
