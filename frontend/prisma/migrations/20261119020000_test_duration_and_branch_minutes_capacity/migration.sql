-- Duración teórica por prueba, duración de perfiles médicos y capacidad por minutos en sucursal

ALTER TABLE "medical_tests" ADD COLUMN IF NOT EXISTS "theoreticalDurationMinutes" INTEGER;

ALTER TABLE "medical_profiles" ADD COLUMN IF NOT EXISTS "calculatedDurationMinutes" INTEGER;
ALTER TABLE "medical_profiles" ADD COLUMN IF NOT EXISTS "controlDeskMode" TEXT NOT NULL DEFAULT 'AUTO';
ALTER TABLE "medical_profiles" ADD COLUMN IF NOT EXISTS "extraRxProjections" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "medical_profiles" ADD COLUMN IF NOT EXISTS "durationOverrideMinutes" INTEGER;

ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "capacityMode" TEXT NOT NULL DEFAULT 'HOURLY_COUNT';
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "hourlyMinutesCapacity" INTEGER;

ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "estimatedDurationMinutes" INTEGER;

-- Precarga idempotente de tiempos UMM (tiempos-de-pruebas-umm.pdf) en MedicalTest
-- Solo rellena filas donde theoreticalDurationMinutes es NULL.
UPDATE "medical_tests"
SET "theoreticalDurationMinutes" = CASE
  WHEN "code" IN ('GEN-015', 'MED-01', 'GEN-EM-AMI', 'GEN-EM-SOD', 'GEN-EM-FLO')
    OR translate(upper(trim("name")), 'ÁÉÍÓÚÜ', 'AEIOUU') LIKE 'EXAMEN MEDICO%'
    THEN 30
  WHEN "code" IN ('GEN-012', 'CARD-ECG')
    OR translate(upper(trim("name")), 'ÁÉÍÓÚÜ', 'AEIOUU') LIKE '%ELECTROCARDIOGRAMA%'
    THEN 25
  WHEN "code" IN ('GEN-013', 'ESPIRO-01', 'GEN-003', 'AUDIO-01', 'GEN-004', 'OFT-CAMP')
    OR translate(upper(trim("name")), 'ÁÉÍÓÚÜ', 'AEIOUU') IN (
      'ESPIROMETRIA',
      'AUDIOMETRIA',
      'AUDIOMETRIA TONAL',
      'CAMPIMETRIA'
    )
    THEN 15
  WHEN "code" IN ('IMG-002', 'IMG-015', 'RX-COL-01', 'IMG-012', 'IMG-013', 'RX-TX-01')
    OR translate(upper(trim("name")), 'ÁÉÍÓÚÜ', 'AEIOUU') LIKE '%RX DE COLUMNA%'
    OR translate(upper(trim("name")), 'ÁÉÍÓÚÜ', 'AEIOUU') LIKE '%RADIOGRAFIA DE COLUMNA%'
    OR translate(upper(trim("name")), 'ÁÉÍÓÚÜ', 'AEIOUU') LIKE '%TELE DE TORAX%'
    OR translate(upper(trim("name")), 'ÁÉÍÓÚÜ', 'AEIOUU') LIKE '%RX DE TORAX%'
    OR translate(upper(trim("name")), 'ÁÉÍÓÚÜ', 'AEIOUU') LIKE '%RADIOGRAFIA DE TORAX%'
    THEN 10
  ELSE NULL
END
WHERE "theoreticalDurationMinutes" IS NULL;
