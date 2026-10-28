-- Motivo de cancelación sobre estatus que ya existían (AppointmentStatus.CANCELLED, EventStatus.CANCELED).
ALTER TABLE "appointments" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "appointments" ADD COLUMN "cancelledAt" TIMESTAMP(3);

ALTER TABLE "medical_events" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "medical_events" ADD COLUMN "cancelledAt" TIMESTAMP(3);
