# Open Questions

## OQ-20260819-01 — Condición exacta para emitir el dictamen integrado

- **Tipo:** blocking
- **Razón:** Debe definirse si basta con pruebas aplicables validadas/no aplicables o si el médico puede emitir con una prueba pendiente bajo autorización explícita.
- **Opciones:**
  1. Solo todas validadas o no aplicables.
  2. Permitir excepción médica documentada.
- **Responsable:** Frank + equipo clínico AMI.
- **Estado:** open.

## OQ-20260819-02 — Contenido del ZIP final

- **Tipo:** non_blocking
- **Razón:** Debe confirmarse si el ZIP incluye también fuente cruda del equipo (PDF original) además del reporte individual validado.
- **Opciones:**
  1. Solo reportes individuales validados + dictamen integrado.
  2. También anexos/fuentes crudas de cada prueba.
- **Responsable:** Equipo clínico AMI.
- **Estado:** open.

## OQ-20260819-03 — Entregable independiente de Examen Médico

- **Tipo:** non_blocking
- **Razón:** Se está documentando desde los formatos de revisión. Falta validación clínica de su layout final.
- **Responsable:** Frank + AMI.
- **Estado:** open.

## OQ-20260819-04 — Aptitud consolidada cuando el perfil no incluye Examen Médico

- **Tipo:** blocking
- **Razón:** Los perfiles permiten combinaciones de pruebas sin Examen Médico. Debe definirse si una atención de solo pruebas complementarias puede emitir aptitud laboral general o solo reportes individuales.
- **Opciones:**
  1. Sin Examen Médico: solo resultados y reportes individuales; no hay aptitud consolidada.
  2. Sin Examen Médico: se permite dictamen general si un médico lo firma expresamente sobre las pruebas disponibles.
  3. Examen Médico obligatorio para cualquier aptitud laboral consolidada.
- **Responsable:** Frank + equipo clínico AMI.
- **Estado:** deferred.
- **Decisión actual:** mantener Impresión y Aptitud bajo Examen Médico hasta revisión AMI (DEC-20260819-02).

## OQ-20260821-01 — Insumos necesarios para promover Audio/Espiro

- **Tipo:** blocking
- **Razón:** La validación actual es estructural y basada en los documentos disponibles, pero no permite afirmar calibración exhaustiva ni prueba IA real.
- **Insumos requeridos:** PDF de Audiometría con 8 frecuencias canónicas; PDF Sibelmed de Espirometría con tabla M1/M2/M3/%REF/REF/LLN; archivo de valores de referencia espirométrica con LLN/ecuación aplicable; autorización para ejecutar extracción real con proveedor IA en entorno de prueba.
- **Responsable:** Frank + equipo clínico AMI.
- **Estado:** open.

## OQ-20260826-01 — Alcance de Events incluidos en el ZIP y dictamen general

- **Tipo:** blocking
- **Razón:** Frank indicó que el dictamen debe incluir los hallazgos de los otros Events y que el ZIP debe contener el PDF y la fuente de cada Event, pero el contrato vigente parte de un único `eventId`.
- **Opciones:**
  1. Incluir sólo los `EventTest`/estudios pertenecientes al Event actual.
  2. Incluir todos los Events de la misma atención/cita del trabajador (recomendado).
  3. Incluir todos los Events históricos del trabajador, sin limitar a una atención.
- **Decisión necesaria:** elegir el alcance y confirmar que el formato visual objetivo es el del PDF AMI de referencia (`REPORTE DE EXAMEN MEDICO (APTITUD)`), aplicado al dictamen general y a los dictámenes por estudio.
- **Responsable:** Frank + equipo clínico AMI.
- **Estado:** resolved by DEC-20260826-01.

## OQ-20260826-02 — Modelo de agrupación de Events por atención/cita

- **Tipo:** blocking / autorización de migración
- **Razón:** El schema actual define `MedicalEvent.appointmentId` como `@unique` (relación 1:1), por lo que no puede existir más de un Event para la misma cita. La decisión confirmada exige consolidar múltiples Events de una misma atención/cita.
- **Opciones:**
  1. Autorizar migración para eliminar `@unique` y convertir `Appointment → MedicalEvent` en 1:N usando `appointmentId`.
  2. Autorizar agregar una entidad/campo explícito de agrupación (`atencionId`/equivalente) y migrar los registros existentes.
  3. No migrar ahora y limitar temporalmente el ZIP al Event actual (no cumple la decisión `DEC-20260826-01`).
- **Riesgo:** cualquier opción 1/2 cambia schema y datos; requiere autorización explícita, plan de migración, backup/verificación y rollback.
- **Responsable:** Frank + ATLAS.
- **Estado:** resolved by DEC-20260826-02; implementation gated.
