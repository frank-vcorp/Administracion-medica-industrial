# ADR-20260826-01 — Events múltiples por atención/cita

- **Estado:** activa
- **Decisión:** `Appointment` pasa de relación 1:1 a 1:N con `MedicalEvent` mediante `appointmentId` no único.
- **Autorización:** `DEC-20260826-02`, Frank, 2026-08-26.

## Contexto

El cierre documental debe integrar todos los Events del trabajador ligados a la misma atención/cita. El schema actual declara `MedicalEvent.appointmentId` como `@unique`, impidiendo más de un Event por Appointment.

## Consecuencias

- El ZIP y el dictamen general pueden resolver Events hermanos por `appointmentId`.
- Los registros existentes deben conservarse sin eliminación ni reasignación silenciosa.
- La migración requiere respaldo, revisión de duplicados/referencias, migración Prisma y validación contra la base autorizada.
- No se habilita producción hasta completar V1/V2 y el gate humano de migración.

## Fuera de alcance

- No crear una entidad `Atencion` nueva.
- No incluir Events históricos fuera de la Appointment.
- No cambiar reglas clínicas ni permisos del ZIP.

## Rollback

Restaurar el schema anterior sólo si la verificación detecta corrupción o pérdida de referencias; la ejecución de rollback en producción requiere autorización humana separada.
