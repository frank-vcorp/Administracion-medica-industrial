-- O9-32: capacidad y horario por día de semana (lunes–sábado)
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "weeklySchedule" JSONB;
