-- Reagendar citas: estado que libera el cupo en la agenda.
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULED';
