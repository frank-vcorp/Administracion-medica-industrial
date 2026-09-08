-- Consentimiento informado firmado en check-in (R-09)
ALTER TABLE "appointments" ADD COLUMN "informedConsentPdfUrl" TEXT;
ALTER TABLE "appointments" ADD COLUMN "informedConsentSignedAt" TIMESTAMP(3);

ALTER TABLE "workers" ADD COLUMN "lastInformedConsentPdfUrl" TEXT;
ALTER TABLE "workers" ADD COLUMN "lastInformedConsentSignedAt" TIMESTAMP(3);
