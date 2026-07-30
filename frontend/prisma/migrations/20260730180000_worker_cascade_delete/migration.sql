-- FIX-20260730-06: Cambiar FKs hacia Worker de Restrict → Cascade
-- para permitir hard delete de pacientes con todo su historial.
-- Ref: context/SPECs/SPEC_FIX-20260730-06-DELETE-WORKERS-SUPERADMIN.md
--
-- Esta migración cambia 14 FKs:
--   1-5.  FKs directas hacia Worker (Appointment, ClinicalHistory, MedicalEvent,
--         ProjectWorker, LabOrder)
--   6.    PrefilledInvitation.appointmentId (transitivo desde Appointment)
--   7-11. MedicalEvent → EventTest, LabRecord, StudyRecord, MedicalExam, MedicalVerdict
--   12.   StudyExtractionSnapshot ya Cascade (no requiere ALTER)
--   13.   StudyExtractionSnapshot → AIPrediagnosisSnapshot
--   14.   AIPrediagnosisSnapshot → DoctorStudyReview

-- =====================================================================
-- 1. Appointment.workerId → Cascade
-- =====================================================================
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_workerId_fkey";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE;

-- =====================================================================
-- 2. ClinicalHistory.workerId → Cascade
-- =====================================================================
ALTER TABLE "clinical_histories" DROP CONSTRAINT "clinical_histories_workerId_fkey";
ALTER TABLE "clinical_histories" ADD CONSTRAINT "clinical_histories_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE;

-- =====================================================================
-- 3. MedicalEvent.workerId → Cascade
-- =====================================================================
ALTER TABLE "medical_events" DROP CONSTRAINT "medical_events_workerId_fkey";
ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE;

-- =====================================================================
-- 4. ProjectWorker.workerId → Cascade
-- =====================================================================
ALTER TABLE "project_workers" DROP CONSTRAINT "project_workers_workerId_fkey";
ALTER TABLE "project_workers" ADD CONSTRAINT "project_workers_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE;

-- =====================================================================
-- 5. LabOrder.workerId → Cascade (era Restrict explícito)
-- =====================================================================
ALTER TABLE "lab_orders" DROP CONSTRAINT "lab_orders_workerId_fkey";
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE;

-- =====================================================================
-- 6. PrefilledInvitation.appointmentId → Cascade (transitivo)
-- =====================================================================
ALTER TABLE "prefilled_invitations" DROP CONSTRAINT "prefilled_invitations_appointmentId_fkey";
ALTER TABLE "prefilled_invitations" ADD CONSTRAINT "prefilled_invitations_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE;

-- =====================================================================
-- 7. EventTest.eventId → Cascade (transitivo desde MedicalEvent)
-- =====================================================================
ALTER TABLE "event_tests" DROP CONSTRAINT "event_tests_eventId_fkey";
ALTER TABLE "event_tests" ADD CONSTRAINT "event_tests_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE;

-- =====================================================================
-- 8. LabRecord.eventId → Cascade (transitivo desde MedicalEvent)
-- =====================================================================
ALTER TABLE "lab_records" DROP CONSTRAINT "lab_records_eventId_fkey";
ALTER TABLE "lab_records" ADD CONSTRAINT "lab_records_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE;

-- =====================================================================
-- 9. StudyRecord.eventId → Cascade (transitivo desde MedicalEvent)
-- =====================================================================
ALTER TABLE "study_records" DROP CONSTRAINT "study_records_eventId_fkey";
ALTER TABLE "study_records" ADD CONSTRAINT "study_records_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE;

-- =====================================================================
-- 10. MedicalExam.eventId → Cascade (transitivo desde MedicalEvent)
-- =====================================================================
ALTER TABLE "medical_exams" DROP CONSTRAINT "medical_exams_eventId_fkey";
ALTER TABLE "medical_exams" ADD CONSTRAINT "medical_exams_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE;

-- =====================================================================
-- 11. MedicalVerdict.eventId → Cascade (transitivo desde MedicalEvent)
-- =====================================================================
ALTER TABLE "medical_verdicts" DROP CONSTRAINT "medical_verdicts_eventId_fkey";
ALTER TABLE "medical_verdicts" ADD CONSTRAINT "medical_verdicts_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE;

-- =====================================================================
-- 12. StudyExtractionSnapshot.eventTestId → EventTest (ya Cascade, sin cambio)
-- =====================================================================

-- =====================================================================
-- 13. AIPrediagnosisSnapshot.extractionSnapshotId → StudyExtractionSnapshot (transitivo)
-- =====================================================================
ALTER TABLE "ai_prediagnosis_snapshots" DROP CONSTRAINT "ai_prediagnosis_snapshots_extractionSnapshotId_fkey";
ALTER TABLE "ai_prediagnosis_snapshots" ADD CONSTRAINT "ai_prediagnosis_snapshots_extractionSnapshotId_fkey"
  FOREIGN KEY ("extractionSnapshotId") REFERENCES "study_extraction_snapshots"("id") ON DELETE CASCADE;

-- =====================================================================
-- 14. DoctorStudyReview.prediagnosisSnapshotId → AIPrediagnosisSnapshot (transitivo)
-- =====================================================================
ALTER TABLE "doctor_study_reviews" DROP CONSTRAINT "doctor_study_reviews_prediagnosisSnapshotId_fkey";
ALTER TABLE "doctor_study_reviews" ADD CONSTRAINT "doctor_study_reviews_prediagnosisSnapshotId_fkey"
  FOREIGN KEY ("prediagnosisSnapshotId") REFERENCES "ai_prediagnosis_snapshots"("id") ON DELETE CASCADE;