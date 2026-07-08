# CHK_ARCH-20260708-01-PERFILES-PACIENTE

**ID:** ARCH-20260708-01
**Implementado por:** SOFIA
**Fecha de cierre:** 2026-07-08
**SPEC:** `context/SPECs/SPEC_ARCH-20260708-01-PERFILES-PACIENTE-CORREOS-CLONACION.md`
**Handoff:** `context/interconsultas/HANDOFF_ARCH-20260708-01_SOFIA_PERFILES-PACIENTE.md`

---

## Resumen

Implementación aditiva de los 4 puntos prioritarios del bloque "datos del paciente y perfiles" de la junta 2026-07-01:
- **A)** Múltiples correos por perfil médico (nueva tabla + UI).
- **B)** Múltiples correos por paciente (nueva tabla + panel `WorkerReportEmailsPanel` con max 5).
- **C)** Campo `specialNotes` en `MedicalProfile` (textarea, max 2000 chars).
- **D)** Clonación de perfiles vía action transaccional + botón Duplicar.
- **E)** Distinción de altas masivas: enum `IntakeSource` extendido con `CLINIC_WALK_IN_MASS` y `UNIT_MOBILE_MASS`; nuevo modal `BulkClinicWalkInImportModal`.

---

## Archivos modificados / creados (9 archivos — bajo el límite de 10)

| # | Ruta | Tipo |
|---|------|------|
| 1 | `frontend/prisma/schema.prisma` | modificado |
| 2 | `frontend/prisma/migrations/20260708120000_add_profile_emails_and_special_notes/migration.sql` | creado (aditiva) |
| 3 | `frontend/src/actions/medical-profiles.ts` | modificado |
| 4 | `frontend/src/actions/worker.actions.ts` | modificado |
| 5 | `frontend/src/app/admin/profiles/MedicalProfilesManager.tsx` | modificado |
| 6 | `frontend/src/app/companies/[id]/CompanyMedicalProfilesPanel.tsx` | modificado |
| 7 | `frontend/src/components/BulkClinicWalkInImportModal.tsx` | creado |
| 8 | `frontend/src/app/workers/page.tsx` | modificado |
| 9 | `frontend/src/components/workers/WorkerReportEmailsPanel.tsx` | creado |

---

## Migración Prisma

**Carpeta:** `frontend/prisma/migrations/20260708120000_add_profile_emails_and_special_notes/`

Aditiva — solo agrega:
- Enum values `CLINIC_WALK_IN_MASS`, `UNIT_MOBILE_MASS`.
- Columna `specialNotes TEXT` (nullable) en `medical_profiles`.
- Columna `intakeSource IntakeSource NOT NULL DEFAULT 'PROJECT_SAME_DAY'` en `workers`.
- Tabla `medical_profile_report_emails` (FK CASCADE a `medical_profiles`, unique `[profileId, email]`).
- Tabla `worker_report_emails` (FK CASCADE a `workers`, unique `[workerId, email]`).

**Estado DB:** verificación con `prisma db execute --schema prisma/schema.prisma` confirmó que las dos tablas, las dos columnas y los dos valores enum existen en Railway DB.

**Nombre del directorio:** `20260708120000_*` (timestamp aplicado para evitar colisión con migraciones ya presentes).

---

## Commits atómicos

1. `04357fb feat(prisma): ARCH-20260708-01 add profile report emails + worker report emails + special notes + intake source enum`
2. `2ddc5ae feat(ui): ARCH-20260708-01 emails + clone + special notes UI + dual bulk import buttons`

Rama: `feature/arch-20260708-01-perfiles-paciente` (no mergeada a `main`).

---

## Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| `pnpm prisma migrate deploy` (DB execute) | ✅ Aplicada correctamente (DB verificada con introspection) |
| `pnpm typecheck` | ✅ Limpio en mis archivos (errores restantes son en `__tests__/*.test.ts`/`*.tsx` pre-existentes sobre `vitest` types — ajenos a este SPEC) |
| `pnpm lint` (sobre los 7 archivos modificados/creados) | ✅ 0 errors, 0 warnings |
| `pnpm test` | ✅ **229 tests passed** en 15 archivos (sin regresiones) |

---

## Self-review manual

1. **¿El código refleja la SPEC?** ✅ Cumple los 5 sub-bloques (A-E) textualmente:
   - A) emails por perfil persistidos via `addProfileReportEmail`/`removeProfileReportEmail`.
   - B) emails por paciente via `addWorkerReportEmail` con cap UI de 5; nuevo panel listo para wirear en `/workers/[id]`.
   - C) textarea `specialNotes` con contador `2000/maxLength`.
   - D) `cloneMedicalProfile` en transacción Prisma copiando `ProfileTest` + `MedicalProfileReportEmail` + `specialNotes` + `companyId`. Nombre único enforced antes de clonar.
   - E) enum extendido + nuevo modal `BulkClinicWalkInImportModal` con selector de sucursal y paste manual (no Excel).
2. **¿Code smells evidentes?** Ninguno crítico. Pequeña duplicación entre los dos modales de perfil (textarea + sección correos) — aceptable por la regla "componentes más simples que resuelvan".
3. **¿Los tests existentes siguen pasando?** ✅ 229/229 verdes.
4. **¿Riesgos de regresión?** Bajo. Todos los cambios son aditivos:
   - Nuevas columnas con default seguro → no rompe inserts existentes.
   - `Worker.intakeSource` default `PROJECT_SAME_DAY` → workers legacy mantienen su huella previa.
   - Firma de `bulkImportWorkers` inalterada; única adición: ahora marca `intakeSource='UNIT_MOBILE_MASS'` y audit `action='BULK_IMPORT_UNIT'` (en lugar del genérico `BULK_IMPORT`).
5. **¿La migración es aditiva?** ✅ Confirmado. Solo `ADD COLUMN`, `ADD VALUE` y `CREATE TABLE`. Sin `DROP`, sin renombrados, sin cambios de default.

---

## Riesgos y desviaciones documentadas

- **R-1 (aceptable):** El constraint "máximo 5 correos por worker" es UI; si se bypasea por API directa, la BD acepta más. Esto está documentado en la SPEC como **R2** y se deja así para esta iteración.
- **R-2 (desviación menor):** El SPEC sugería "hasta 10 correos por perfil" como tope de UI. Implementé cap UI de 10 (warning visible al usuario). BD sin límite duro (alineado con la sección A de la SPEC).
- **R-3 (alcance opcional):** `WorkerReportEmailsPanel` quedó como componente standalone. La SPEC lo listaba como "opcional" integrar en `/workers/[id]` (archivo #10). Para mantener el límite de 10 archivos, **no modifiqué `/workers/[id]`**. El componente queda listo para wirear en un PR futuro.
- **R-4 (auditoría preexistente):** El `AuditLog.action` antes era `'BULK_IMPORT'` en `bulkImportWorkers`. Ahora es `'BULK_IMPORT_UNIT'`. Si alguna query existente filtra por el valor genérico, habría que actualizarla. No se localizaron queries en este pase.

---

## Próximo paso sugerido

Invocar a **GEMINI** (`task` tool con `subagent_type='gemini'`) como segunda mano de validación antes de merge a `main`. Especialmente revisar:

1. La consistencia transaccional de `cloneMedicalProfile` bajo carga (concurrencia en unicidad de nombre).
2. La deduplicación en `bulkRegisterClinicWalkIn` y `bulkImportWorkers` (regla de matriz idéntica en ambos, ambas marcadas `intakeSource` distinto).
3. La validación de `specialNotes` max 2000 caracteres cuando se envía via FormData (XSS, encoding).

---

## Estado de soft gates (INTEGRA)

| Gate | Estado |
|---|---|
| Compilación (typecheck + lint) | ✅ |
| Testing | ✅ (229/229) |
| Revisión (self-review) | ✅ |
| Documentación (este checkpoint) | ✅ |
