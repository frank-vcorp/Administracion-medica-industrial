-- FIX-20260810-08: Persistencia de snapshots de calibración.
--
-- Contexto:
--   El módulo de Calibración IA (/admin/services/[id]/calibration) ejecuta
--   el pipeline de extracción + prediagnóstico pero NO persistía los
--   resultados en BD (modo de prueba sin persistencia — SPEC
--   IMPL-20260715-04). Como consecuencia, la tab "Presentación" quedaba
--   vacía porque PresentationSchemaPanel lee snapshots persistidos.
--
-- Decisión arquitectónica:
--   Crear tabla dedicada `calibration_snapshots` (NO reutilizar
--   EventTest/StudyExtractionSnapshot) porque:
--     1. EventTest requiere MedicalEvent (workerId NOT NULL).
--     2. El flujo de calibración no tiene paciente/trabajador.
--     3. Cero impacto en modelos del flujo clínico real.
--
-- Esta migración:
--   1. Crea tabla calibration_snapshots con FK a medical_tests.
--   2. Crea índice compuesto (medicalTestId, createdAt DESC) para el
--      endpoint GET que lista snapshots por MedicalTest ordenados.
--   3. No toca tablas existentes. No inserta filas semilla.
--
-- Refs:
--   - context/SPECs/SPEC_FIX-20260810-08-CALIBRACION-SNAPSHOT-PERSISTENCIA.md
--   - context/handoff/HANDOFF_FIX-20260810-08-CALIBRATION-SNAPSHOT.md

-- =====================================================================
-- 1. Tabla calibration_snapshots
-- =====================================================================
CREATE TABLE calibration_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "medicalTestId" TEXT NOT NULL,
    "studyType"     TEXT NOT NULL,
    "sourceFileName" TEXT,
    "sourceFileUrl"  TEXT,
    "structuredData" JSONB NOT NULL,
    "modelName"     TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "promptVersion" TEXT NOT NULL DEFAULT 'extract-v2',
    "clinicalState" TEXT NOT NULL DEFAULT 'DRAFT_EXTRACTED',
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK hacia medical_tests (id es TEXT per schema.prisma @@map medical_tests).
-- ON DELETE CASCADE: si se elimina la MedicalTest, sus snapshots asociados
-- también se eliminan (consistente con StudyExtractionSnapshot cascade).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'medical_tests') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'calibration_snapshots_medicalTestId_fkey'
        ) THEN
            ALTER TABLE calibration_snapshots
                ADD CONSTRAINT "calibration_snapshots_medicalTestId_fkey"
                FOREIGN KEY ("medicalTestId") REFERENCES medical_tests(id)
                ON DELETE CASCADE
                ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

-- =====================================================================
-- 2. Índice compuesto para query principal (lista por MedicalTest)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_calibration_snapshots_test_created
    ON calibration_snapshots ("medicalTestId", "createdAt" DESC);