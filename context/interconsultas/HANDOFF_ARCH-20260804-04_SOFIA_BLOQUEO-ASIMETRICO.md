# Handoff a SOFIA — Bloqueo Asimétrico de Conflictos Proyecto ↔ Mantenimiento

**ID Handoff:** HANDOFF_ARCH-20260804-04
**Tarea origen:** IMPL-20260804-04-BLOQUEO-ASIMETRICO-CONFLICTOS
**Emitido por:** INTEGRA
**Fecha:** 2026-08-05
**SPEC:** `context/SPECs/SPEC_ARCH-20260804-04-BLOQUEO-ASIMETRICO-CONFLICTOS.md`
**ADR:** `context/decisions/ADR-20260804-04-BLOQUEO-ASIMETRICO-CONFLICTOS.md`
**Modelo destino:** `minimax-coding-plan/MiniMax-M3` (ilimitado).

---

## 0. Resumen ejecutivo

Formalizar el **bloqueo duro** al crear/editar un **proyecto** sobre una unidad con **mantenimiento PROGRAMADO/REPROGRAMADO** en el rango. El polo **mantenimiento** queda **sin cambios** (blando, con `ReprogramModal`). Delta: códigos de error (`errorCode`), mensaje legible vía `summarizeConflicts`, banner con `data-testid`, helper en `calendar-utils.ts`, 2 tests e2e (TC-3 actualizado + TC-7 nuevo).

**No es trabajo grande: el bloqueo ya existe de facto** (`validateUnitAvailability` + guards en `createProject`/`updateProject`, `project.actions.ts:308-323` y `:372-400`). Esta tarea lo **codifica** (errorCode + mensaje legible + testid + tests).

---

## 1. Alcance (máx 5 archivos)

### Modificados (4)
1. `frontend/src/actions/project.actions.ts`
2. `frontend/src/components/ProjectFormModal.tsx`
3. `frontend/src/lib/calendar-utils.ts`
4. `frontend/tests/mobile-units.spec.ts`

### Buffer (1, solo si justificado)
5. `frontend/src/types/availability.ts` (nuevo) — solo si hay cycle import entre `calendar-utils.ts` y `project.actions.ts` por el tipo `AvailabilityConflict`. Si no hay cycle, **no crear**.

### Prohibido tocar
- `frontend/src/actions/maintenance.actions.ts` (polo blando, R3).
- `frontend/src/components/mobile-units/MaintenanceCalendar.tsx`, `frontend/src/components/ProjectsCalendar.tsx`.
- `frontend/src/app/admin/mobile-units/**`, `frontend/src/app/operations/mobile-units/**`, `frontend/src/app/projects/**`.
- `middleware.ts`, `schema.prisma`, migraciones, backend FastAPI.
- `PROYECTO.md`, SPEC, ADR.

---

## 2. Plan de Implementación (5 pasos)

### Paso 1 — Guard en `createProject`

Archivo: `frontend/src/actions/project.actions.ts`, función `createProject` (línea 289).

**Hoy (líneas 308-323):** valida con `validateUnitAvailability` y devuelve error genérico `"La unidad ya tiene N asignación(es)..."`.

**Delta:**
- Tras `if (!availability.available)`, clasificar conflictos:
  - `hasMaintenance = availability.conflicts.some(c => c.type === 'maintenance')`
  - `hasProject = availability.conflicts.some(c => c.type === 'project')`
- `errorCode = hasMaintenance ? 'PROJECT_BLOCKED_BY_MAINTENANCE' : 'PROJECT_BLOCKED_BY_PROJECT'` (precedencia: mantenimiento gana si está presente, SPEC §3).
- Construir mensaje con `summarizeConflicts(availability.conflicts)` (helper paso 4) + `availability.suggestions.map(s => s.label).join(', ') || 'ninguna'` (SPEC §4.4).
- Retornar `{ success: false, error: mensaje, errorCode, conflicts: availability.conflicts }`.

### Paso 2 — Guard en `updateProject`

Misma función, línea 351. **Preservar `excludeProjectId`** (línea 389) para no chocar consigo mismo.

Misma lógica de clasificación + `errorCode` + mensaje + `conflicts`. Retornar shape extendido (`{ success, error?, errorCode?, conflicts? }`).

### Paso 3 — Tipo y mensaje

- **Extender anotación del return type** de `createProject` (línea 297) y `updateProject` (línea 361) con `errorCode?: 'PROJECT_BLOCKED_BY_MAINTENANCE' | 'PROJECT_BLOCKED_BY_PROJECT'` y `conflicts?: AvailabilityConflict[]` (aditivo, no rompe callers).
- **(Recomendado, SPEC §4.2)** Extender `AvailabilityConflict` (línea 462) con `dateISO?: string` y `maintenanceType?: string` para mensajes legibles. Poblar en `validateUnitAvailability` cuando `type === 'maintenance'` (líneas 510-517 ya seleccionan `scheduledDate` y `type` — propagarlos al conflict en `:523-525`).
- Mensajes en español (SPEC §4.4). Usar `summarizeConflicts`.

### Paso 4 — Helper `summarizeConflicts`

Archivo: `frontend/src/lib/calendar-utils.ts` (ya existe, 106 líneas).

**Firma (SPEC §4.3):**
```ts
export function summarizeConflicts(conflicts: AvailabilityConflict[]): string
```

- Importar tipo `AvailabilityConflict` desde `@/actions/project.actions` con `import type` (evitar cycle — `project.actions.ts` es `'use server'`).
- Si hay cycle: extraer `AvailabilityConflict` a `frontend/src/types/availability.ts` (archivo 5, buffer) e importar desde ambos.
- Salida: string español, **máx 3 elementos** + `+N más` si excede.
  - Mantenimientos: `"Mantenimiento {maintenanceType} el {dateISO}"`.
  - Proyectos: `"Proyecto «{name}»"`.
- Mezcla ambos tipos en el orden en que vengan; separar por `; ` o coma.

### Paso 5 — UX en `ProjectFormModal`

Archivo: `frontend/src/components/ProjectFormModal.tsx`.

- **Línea 151:** extender anotación del `result` para incluir `errorCode?` y `conflicts?`:
  ```ts
  let result: { success: boolean; error?: string; project?: { id: string; name: string }; errorCode?: string; conflicts?: AvailabilityConflict[] }
  ```
- **Banner:** localizar el JSX que renderiza `error` (buscar `error &&` tras `return (` en línea 173+). Añadir `data-testid="project-blocked-banner"` al contenedor del banner. **Preservar** estilo rojo vigente.
- **Prohibido** añadir `ReprogramProjectModal` o cualquier modal de reprogramación in-form (SPEC §5.3).
- El `result.error` ya se setea en `setError(result.error ?? 'Error inesperado')` (línea 160). El banner ya existe; solo añadir el testid.

---

## 3. Tests E2E (`frontend/tests/mobile-units.spec.ts`)

### TC-3 actualizado (línea 60)

`test('3. Asignar unidad a proyecto (selector con validación)')`:
- Mantener flujo vigente.
- **Añadir:** `await expect(page.getByTestId('project-blocked-banner')).not.toBeVisible({ timeout: 3000 })` en happy path (previo o tras select, antes de submit).
- (Opcional) aserción de cierre/éxito tras submit.

### TC-7 nuevo (añadir al final del `describe`)

```ts
test('7. Bloqueo asimétrico: proyecto sobre mantenimiento es rechazado (§3.1, ARCH-20260804-04)', async ({ page }) => {
  // Setup: garantizar mantenimiento PROGRAMADO en unidad + fecha conocidos.
  //   Preferencia: beforeEach dedicado o API/seed directo (NO depender de TC-4).
  //   SOFIA decide estrategia de aislamiento.

  await page.goto(`${BASE}/projects/new`)
  await page.getByLabel('Nombre *').fill('Proyecto Bloqueo E2E')
  await page.getByLabel('Empresa *').selectOption({ index: 1 })
  // Rango que CONTENGA la fecha del mantenimiento del setup:
  await page.getByLabel('Inicio *').fill('<fecha-setup>)
  await page.getByLabel('Fin *').fill('<fecha-setup>')
  await page.getByTestId('mobile-unit-selector').selectOption({ index: <unidad-setup> })

  // submit: localizar botón submit del ProjectFormModal (preservar selector existente)
  // ...click submit...

  await expect(page.getByTestId('project-blocked-banner')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('project-blocked-banner')).toContainText(/mantenimiento/i)
})
```

**Notas SOFIA:**
- El `unit-conflict` (testid vigente, TC-3 lo usa en `not.toBeVisible()`) es indicador **client-side previo** al submit. El bloqueo duro es **server-side posterior** al submit. No mezclar.
- Si el botón submit no tiene testid establecido, usar `getByRole('button', { name: /guardar|crear|enviar/i })` o el selector que TC-3 use implícitamente.

---

## 4. data-testids

### Añadir
- `project-blocked-banner` — banner de error en `ProjectFormModal` (cuando `error` no vacío).

### Preservar (no romper)
- `mobile-unit-selector`, `unit-conflict` (ProjectFormModal).
- `schedule-button`, `schedule-date`, `schedule-description`, `event-${id}`, `confirm-reprogram`, `confirm-complete` (MaintenanceCalendar, sin cambios).
- `name-input`, `units-table`, `new-unit-button`, `calendar-link`, `delete-${uuid}`.

---

## 5. Validaciones obligatorias antes de reportar como listo

```bash
cd frontend
npx tsc --noEmit
npx vitest run
# baseline esperado: 388 tests (sin regresiones; TC-7 suma 1 → 389 esperados)
```

Antes de marcar como listo, **NO** ejecutar `qodo` (sunset). En su lugar, incluir en el reporte final un **self-review manual**:
- ¿El código refleja la SPEC (errorCode, mensaje, testid, sin modal in-form)?
- ¿Hay code smells evidentes?
- ¿TC-7 cubre el edge case de bloqueo?
- ¿`summarizeConflicts` trunca a 3 + `+N más`?
- ¿Riesgo de regresión en TC-3/TC-4/TC-5/TC-6?

---

## 6. Restricciones innegociables

1. **NO** tocar middleware, schema Prisma, FastAPI.
2. **NO** tocar `MaintenanceCalendar.tsx`, `ProjectsCalendar.tsx`, `maintenance.actions.ts`, page wrappers `/admin/mobile-units/**`, `/operations/mobile-units/**`, `/projects/**`.
3. **NO** commitear ni pushear.
4. **NO** librería nueva.
5. Máx 5 archivos. Si necesitas 6, **detente y devuelve `BLOQUEO DE CONTEXTO`** antes de expandir.
6. **NO** añadir modal de reprogramación dentro de `ProjectFormModal` (SPEC §5.3).
7. **NO** modificar `PROYECTO.md`, SPEC, ADR.

---

## 7. Segunda mano de validación (GEMINI)

Al cerrar, **solicitar revisión final a GEMINI** vía `task` tool con `subagent_type='gemini'`. Pasar:
- Lista de archivos modificados.
- Resumen del delta (errorCode, helper, banner testid, tests).
- Salida de `npx tsc --noEmit` y `npx vitest run`.
- Pregunta específica: "¿El bloqueo asimétrico cumple SPEC ARCH-20260804-04 sin tocar el polo blando de `maintenance.actions.ts`?"

GEMINI es herramienta de validación, no autoridad. No cambia SPEC ni arquitectura.

---

## 8. Reporte final esperado (a INTEGRA)

- Archivos modificados (lista).
- Diff resumido por archivo.
- Salida de `tsc` y `vitest` (counts).
- Resultado del self-review manual.
- Resultado de la auditoría GEMINI.
- Cualquier desviación o `BLOQUEO DE CONTEXTO` detectado.

---

## 9. Escalación

- Si `validateUnitAvailability` no ofrece suficiente info para mensajes legibles y extender el tipo rompe otros consumers → `BLOQUEO DE CONTEXTO` con detalle.
- Si TC-7 no puede aislarse de TC-4 sin infraestructura nueva → `BLOQUEO DE CONTEXTO` con propuesta.
- Tras 2 intentos sin progreso → invocar DEBUGGER (`subagent_type='debugger'`) con este handoff + el error.

---

*Emitido por INTEGRA — 2026-08-05 — IMPL-20260804-04-BLOQUEO-ASIMETRICO-CONFLICTOS*
