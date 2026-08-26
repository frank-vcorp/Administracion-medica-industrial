-- =============================================================================
-- IMPL-20260826-06 / DEC-20260826-02 / ADR-20260826-01 / BR-20260826-02
-- Eliminación de la unicidad de MedicalEvent.appointmentId.
--
-- Operación NO DESTRUCTIVA — conserva TODOS los registros existentes.
--   • Suelta el índice único `medical_events_appointmentId_key`.
--   • Mantiene el FK `medical_events_appointmentId_fkey` (→ appointments.id).
--   • Mantiene la columna `appointmentId` (nullable) y sus valores.
--
-- Consecuencia operativa: ahora una `Appointment` puede tener N
-- `MedicalEvent` (relación 1:N). El ZIP y el dictamen general pueden
-- consolidar Events hermanos por `appointmentId`, filtrando además por
-- `workerId` (BR-20260826-02).
--
-- Gate humano (DEC-20260826-02 / ADR-20260826-01 §Rollback):
--   • NO ejecutar en producción sin autorización humana separada.
--   • NO ejecutar rollback (DROP INDEX + re-add @unique) si la
--     verificación post-migración detecta duplicados no esperados
--     o pérdida de referencias.
--   • Restaurar `@unique` requiere backup previo y validación V1/V2.
-- =============================================================================

-- Drop the unique index that enforces the historical 1:1 relationship.
DROP INDEX IF EXISTS "medical_events_appointmentId_key";

-- Sanity check: NO drop del FK — sólo del constraint UNIQUE.
-- (El FK `medical_events_appointmentId_fkey` sigue activo.)

-- NO se hace nada con la columna:
--   • Mantiene tipo TEXT (nullable).
--   • Mantiene el FK a appointments(id) con ON DELETE SET NULL.
--   • Conserva los valores existentes (no UPDATE/DELETE/ALTER).

-- Nota defensiva para futuras migraciones / audit:
--   Esta migración es ADITIVA en términos de capacidad (1:1 → 1:N).
--   NO es destructiva: ningún `UPDATE` ni `DELETE` ni `TRUNCATE`.
--   La reversión se realiza con el script `revert_remove_medical_event_appointment_id_unique.sql`
--   que vive en el mismo directorio.
