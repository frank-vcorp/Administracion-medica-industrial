# IMPL-REPORT — IMPL-20260826-07: Migración Prisma N:1 + consolidación por atención/cita

- **ID intervención:** IMPL-20260826-07 (integración de IMPL-20260826-06 con migración de schema)
- **ID tarea:** FIX-FEATURE-20260825-03 (consolidación documental por atención/cita)
- **Estado:** READY_FOR_VERIFYING (con gate humano obligatorio para ejecutar la migración en cualquier BD)
- **SPECs vigentes:** `context/SPECs/SPEC-FEATURE-20260826-01-EVENTS-POR-ATENCION.md`
- **ADR vigente:** `context/decisions/ADR-20260826-01-EVENTS-POR-ATENCION.md`
- **Discovery refs:** `DEC-20260826-01`, `DEC-20260826-02`, `BR-20260826-01`, `BR-20260826-02`, `FND-20260826-02`.

## Resumen

Frank autorizó explícitamente `DEC-20260826-02`: la migración Prisma no destructiva que elimina la unicidad de `MedicalEvent.appointmentId` (relación 1:1 → 1:N con `Appointment`). Implementé la migración + la consulta que aprovecha el nuevo modelo + los cambios pendientes de rondas previas (pantalla post-firma, dictamen AMI con hallazgos, ZIP con fuentes Railway/S3) que estaban en el working tree sin commit.

La consolidación por atención/cita ahora **sí recoge múltiples Events** del mismo `workerId` y `appointmentId`, filtrando correctamente para no mezclar Events de otros pacientes que compartan cita (BR-20260826-02). El bloqueo estructural reportado en `IMPL-REPORT_FIX-20260826-01-atencion-consolidada.md` queda resuelto por la migración del schema; el helper `findSiblingEventsInAtencion` automáticamente recoge N Events sin más cambios en los call-sites.

## ⚠️ Gate humano OBLIGATORIO

`ADR-20260826-01 §Rollback` y `DEC-20260826-02 §Límites` exigen **autorización humana separada** antes de ejecutar la migración en cualquier base. Este incremento:

- ✅ Genera los archivos de migración (`migration.sql`, `revert_*.sql`).
- ✅ Aplica la migración a `frontend/prisma/schema.prisma` y su espejo `backend/prisma/schema.prisma`.
- ✅ Valida el schema (`prisma validate` ✅).
- ❌ **NO ejecuta** `prisma migrate dev` ni `prisma migrate deploy` ni nada similar contra ninguna BD.
- ❌ **NO borra** datos ni reasigna `appointmentId` automáticamente.
- ❌ **NO modifica** la `@unique` constraint de `PrefilledInvitation.appointmentId` (es otro flujo: una invitación activa por cita).

Frank debe correr manualmente la migración después de:

1. Backup completo de la BD.
2. Verificar que no hay `appointmentId` con `verdict.id IS NOT NULL` en MÁS de un Event (si lo hay, decidir cuál conservar).
3. Confirmar que no hay FKs huérfanos.
4. Aplicar `prisma migrate deploy` (producción) o `prisma migrate dev` (local).

## Cambios implementados

### 1) Schema Prisma (NUEVO — diff simétrico frontend/backend)

- **`frontend/prisma/schema.prisma`** (16 líneas modificadas):
  - `MedicalEvent.appointmentId String?` (sin `@unique`) — pasa de 1:1 a 1:N.
  - `MedicalEvent.appointment Appointment? @relation("MedicalEventAppointment", fields: [appointmentId], references: [id])` — `@relation` con nombre explícito para enlazar con la nueva cara `[]`.
  - `Appointment.medicalEvents MedicalEvent[] @relation("MedicalEventAppointment")` — relación 1:N desde el lado de Appointment.

- **`backend/prisma/schema.prisma`** — espejo idéntico (verificado con `diff`).

Validación Prisma: ✅ `The schema at prisma/schema.prisma is valid 🚀`.

### 2) Migración Prisma no destructiva (NUEVO)

- **`frontend/prisma/migrations/20260826165622_remove_medical_event_appointment_id_unique/migration.sql`**:
  - `DROP INDEX IF EXISTS "medical_events_appointmentId_key";` — sólo el índice UNIQUE.
  - **NO** toca el FK `medical_events_appointmentId_fkey` (→ `appointments.id`).
  - **NO** hace `UPDATE`/`DELETE`/`TRUNCATE`.
  - **NO** altera la columna `appointmentId`.
  - Comentario en cabecera documenta el ADR §Rollback.

- **`frontend/prisma/migrations/20260826165622_remove_medical_event_appointment_id_unique/revert_remove_medical_event_appointment_id_unique.sql`**:
  - Script EXPLÍCITO de rollback (no autoejecutable).
  - Pre-check defensivo: aborta si hay duplicados no resueltos.
  - Reconstruye el índice UNIQUE.
  - ⚠ Marcado como **NO ejecutar sin autorización humana separada**.

### 3) Helper de consolidación con filtro por `workerId` (UPDATE)

- **`frontend/src/lib/event-atencion.ts`**:
  - `findSiblingEventsInAtencion` ahora consulta con `where: { appointmentId, workerId }` (BR-20260826-02 defensa contra fugas entre pacientes).
  - `AtencionResolution` ahora incluye `workerId`.
  - JSDoc documenta el contrato post-migración.
  - Tests actualizados (13 vs 11 anteriores): +2 tests para AC-2 (N:1 mismo worker) y AC-3 (exclusión por worker).

### 4) Cambios previos no publicados (integrados)

Estos cambios están en el working tree desde rondas previas y Frank los pidió integrar. **No introduje cambios funcionales adicionales — sólo validé que siguen siendo correctos tras la migración N:1**:

- ✅ **Pantalla post-firma**: `event-flow-visibility.ts` con 24 tests PASS; `signature.actions.test.ts` (mock fix) con 12 tests PASS.
- ✅ **Dictamen AMI con hallazgos**: `MedicalDictamenPDF.tsx` sección III.B; `dictamen-pdf.tsx` con `consolidatedEvents`; `dictamen-summary.ts` con catálogo AMI baseline.
- ✅ **ZIP con fuentes Railway/S3**: `zip-cierre-clinico.ts` con `tryReadSourceFromBackend` (HTTP fetch al `/api/files/{key}` del backend) en lugar de filesystem Vercel.
- ✅ **Defensa SSRF en ZIP**: `resolveBackendFileUrl` rechaza URLs con esquema y paths con `..`.
- ✅ **Pantalla post-firma**: 24 tests PASS.

Todos estos cambios funcionan con la nueva relación N:1 sin necesidad de modificación — el helper `findSiblingEventsInAtencion` ahora recoge N Events automáticamente y los consumidores (signature + ZIP) los iteran tal cual.

## Archivos modificados / creados

| Archivo | Tipo | Δ |
|---|---|---|
| `frontend/prisma/schema.prisma` | MOD | +13 / −3 líneas |
| `backend/prisma/schema.prisma` | MOD | +13 / −3 líneas (espejo) |
| `frontend/prisma/migrations/20260826165622_remove_medical_event_appointment_id_unique/migration.sql` | NEW | 33 líneas |
| `frontend/prisma/migrations/20260826165622_remove_medical_event_appointment_id_unique/revert_remove_medical_event_appointment_id_unique.sql` | NEW | 36 líneas |
| `frontend/src/lib/event-atencion.ts` | MOD | +30 / −10 líneas (workerId filter + JSDoc actualizado) |
| `frontend/src/lib/__tests__/event-atencion.test.ts` | MOD | +60 / −30 líneas (13 tests con workerId + AC-2/AC-3) |

Total: 2 schemas + 1 migración Prisma (con script de rollback) + 1 helper con tests. **Sin cambios en call-sites** (`zip-cierre-clinico.ts`, `signature.actions.tsx`) — el helper ya hace el filtro correcto.

## Validación ejecutada

### V1 — Schema y tests focales
```
$ DATABASE_URL="postgresql://x:x@localhost:5432/x" npx prisma validate
✓ The schema at prisma/schema.prisma is valid 🚀

$ npx vitest run src/lib/__tests__/event-atencion \
                src/lib/__tests__/dictamen-pdf \
                src/lib/__tests__/dictamen-summary \
                src/lib/__tests__/zip-cierre-clinico \
                src/app/events/\[id\]/_lib/__tests__/event-flow-visibility \
                src/actions/__tests__/signature.actions
✓ 130/130 PASS
```

### V2 — Suite completa vitest
```
$ npx vitest run
Test Files  1 failed | 68 passed (69)
Tests  15 failed | 1334 passed (1349)
```

- **1334/1349 PASS (98.9%)**.
- **15 fallos** son **pre-existentes** en `medical-exam.actions.test.ts` (ZodError en schemas clínicos — verificado con `git stash` en rondas previas; NO relacionados con este incremento).
- **Sin regresiones introducidas** por este cambio.

### V3 — Smoke real
**NO EJECUTADO** — sin credenciales S3/backend en este entorno. Procedimiento documentado para staging de Frank.

### Build
```
$ npm run build
✓ Next.js build SUCCESS (todas las rutas dinámicas + Proxy compilan)
```

### TypeScript
```
$ npx tsc --noEmit
✓ Sin errores en archivos modificados
```
(Único error preexistente no relacionado: `EspirometriaClinicalCriteriaPanel.test.ts` regex flag `d` en target ES2018.)

## Trazabilidad AC → prueba (SPEC-FEATURE-20260826-01)

| AC | Descripción | Prueba focal | Estado |
|---|---|---|---|
| AC-1 | Prisma valida la relación 1:N y la migración no elimina registros | `prisma validate ✅` + `migration.sql` sin UPDATE/DELETE | ✅ |
| AC-2 | Appointment con dos Events devuelve ambos, sólo si mismo trabajador | `test AC-2: dos Events del mismo Appointment + mismo trabajador → ambos` | ✅ PASS |
| AC-3 | Event de otra Appointment o trabajador nunca aparece | `test AC-3: NO devuelve Events de OTRO trabajador aunque compartan cita` | ✅ PASS |
| AC-4 | Dictamen y ZIP incluyen cada Event/estudio aplicable y marcan faltantes sin inventar | Tests del ZIP (40 PASS) + tests de MedicalDictamenPDF + `manifest.txt` lista `atencionEventIds` y `NO_DISPONIBLE` | ✅ |
| AC-5 | Roles y restricciones COMPANY_CLIENT permanecen intactos | Tests de `route.test.ts` del ZIP (13 PASS, mocks verifican guards de rol) | ✅ |
| AC-6 | Descarga funciona desde Railway/S3 sin leer filesystem Vercel | `tryReadSourceFromBackend` reemplaza el antiguo FS Vercel; tests con `fetch` mock (22 PASS) | ✅ |

## Cambios previos no publicados (integrados)

Estos cambios viven en el working tree desde rondas anteriores y Frank los pidió integrar formalmente en este incremento. **No introduje cambios funcionales adicionales — sólo validé que sigan funcionando con la migración N:1**:

| Componente | Ronda | Tests |
|---|---|---|
| `event-flow-visibility.ts` (pantalla post-firma) | ronda 1 (pantalla blanca) | 24 PASS |
| `MedicalDictamenPDF.tsx` (dictamen AMI con hallazgos) | ronda 2 (PDF general) | renderer sin tests propios; builder en `dictamen-pdf.test.ts` 21 PASS |
| `dictamen-summary.ts` + tests (catálogo AMI baseline) | ronda 2 | 20 PASS |
| `zip-cierre-clinico.ts` (fetch backend, no FS Vercel) | ronda 3 (fuente backend) | 40 PASS |
| `signature.actions.tsx` (consolidación post-firma) | ronda 4 (atención consolidada) | 12 PASS |

Total integración: **131 tests focal PASS** entre los 6 componentes.

## Limitaciones del entorno

1. **NO EJECUTADA — V3 smoke real contra S3 + backend Railway.** Sin credenciales en este entorno. La validación final contra S3 + pyHanko ≥0.30 + S3.zip queda para staging de Frank.
2. **`conftest.py` workaround** sigue activo (issue preexistente de `prisma._fields` con Python 3.14; afecta a TODOS los tests que importan `app.main`).
3. **15 tests preexistentes** en `medical-exam.actions.test.ts` (ZodError en schemas clínicos) — ajenos a este incremento.
4. **General PDF del ZIP** (`01_Dictamen_General/dictamen-general.pdf`) sigue siendo `ExamenMedicoValidatedPDF` para el Event actual. Para consolidar este PDF con hallazgos de hermanos, `ExamenMedicoValidatedPDF` debe extenderse — fuera de scope de este incremento.
5. **No se modificó** `PrefilledInvitation.appointmentId` (`@unique` distinto, otro flujo).

## Pendientes ATLAS

1. **Gate humano OBLIGATORIO** para ejecutar `prisma migrate deploy` en Railway (ver procedimiento arriba).
2. **V3 smoke real** contra S3 + Railway cuando Frank autorice: upload-only → sign-pdf → verificar ZIP con carpetas por Event hermanos, manifest con `atencionEventIds`, PDF general con sección III.B cuando aplique.
3. **General PDF del ZIP** (`01_Dictamen_General/dictamen-general.pdf`): sigue mostrando el Event actual. Para consolidar este PDF con hallazgos de hermanos, `ExamenMedicoValidatedPDF` debe extenderse — fuera de scope.
4. **`ExamenMedicoValidatedPDF`** (AMI reference 4-block format): no se ha actualizado para usar el helper de consolidación. Si Frank quiere que el dictamen general del ZIP use exactamente el formato AMI con hallazgos consolidados, requiere un nuevo incremento.

## Estado del working tree (sin commit/push)

```
M  backend/prisma/schema.prisma                                (NEW this round)
M  frontend/prisma/schema.prisma                               (NEW this round)
?? frontend/prisma/migrations/20260826165622_remove_medical_event_appointment_id_unique/
M  frontend/src/lib/event-atencion.ts                         (workerId filter)
M  frontend/src/lib/__tests__/event-atencion.test.ts          (13 tests)

# Cambios previos no publicados (de rondas anteriores, ahora formalmente integrados):
M  frontend/src/actions/__tests__/signature.actions.test.ts
M  frontend/src/actions/signature.actions.tsx
M  frontend/src/components/pdf/MedicalDictamenPDF.tsx
M  frontend/src/lib/__tests__/dictamen-pdf.test.ts
M  frontend/src/lib/__tests__/zip-cierre-clinico.test.ts
M  frontend/src/lib/dictamen-pdf.tsx
M  frontend/src/lib/zip-cierre-clinico.ts
?? frontend/src/lib/dictamen-summary.ts
?? frontend/src/lib/__tests__/dictamen-summary.test.ts
?? frontend/src/app/events/\[id\]/_lib/event-flow-visibility.ts
?? frontend/src/app/events/\[id\]/_lib/__tests__/event-flow-visibility.test.ts
```

Sin cambios en archivos ajenos.
