-- =============================================================================
-- IMPL-20260826-06 / DEC-20260826-02 / ADR-20260826-01 §Rollback
-- Script de rollback EXPLÍCITO — restauración del constraint UNIQUE
-- `medical_events_appointmentId_key` sobre `medical_events.appointmentId`.
--
-- ⚠ NO EJECUTAR sin autorización humana separada (ADR §Rollback).
-- ⚠ Antes de ejecutar:
--     1. Backup completo de la base.
--     2. Identificar duplicados `appointmentId` en `medical_events`
--        (varias filas con el mismo appointmentId, una o varias NULL).
--     3. Decidir qué filas se preservan (e.g. la más reciente por
--        `createdAt`, o la que tenga `verdict.id NOT NULL`).
--     4. Mover o eliminar las filas duplicadas NO seleccionadas.
--     5. Sólo entonces ejecutar este script.
-- =============================================================================

-- DESTRUCTIVO: falla si hay duplicados no resueltos.
-- (Re-crear el índice UNIQUE fuerza la condición 1:1 que la columna
-- ya no cumple bajo el nuevo modelo 1:N.)
SET LOCAL session_replication_role = replica;

-- Pre-chequeo defensivo: abortar si hay duplicados.
DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT "appointmentId", COUNT(*) AS n
    FROM "medical_events"
    WHERE "appointmentId" IS NOT NULL
    GROUP BY "appointmentId"
    HAVING COUNT(*) > 1
  ) dups;
  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Rollback abortado: hay % appointmentId con múltiples MedicalEvents. '
      'Resuelve los duplicados antes de continuar (ADR §Rollback).', dup_count;
  END IF;
END $$;

-- Reconstruir el índice UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS "medical_events_appointmentId_key"
  ON "medical_events"("appointmentId");
