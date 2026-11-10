-- SME-97: enlace opcional desde una cita posterior hacia el evento de la consulta.
-- La captura de próxima cita vive en clinicalContext; esta columna no es obligatoria para guardar.
ALTER TABLE "appointments" ADD COLUMN "followUpFromMedicalEventId" TEXT;

CREATE INDEX "appointments_followUpFromMedicalEventId_idx" ON "appointments"("followUpFromMedicalEventId");

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_followUpFromMedicalEventId_fkey"
FOREIGN KEY ("followUpFromMedicalEventId") REFERENCES "medical_events"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
