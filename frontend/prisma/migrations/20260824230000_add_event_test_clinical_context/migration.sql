-- IMPL-FEATURE-20260824-02: cuestionario emergente de Espirometría.
-- Agregar `clinicalContext` JSONB nullable a `event_tests` para alojar el
-- payload versionado `espirometria-questionnaire-v1`. Migración aditiva:
-- columnas nuevas nullable, sin tocar tablas existentes; rollback = DROP COLUMN.
ALTER TABLE "event_tests" ADD COLUMN "clinicalContext" JSONB;
