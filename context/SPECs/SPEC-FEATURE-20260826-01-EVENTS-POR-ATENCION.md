# SPEC-FEATURE-20260826-01 — Consolidado documental por atención/cita

- **Estado:** READY_FOR_SOFIA
- **Prioridad:** P1
- **ADR:** `ADR-20260826-01-EVENTS-POR-ATENCION.md`
- **Base funcional:** `DEC-20260826-01`, `DEC-20260826-02`, `BR-20260826-01`, `BR-20260826-02`

## Resultado esperado

Permitir múltiples `MedicalEvent` por `Appointment` y generar desde cualquier Event de la atención/cita un dictamen general y ZIP que consoliden únicamente los Events del mismo trabajador y Appointment.

## Alcance técnico

1. Eliminar la unicidad de `MedicalEvent.appointmentId` mediante migración Prisma no destructiva.
2. Verificar que los registros existentes mantienen `appointmentId`, trabajador y relaciones.
3. Resolver Events hermanos por `appointmentId`, filtrando también por trabajador.
4. Generar dictamen general con formato AMI y hallazgos por Event/estudio.
5. Generar ZIP con `01_Dictamen_General/` y una carpeta por Event/estudio, con PDF/fuente disponible y `manifest.txt` para faltantes.

## Criterios verificables

- AC-1: Prisma valida la relación 1:N y la migración no elimina registros.
- AC-2: Un Appointment con dos Events devuelve ambos, sólo si pertenecen al mismo trabajador.
- AC-3: Un Event de otra Appointment o trabajador nunca aparece en el consolidado.
- AC-4: Dictamen y ZIP incluyen cada Event/estudio aplicable y marcan faltantes sin inventar.
- AC-5: Roles y restricciones de `COMPANY_CLIENT` permanecen intactos.
- AC-6: La descarga funciona desde Railway/S3 sin leer filesystem Vercel.

## Validación y gates

- V1: schema/migración en base desechable, tests de selección y ZIP.
- V2: suite frontend/backend y build una vez.
- V3: smoke con dos Events de la misma cita, un Event ajeno, fuentes S3, dictamen y ZIP.
- Gate humano: no ejecutar migración destructiva, producción ni rollback sin autorización separada.

## Archivos permitidos

- `frontend/prisma/schema.prisma` y migración Prisma asociada.
- `frontend/src/lib/event-atencion.ts`, renderer del dictamen, constructor/ruta ZIP y tests asociados.
- Documentación de evidencia de la implementación.

## Prohibido inferir

- No agrupar por sólo nombre del trabajador, proyecto o fecha.
- No incluir histórico fuera de la Appointment.
- No inventar hallazgos, PDFs fuente o Events inexistentes.
