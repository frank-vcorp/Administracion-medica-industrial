# HANDOFF_ARCH-20260708-01 — A SOFIA: Perfiles, Paciente y Clonación

**De:** INTEGRA
**Para:** SOFIA
**Fecha:** 2026-07-08
**SPEC:** `context/SPECs/SPEC_ARCH-20260708-01-PERFILES-PACIENTE-CORREOS-CLONACION.md`
**ID:** ARCH-20260708-01

---

## Resumen ejecutivo
Necesito que implementes los 4 puntos prioritarios del bloque "datos del paciente y perfiles" que quedaron pendientes de la junta del 2026-07-01. Todo es **aditivo** a Prisma (sin migraciones destructivas) y reutiliza la infraestructura existente (MedicalProfilesManager, BulkWorkerImportModal, worker.actions, medical-profiles.ts).

## Lo que tienes que entregar

### Sub-bloque A: Múltiples correos por perfil médico
- Nueva tabla `MedicalProfileReportEmail` (profileId + email + label opcional).
- UI en `MedicalProfilesManager` y `CompanyMedicalProfilesPanel` con sección "Correos de envío" (lista + agregar + eliminar).
- Actions: `addProfileReportEmail`, `removeProfileReportEmail`, `getMedicalProfileWithEmails`.

### Sub-bloque B: Múltiples correos por paciente
- Nueva tabla `WorkerReportEmail` (workerId + email + isPrimary).
- Nuevo componente `WorkerReportEmailsPanel` (max 5 correos por UI).
- Actions: `addWorkerReportEmail`, `removeWorkerReportEmail`.

### Sub-bloque C: Comentarios especiales en perfil
- Nueva columna `specialNotes String?` en `MedicalProfile`.
- UI: textarea en modal de crear/editar perfil, max 2000 chars.
- Action: `updateProfileSpecialNotes(profileId, notes)`.

### Sub-bloque D: Clonación de perfiles
- Nueva action `cloneMedicalProfile(profileId, newName)`:
  - Transacción Prisma que copia perfil + ProfileTest + MedicalProfileReportEmail + specialNotes.
  - Nombre nuevo como parámetro (default: "{nombre} (Copia)").
- Botón "Duplicar" en cada tarjeta de `MedicalProfilesManager` y `CompanyMedicalProfilesPanel`.
- Al clonar, abre modal prellenado para que el usuario edite antes de guardar.

### Sub-bloque E: Distinción de altas masivas
- Extender enum `IntakeSource` con `CLINIC_WALK_IN_MASS` y `UNIT_MOBILE_MASS`.
- Nueva action `bulkRegisterClinicWalkIn(rows, branchId)` para clínica física (sin Project).
- Modificar `bulkImportWorkers` para marcar `intakeSource = 'UNIT_MOBILE_MASS'` en workers creados.
- Nuevo componente `BulkClinicWalkInImportModal` (selector de sucursal + paste manual, max 20 filas).
- Modificar `/workers/page.tsx` para mostrar 2 botones distintos:
  - "Carga Masiva — Unidad Móvil" (verde): abre `BulkWorkerImportModal`.
  - "Carga Masiva — Clínica Física" (azul): abre `BulkClinicWalkInImportModal`.

## Archivos exactos a tocar (máximo 10)

1. `frontend/prisma/schema.prisma` — agregar enum values + columna + 2 modelos.
2. `frontend/prisma/migrations/{timestamp}_add_profile_emails_and_special_notes/migration.sql` — generada por `prisma migrate dev`.
3. `frontend/src/actions/medical-profiles.ts` — 5 actions nuevas/modificadas.
4. `frontend/src/actions/worker.actions.ts` — 3 actions nuevas/modificadas.
5. `frontend/src/components/MedicalProfilesManager.tsx` — clonar + correos + notas.
6. `frontend/src/components/CompanyMedicalProfilesPanel.tsx` — mismas adiciones.
7. `frontend/src/components/BulkClinicWalkInImportModal.tsx` — **NUEVO**.
8. `frontend/src/app/workers/page.tsx` — agregar segundo botón.
9. `frontend/src/components/workers/WorkerReportEmailsPanel.tsx` — **NUEVO**.
10. (opcional) `frontend/src/components/workers/WorkerDetailSection.tsx` — integrar el panel de correos.

**Si necesitas un 11º archivo, DETENTE y reporta BLOQUEO DE CONTEXTO.**

## Validaciones obligatorias antes de cerrar

```bash
cd frontend
pnpm prisma migrate dev --name add_profile_emails_and_special_notes
pnpm typecheck
pnpm lint src/actions/medical-profiles.ts src/actions/worker.actions.ts src/components/MedicalProfilesManager.tsx src/components/CompanyMedicalProfilesPanel.tsx src/components/BulkClinicWalkInImportModal.tsx src/components/workers/WorkerReportEmailsPanel.tsx src/app/workers/page.tsx
pnpm test
```

**Antes de reportar como listo, NO pidas qodo (está sunset).**
**En su lugar, incluye en el reporte final un self-review manual:**
- ¿El código refleja la SPEC?
- ¿Hay code smells evidentes?
- ¿Los tests existentes siguen pasando?
- ¿Algún riesgo de regresión?
- ¿La migración es aditiva (no destructiva)?

**Al cerrar, sugiere que INTEGRA invoque a GEMINI (subagent_type='gemini') como segunda mano de validación.**

## Contexto de la junta

Los 4 puntos nacen de la junta del 2026-07-01. Frank (usuario humano) revisó la transcripción y el 2026-07-08 pidió priorizar este bloque porque son cambios aditivos sin romper nada existente y desbloquean la regla "no contaminación de perfiles" acordada en la junta.

Detalles de cada decisión en la SPEC. Si tienes dudas sobre:
- Diseño de schema → consulta la SPEC sección "Datos faltantes a crear".
- Lógica de clonación → SPEC sección "Sub-bloque D" + "Diseño técnico B".
- Validación de "máximo 5 correos por worker" → SPEC sección "Riesgos R2" (es UI, no DB constraint).

## Datos que ya existen y debes reutilizar

- `MedicalProfile` model (schema.prisma línea 274).
- `ProfileTest` pivot (línea 288).
- `Worker` model con `email` (línea 169) — se conserva como correo principal.
- `bulkImportWorkers` action (worker.actions.ts línea 305) — base para alta masiva.
- `quickRegisterWorkersSameDay` (línea 518) — base para alta rápida (max 20 filas).
- `BulkWorkerImportModal.tsx` — base visual para el nuevo `BulkClinicWalkInImportModal`.
- `MedicalProfilesManager.tsx` y `CompanyMedicalProfilesPanel.tsx` — base UI para agregar secciones.

## Política de delegación

- Trabaja en una rama `feature/arch-20260708-01-perfiles-paciente`.
- Commits atómicos y descriptivos (Conventional Commits: `feat:`, `chore:`, `refactor:`).
- NO hagas merge a `main` sin OK explícito de INTEGRA o Frank.
- NO corras `qodo` (está sunset, retornará error).

## Formato del reporte final

Devuélveme un mensaje estructurado con:

1. **Resumen de 1-2 líneas** de lo implementado.
2. **Archivos modificados/creados** (lista exacta).
3. **Resultado de las 4 validaciones** (prisma migrate / typecheck / lint / test).
4. **Self-review manual** (5 puntos arriba).
5. **Riesgos o desviaciones** de la SPEC.
6. **Capturas o trazas** si las hubo.
7. **Sugerencia explícita** de que INTEGRA invoque a GEMINI para segunda mano.

¡Adelante!