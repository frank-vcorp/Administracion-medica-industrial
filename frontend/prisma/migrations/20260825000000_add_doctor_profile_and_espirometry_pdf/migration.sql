-- IMPL-FEATURE-20260825-01 — Perfil médico (cédula/firma) + PDF validado de
-- Espirometría. Migración aditiva y nullable: filas existentes se mantienen
-- tal cual; las nuevas columnas son NULL hasta que el médico complete su
-- perfil y/o emita una revisión que genere PDF.
--
-- No se modifican tablas ajenas, no se borran datos, no se cambian
-- restricciones. Rollback = DROP COLUMN de las 9 columnas listadas.

ALTER TABLE "users" ADD COLUMN "professionalLicense" TEXT;
ALTER TABLE "users" ADD COLUMN "signatureImageUrl"   TEXT;

ALTER TABLE "doctor_study_reviews" ADD COLUMN "validatorSnapshotFullName"            TEXT;
ALTER TABLE "doctor_study_reviews" ADD COLUMN "validatorSnapshotProfessionalLicense" TEXT;
ALTER TABLE "doctor_study_reviews" ADD COLUMN "validatorSnapshotSignatureUrl"        TEXT;
ALTER TABLE "doctor_study_reviews" ADD COLUMN "validatedPdfUrl"        TEXT;
ALTER TABLE "doctor_study_reviews" ADD COLUMN "validatedPdfGeneratedAt" TIMESTAMP(3);
ALTER TABLE "doctor_study_reviews" ADD COLUMN "validatedPdfHash"       TEXT;
ALTER TABLE "doctor_study_reviews" ADD COLUMN "validatedPdfError"      TEXT;
