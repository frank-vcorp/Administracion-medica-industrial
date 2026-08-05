# ADR-20260804-04: Bloqueo Asimétrico de Conflictos Proyecto ↔ Mantenimiento

**ID:** ADR-20260804-04
**Fecha:** 2026-08-05
**Estado:** ACEPTADO
**Autor:** INTEGRA
**Supersedes:** ninguno (formaliza comportamiento de SPEC_ARCH-20260711-01 §3.1).
**Related:** ADR-20260804-01, ADR-20260804-02, ADR-20260804-03; SPEC `context/SPECs/SPEC_ARCH-20260804-04-BLOQUEO-ASIMETRICO-CONFLICTOS.md`.

---

## 1. Contexto

AMI opera unidades móviles que pueden tener simultáneamente **proyectos** (visitas médicas con cliente/fechas/empleados) y **mantenimientos** (técnicos, PROGRAMADO/REPROGRAMADO). La SPEC base §3.1 exige validación de disponibilidad al crear/editar proyecto con unidad asignada, y `validateUnitAvailability` (`project.actions.ts:478`) ya detecta ambas clases de conflicto: solapamiento con otro proyecto (`type: 'project'`) y mantenimiento en rango (`type: 'maintenance'`).

El comportamiento vigente (pre-ADR) **ya rechaza** crear/editar proyecto sobre mantenimiento (de facto duro), y trata la creación de mantenimiento sobre proyecto como blando con alternativas + `ReprogramModal` (`maintenance.actions.ts:148-154`). Sin embargo, la asimetría **no estaba codificada**: mensajes genéricos sin códigos, sin distinción de clase de conflicto, sin contrato e2e sobre el banner, y `validateUnitAvailability` descartaba `scheduledDate` al construir `AvailabilityConflict`.

Frank (2026-08-05) aprobó **formalizar y hacer exigible** la asimetría.

## 2. Decisión

**Adoptar bloqueo asimétrico explícito:**

- **Lado proyecto (DURO):** `createProject`/`updateProject` rechazan con `errorCode: 'PROJECT_BLOCKED_BY_MAINTENANCE'` (o `'PROJECT_BLOCKED_BY_PROJECT'` para solapamiento §3.1) y mensaje legible en español vía `summarizeConflicts`. Banner visible con `data-testid="project-blocked-banner"`. **Sin** modal de reprogramación in-form.
- **Lado mantenimiento (BLANDO, sin cambios):** `createMaintenanceRecord`/`updateMaintenanceRecord`/`reprogramMaintenance` devuelven alternativas (`suggestMaintenanceDates`); `ReprogramModal` permite elegir fecha alternativa y reintentar sin abandonar el calendario de mantenimiento.

## 3. Por qué asimétrico (justificación de negocio de Frank)

- **Proyecto** = compromiso comercial con cliente, fechas pactadas contractuales, empleados asignados, billing. Reprogramar un proyecto arrastra renegociación con cliente, re-logística de personal y, potencialmente, penalizaciones. **Costo operacional alto.**
- **Mantenimiento** = mantenimiento técnico de la unidad. Es postergable por naturaleza (existe `nextDueDate`, hay ventana de tolerancia). Ya cuenta con UX de reproprogramación (`ReprogramModal` + `suggestMaintenanceDates`). **Costo operacional bajo.**
- Por tanto, cuando ambos chocan, **el mantenimiento cede** (se reprograma), no el proyecto. El operador que crea un proyecto sobre un mantenimiento recibe un bloqueo claro y debe resolver el conflicto yendo a reprogramar el mantenimiento o cambiando unidad/fechas del proyecto. El operador que crea un mantenimiento sobre un proyecto recibe alternativas y puede reprogramar in-form.

## 4. Trade-offs

### Ventajas
- Codifica la jerarquía de negocio (proyecto > mantenimiento).
- Contrato e2e (`project-blocked-banner`) hace testeable el bloqueo.
- Mensajes legibles reducen tickets de soporte ("¿por qué no se creó mi proyecto?").
- No rompe contrato existente (campos aditivos opcionales: `errorCode?`, `conflicts?`, `dateISO?`).

### Costos / fricción
- **UX:** el operador que crea un proyecto sobre un mantenimiento debe **abandonar** el form para resolverlo (no hay reprogramación in-form). Decisión consciente: fomenta que el conflicto se resuelva en el calendario de mantenimiento, donde está la UX adecuada (`ReprogramModal`).
- **Edge case — mantenimiento REPROGRAMADO:** un mantenimiento `REPROGRAMADO` con `scheduledDate` (la nueva fecha) dentro del rango del proyecto **también** bloquea. Coherente con R1 (`validateUnitAvailability` filtra `status in ['PROGRAMADO','REPROGRAMADO']`).
- **Edge case — misma fecha exacta:** `startDate == scheduledDate` → bloquea (fecha dentro de rango, `validateUnitAvailability` ya lo detecta vía `scheduledDate: { gte: start, lte: end }`).
- **Edge case — conflictos mixtos:** si un rango tiene conflicto con otro proyecto **Y** con un mantenimiento, el `errorCode` prioritario es `PROJECT_BLOCKED_BY_MAINTENANCE` (señal accionable). El mensaje lista ambos.

## 5. Reversibilidad

**Alta.** La regla vive enteramente en server actions (`project.actions.ts`) y en la UI (`ProjectFormModal`). Revertirla implica eliminar los guards (o relajarlos a warning) y quitar el testid. **No** toca schema Prisma, migraciones, middleware, auth ni FastAPI. No hay migración de datos.

## 6. Consecuencias / No cambios

- **No** se modifica `maintenance.actions.ts` (polo blando vigente).
- **No** se modifica schema Prisma ni endpoints FastAPI.
- **No** se introduce `ReprogramProjectModal` (se prohíbe explícitamente en SPEC §5.3).
- **No** se rompen tests e2e TC-4/TC-5/TC-6 (polo blando preservado).
- TC-3 se actualiza con aserción negativa del banner; TC-7 nuevo cubre el bloqueo duro.
- `AvailabilityConflict` puede extenderse con `dateISO?`/`maintenanceType?` (aditivo) para mensajes legibles.

## 7. Cumplimiento

- SPEC: `context/SPECs/SPEC_ARCH-20260804-04-BLOQUEO-ASIMETRICO-CONFLICTOS.md`.
- Handoff SOFIA: `context/interconsultas/HANDOFF_ARCH-20260804-04_SOFIA_BLOQUEO-ASIMETRICO.md`.
- Auditoría GEMINI exigida antes de `DONE`.

---

*Aceptado por INTEGRA el 2026-08-05, con aprobación explícita de Frank.*
