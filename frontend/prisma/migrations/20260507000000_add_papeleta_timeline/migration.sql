-- IMPL-20260507-08: Cronograma Persistente de Papeleta Admin (ARCH-20260507-08)
-- Ref: context/SPECs/SPEC_ARCH-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md
--
-- Capa operativa paralela al flujo clínico. No reemplaza EventTest.status.
-- Visibilidad: ADMIN_ONLY — nunca exponer a roles clínicos generales.

-- Enum de tipos de movimiento del cronograma
CREATE TYPE "TimelineEntryType" AS ENUM (
  'STUDY_STARTED',
  'SAMPLE_TAKEN',
  'RESULT_REGISTERED',
  'STUDY_COMPLETED',
  'MEDICAL_EXAM_SAVED',
  'ADMIN_INCIDENCE'
);

-- Tabla principal del cronograma operativo
CREATE TABLE "papeleta_timeline_entries" (
  "id"          TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "eventTestId" TEXT,
  "entryType"   "TimelineEntryType" NOT NULL,
  "area"        TEXT NOT NULL DEFAULT 'general',
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "occurredAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "visibility"  TEXT NOT NULL DEFAULT 'ADMIN_ONLY',
  "metadata"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "papeleta_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- Relaciones
ALTER TABLE "papeleta_timeline_entries"
  ADD CONSTRAINT "papeleta_timeline_entries_eventId_fkey"
  FOREIGN KEY ("eventId")
  REFERENCES "medical_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "papeleta_timeline_entries"
  ADD CONSTRAINT "papeleta_timeline_entries_createdById_fkey"
  FOREIGN KEY ("createdById")
  REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Índice de consulta por evento y fecha (más frecuente)
CREATE INDEX "papeleta_timeline_entries_eventId_occurredAt_idx"
  ON "papeleta_timeline_entries"("eventId", "occurredAt");
