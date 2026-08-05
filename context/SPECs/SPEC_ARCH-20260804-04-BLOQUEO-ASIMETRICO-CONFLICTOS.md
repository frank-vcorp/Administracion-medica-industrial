# SPEC: Bloqueo Asimétrico de Conflictos Proyecto ↔ Mantenimiento

**ID:** ARCH-20260804-04
**Fecha:** 2026-08-05
**Estado:** APROBADO PARA IMPLEMENTACIÓN (FASE 0 — handoff a SOFIA)
**Agente Autor:** INTEGRA
**Prioridad:** Alta — formaliza la regla de negocio asimétrica sobre la base de SPEC_ARCH-20260711-01 §3.1
**Puntaje INTEGRA:** (2×3) + (2×2) - (1×0.5) = **9.5**
*(Valor=2: formaliza regla ya implementada de facto | Urgencia=3: Frank lo aprobó explícito 2026-08-05 | Complejidad=2: guards + UX + tests)*

**SPECs relacionadas:**
- Base: `context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md` **§3.1** (disponibilidad de unidades).
- Visual/vinculación: `context/SPECs/SPEC_ARCH-20260804-03-CALENDARIO-MANTENIMIENTO-PARIDAD.md` (no se modifica).

**ADR asociado:** `context/decisions/ADR-20260804-04-BLOQUEO-ASIMETRICO-CONFLICTOS.md`.

---

## 1. Contexto y Problema

La SPEC base **§3.1** establece que una unidad móvil **no puede estar asignada a múltiples proyectos con fechas solapadas**, y exige validación al crear/editar proyecto con unidad asignada. La función `validateUnitAvailability` (`frontend/src/actions/project.actions.ts:478`) **ya detecta** dos clases de conflicto:

- `type: 'project'` — solapamiento con otro proyecto no cancelado (§3.1 canónica).
- `type: 'maintenance'` — mantenimiento PROGRAMADO/REPROGRAMADO en `[startDate, endDate]` (`project.actions.ts:510-517`).

`createProject` (`project.actions.ts:289`) y `updateProject` (`project.actions.ts:351`) **ya rechazan** (`success: false`) cuando `validateUnitAvailability` retorna `available: false`, sin distinguir la clase de conflicto. El error es genérico: `"La unidad ya tiene N asignación(es) en ese rango. Sugerencias: ..."` (`project.actions.ts:318-321` y `:393-396`).

En el lado mantenimiento, `createMaintenanceRecord` (`maintenance.actions.ts:131`) y `reprogramMaintenance` (`maintenance.actions.ts:231`) también consultan conflictos, devuelven alternativas (`suggestMaintenanceDates`), y el flujo UX de `MaintenanceCalendar` ofrece un `ReprogramModal` interactivo para elegir fecha alternativa y reintentar **sin abandonar el calendario de mantenimiento**.

### Problema formal

La asimetría de negocio **existe de facto** pero **no está codificada**:

1. No hay código de error que distinga "bloqueado por mantenimiento" de "bloqueado por otro proyecto".
2. El mensaje del lado proyecto no es legible (no lista tipo/fecha del mantenimiento ni nombre del proyecto conflictivo).
3. `validateUnitAvailability` descarta `scheduledDate` al construir `AvailabilityConflict` (`project.actions.ts:523-525` solo propaga `{ type, id, name: m.type }`), impidiendo mensajes con fecha.
4. `ProjectFormModal` muestra el error vía `setError(result.error ?? 'Error inesperado')` (`ProjectFormModal.tsx:160`) en un banner que **carece de `data-testid`**, por lo que no hay contrato e2e sobre el bloqueo.
5. No hay test e2e que verifique el bloqueo duro proyecto→mantenimiento.

Frank aprobó (2026-08-05) **formalizar la asimetría**: el lado proyecto queda como **bloqueo duro** con código + mensaje + banner testable; el lado mantenimiento **se preserva tal cual** (blando con `ReprogramModal`).

---

## 2. Regla de Negocio Asimétrica (formalización de §3.1)

> **R1 — Proyecto sobre mantenimiento (DURO):** Crear o editar un proyecto con `mobileUnitId` asignado tal que exista al menos un `MaintenanceRecord` con `status ∈ {PROGRAMADO, REPROGRAMADO}` y `scheduledDate ∈ [project.startDate, project.endDate]` **debe ser rechazado** por el server action con `success: false` y `errorCode: 'PROJECT_BLOCKED_BY_MAINTENANCE'`. No se persiste el proyecto.

> **R2 — Proyecto sobre proyecto (DURO, §3.1 canónica):** Crear o editar un proyecto con `mobileUnitId` tal que exista otro proyecto no cancelado con rango solapado **debe ser rechazado** con `errorCode: 'PROJECT_BLOCKED_BY_PROJECT'`. `updateProject` excluye el propio proyecto vía `excludeProjectId` (ya implementado en `project.actions.ts:389`).

> **R3 — Mantenimiento sobre proyecto (BLANDO, vigente — sin cambios):** Crear, editar o reprogramar un mantenimiento en una fecha con proyecto activo en la unidad **no se bloquea duro**. El action devuelve alternativas (`suggestMaintenanceDates`) y el flujo UX (`ReprogramModal` en `MaintenanceCalendar`) permite al operador elegir una fecha alternativa y reintentar **sin abandonar el calendario**. Este comportamiento **no se modifica** en esta SPEC; se documenta como el polo blando de la asimetría.

**Justificación de la asimetría (ver ADR §3):** proyecto = compromiso comercial con cliente, fechas pactadas, empleados asignados; reprogramar proyecto arrastra renegociación, re-logística y potencial penalización. Mantenimiento = mantenimiento técnico postergable; ya cuenta con UX de reproprogramación (`ReprogramModal` + `suggestMaintenanceDates`).

---

## 3. Tabla de Comportamiento Esperado por Acción

| Acción | Conflicto detectado | Comportamiento | `errorCode` | UX |
|---|---|---|---|---|
| `createProject` | mantenimiento en rango | **RECHAZA** (no persiste) | `PROJECT_BLOCKED_BY_MAINTENANCE` | banner `project-blocked-banner` en `ProjectFormModal`; **sin** modal de reprogramación in-form |
| `createProject` | otro proyecto solapado | **RECHAZA** (no persiste) | `PROJECT_BLOCKED_BY_PROJECT` | banner `project-blocked-banner` |
| `createProject` | sin conflicto | **CREA** | — | cierra modal, `onSuccess` |
| `updateProject` | mantenimiento en rango (excl. propio) | **RECHAZA** | `PROJECT_BLOCKED_BY_MAINTENANCE` | banner |
| `updateProject` | otro proyecto solapado (excl. propio) | **RECHAZA** | `PROJECT_BLOCKED_BY_PROJECT` | banner |
| `updateProject` | sin conflicto | **ACTUALIZA** | — | cierra modal, `onSuccess` |
| `createMaintenanceRecord` | proyecto activo en la fecha | **BLANDO** (devuelve alternativas) | — (vigente) | `ReprogramModal` con `suggestMaintenanceDates` (sin cambios) |
| `updateMaintenanceRecord` | proyecto activo (si cambia fecha) | **BLANDO** | — (vigente) | sin cambios |
| `reprogramMaintenance` | proyecto activo en nueva fecha | **BLANDO** (devuelve alternativas) | — (vigente) | `ReprogramModal` (sin cambios) |

**Precedencia de código:** si un mismo rango presenta conflictos `project` **Y** `maintenance`, el `errorCode` devuelto es `PROJECT_BLOCKED_BY_MAINTENANCE` (prioriza la señal accionable: el operador puede reprogramar el mantenimiento). El mensaje lista **ambos** conflictos.

---

## 4. Contrato de Actions (extensión aditiva, no rompe contrato)

### 4.1 Tipo de retorno extendido (aditivo)

`createProject` y `updateProject` añaden campos opcionales **no rompiendo contrato**:

```ts
type ProjectActionResult = {
  success: boolean
  project?: { id: string; name: string }   // solo createProject
  error?: string                            // mensaje legible en español
  errorCode?: 'PROJECT_BLOCKED_BY_MAINTENANCE' | 'PROJECT_BLOCKED_BY_PROJECT'
  conflicts?: AvailabilityConflict[]         // opcional, para UX futura
}
```

`ProjectFormModal.tsx:151` anota el `result` como `{ success: boolean; error?: string; project?: ... }`; debe extenderse para incluir `errorCode?` (y opcionalmente `conflicts?`).

### 4.2 `AvailabilityConflict` (extensión opcional aditiva)

Shape vigente (`project.actions.ts:462`):
```ts
{ type: 'project' | 'maintenance'; id: string; name?: string | null }
```

Para producir mensajes legibles con fecha de mantenimiento, **se permite** (recomendado) extender con:
```ts
{ type: 'project' | 'maintenance'; id: string; name?: string | null; dateISO?: string; maintenanceType?: string }
```
Poblado en `validateUnitAvailability` cuando `type === 'maintenance'` (la query `project.actions.ts:516` ya selecciona `scheduledDate` y `type` — basta propagarlos al conflict en `:523-525`). Es aditivo y no rompe consumidores actuales.

### 4.3 Helper `summarizeConflicts`

**Archivo:** `frontend/src/lib/calendar-utils.ts` (ya existe, 106 líneas, creado en ARCH-20260804-03).

**Firma:**
```ts
export function summarizeConflicts(conflicts: AvailabilityConflict[]): string
```

Produce un string legible en español, **máximo 3 elementos** + `+N más` si excede. Formato esperado:
- Mantenimientos: `"Mantenimiento {maintenanceType} el {dateISO}"`.
- Proyectos: `"Proyecto «{name}»"`.

Importar el tipo `AvailabilityConflict` con `import type` desde `@/actions/project.actions` para evitar cycle (`project.actions.ts` es `'use server'`). Si hay cycle, extraer el tipo a `frontend/src/types/availability.ts` (archivo buffer §10) e importar desde ambos.

### 4.4 Mensajes de error ( español, legibles )

`createProject` y `updateProject`, al rechazar, construyen el mensaje así:

- Mantenimiento (R1):
  > `"No se puede {crear|actualizar} el proyecto: la unidad tiene mantenimiento programado en este rango. {summarizeConflicts(maintenanceConflicts)}. Reprograme el mantenimiento o elija otra unidad/fechas. Alternativas: {suggestions}."`
- Proyecto (R2):
  > `"No se puede {crear|actualizar} el proyecto: la unidad ya tiene otro proyecto en este rango. {summarizeConflicts(projectConflicts)}. Alternativas: {suggestions}."`

`{suggestions}` = `availability.suggestions.map(s => s.label).join(', ')` o `"ninguna"`. Si hay conflictos mixtos, el mensaje combina ambas secciones y el `errorCode` es `PROJECT_BLOCKED_BY_MAINTENANCE` (precedencia §3).

---

## 5. UX — `ProjectFormModal`

### 5.1 Banner de bloqueo

`ProjectFormModal.tsx` ya mantiene estado `error` y lo setea con `setError(result.error ?? 'Error inesperado')` (`ProjectFormModal.tsx:160`). El banner existe (rojo, vigente).

**Requisito:** el elemento del banner que renderiza `error` debe llevar `data-testid="project-blocked-banner"` cuando `error` esté presente. SOFIA localiza el JSX del banner (buscar `error &&` en el render post-`return (`, `ProjectFormModal.tsx:173+`) y añade el atributo.

### 5.2 Estilo (preservar existente)

Mantener el estilo rojo vigente del banner. No se exige estilo diferenciado por `errorCode` en esta SPEC (mejora futura). Si SOFIA añade variación cromática por `errorCode`, es opcional y fuera del DoD.

### 5.3 Sin modal de reprogramación in-form

**Prohibido** añadir un `ReprogramProjectModal` o equivalente dentro de `ProjectFormModal`. La asimetría (§2) exige que el operador resuelva el conflicto **fuera** del form: cambiar fechas/unidad, o ir a `/admin/mobile-units/{id}/maintenance` a reprogramar el mantenimiento. Las sugerencias van en el mensaje del banner (informativas, no interactivas).

---

## 6. data-testids

### 6.1 A añadir

| testid | Ubicación | Cuándo visible |
|---|---|---|
| `project-blocked-banner` | Banner de `error` en `ProjectFormModal` | cuando `result.success === false` y `error` no vacío |

### 6.2 A preservar (no romper)

- `mobile-unit-selector` — selector de unidad en `ProjectFormModal` (TC-3).
- `unit-conflict` — indicador **client-side** de conflicto en `ProjectFormModal` (TC-3 afirma `not.toBeVisible()` en happy path).
- `name-input` (proyecto), campos `getByLabel('Inicio *')`/`('Fin *')` — usados por TC-3.
- Todos los de `MaintenanceCalendar` (`schedule-button`, `schedule-date`, `schedule-description`, `event-*`, `confirm-reprogram`, `confirm-complete`) — sin cambios (SPEC ARCH-20260804-03).

**Distinción crítica:** `unit-conflict` es feedback client-side **previo** al submit. `project-blocked-banner` es el rechazo **server-side posterior** al submit. No mezclar.

---

## 7. Tests E2E (`frontend/tests/mobile-units.spec.ts`)

### 7.1 TC-3 actualizado (línea 60)

`test('3. Asignar unidad a proyecto (selector con validación)')`:
- Mantener flujo vigente (relleno + select + `unit-conflict` no visible).
- **Añadir aserción negativa:** `project-blocked-banner` **no** visible en happy path (tras select, previo a submit).
- (Opcional pero recomendada) aserción positiva: tras submit en happy path, el banner sigue ausente y el modal cierra/`onSuccess`.

### 7.2 TC-7 nuevo — "Bloqueo asimétrico: proyecto sobre mantenimiento es rechazado"

```ts
test('7. Bloqueo asimétrico: proyecto sobre mantenimiento es rechazado (§3.1, ARCH-20260804-04)', async ({ page }) => {
  // Setup: garantizar un MaintenanceRecord PROGRAMADO en unidad + fecha conocidos.
  //   Preferencia: beforeEach dedicado o API/seed directo a la DB de test.
  //   NO depender del estado residual de TC-4 (fragilidad).
  //   SOFIA decide la estrategia de aislamiento según el framework de test.

  // 1. Ir a /projects/new
  // 2. Rellenar proyecto con rango que CONTENGA la fecha del mantenimiento del setup
  // 3. Seleccionar la MISMA unidad (mobile-unit-selector)
  // 4. Submit (localizar botón submit del ProjectFormModal; preservar selector existente)

  await expect(page.getByTestId('project-blocked-banner')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('project-blocked-banner')).toContainText(/mantenimiento/i)
  // Aserción opcional: el modal sigue abierto (header "Nuevo Proyecto de Visita Médica" visible)
})
```

**Aislamiento:** SOFIA garantiza que el mantenimiento pre-exista o lo crea en setup dedicado. **No** introducir dependencia frágil entre tests.

### 7.3 Sin cambios en TC-4, TC-5, TC-6

TC-4 (línea 71, mantenimiento sobre proyecto, polo blando) **se preserva**: confirma que la creación de mantenimiento con conflicto ofrece alternativas, no que se bloquee duro. Es la contracara viva de la asimetría.

---

## 8. Definition of Done (criterios verificables)

1. `createProject` rechaza con `errorCode: 'PROJECT_BLOCKED_BY_MAINTENANCE'` cuando `validateUnitAvailability` retorna al menos un conflicto `type === 'maintenance'`.
2. `updateProject` idem, con `excludeProjectId` para no chocar consigo mismo (comportamiento vigente preservado).
3. `createProject`/`updateProject` rechazan con `errorCode: 'PROJECT_BLOCKED_BY_PROJECT'` cuando solo hay conflictos `type === 'project'`.
4. El mensaje de error (`error`) está en español, lista los conflictos vía `summarizeConflicts` e incluye sugerencias.
5. `summarizeConflicts(conflicts)` existe en `frontend/src/lib/calendar-utils.ts` con la firma §4.3 y trunca a 3 + `+N más`.
6. `ProjectFormModal` renderiza el banner con `data-testid="project-blocked-banner"` cuando `error` no vacío.
7. `ProjectFormModal` **no** introduce modal de reprogramación in-form (§5.3).
8. TC-3 actualizado con aserción negativa de `project-blocked-banner` en happy path.
9. TC-7 nuevo (bloqueo duro proyecto→mantenimiento) pasa: `project-blocked-banner` visible y contiene "mantenimiento" (case-insensitive).
10. TC-4, TC-5, TC-6 sin regresiones (polo blando preservado).
11. `createMaintenanceRecord`/`updateMaintenanceRecord`/`reprogramMaintenance` **sin cambios** (R3: polo blando vigente).
12. `npx tsc --noEmit` pasa con 0 errores.
13. `npx vitest run` pasa sin regresiones (baseline 388 tests; TC-7 suma 1 → 389 esperados).
14. GEMINI auditoría (`subagent_type='gemini'`) sin bloqueadores.

---

## 9. Restricciones (innegociables)

1. **NO** tocar `middleware`, `auth`, schema Prisma ni migraciones.
2. **NO** tocar endpoints FastAPI.
3. **NO** tocar `frontend/src/app/admin/mobile-units/**`, `frontend/src/app/operations/mobile-units/**`, ni `MaintenanceCalendar.tsx`, ni `ProjectsCalendar.tsx`, ni `maintenance.actions.ts` (ámbito de ARCH-20260804-03 y módulos ya alineados).
4. **NO** introducir librería nueva.
5. **NO** commitear ni pushear sin OK explícito de INTEGRA/Frank.
6. Máximo 5 archivos tocados (ver §10). Si se requiere un 6°, devolver `BLOQUEO DE CONTEXTO` antes de expandir.
7. **NO** modificar `PROYECTO.md` (lo hace CRONISTA vía handoff separado).
8. Si surge ambigüedad de contrato, detenerse y devolver `BLOQUEO DE CONTEXTO`.

---

## 10. Archivos a Tocar (máx 5)

### Modificados (4)
1. `frontend/src/actions/project.actions.ts` — guards en `createProject`/`updateProject` con `errorCode`, mensaje legible vía `summarizeConflicts`; posible extensión de `AvailabilityConflict` (§4.2, recomendada).
2. `frontend/src/components/ProjectFormModal.tsx` — extender anotación de tipo del `result` (§4.1) y añadir `data-testid="project-blocked-banner"` al banner de `error` (§5.1).
3. `frontend/src/lib/calendar-utils.ts` — añadir helper `summarizeConflicts` (§4.3). Importar tipo `AvailabilityConflict` con `import type`.
4. `frontend/tests/mobile-units.spec.ts` — TC-3 actualizado (§7.1) + TC-7 nuevo (§7.2).

### Buffer (1, solo si SOFIA lo justifica)
5. `frontend/src/types/availability.ts` (nuevo) — solo si extraer el tipo `AvailabilityConflict` a un módulo compartido evita cycle import entre `project.actions.ts` (`'use server'`) y `calendar-utils.ts`. Si no hay cycle, **no** crear archivo 5.

### No modificables
- `frontend/src/actions/maintenance.actions.ts` (polo blando, R3).
- `frontend/src/components/mobile-units/MaintenanceCalendar.tsx`, `ProjectsCalendar.tsx`, page wrappers.
- `PROYECTO.md`, ADR (lo redacta INTEGRA), SPEC base.

---

## 11. Riesgos y Mitigaciones

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Cycle import entre `calendar-utils.ts` y `project.actions.ts` (`'use server'`) | Media | `calendar-utils.ts` no es server action; usar `import type { AvailabilityConflict }`. Si persiste, extraer tipo a archivo 5 (buffer §10). |
| TC-7 frágil por dependencia de estado con TC-4 | Media | SOFIA crea el mantenimiento en setup dedicado (`beforeEach` o API directa), no depende de TC-4. |
| `AvailabilityConflict` sin `dateISO` produce mensaje poco legible | Baja | Extender tipo (§4.2) en el mismo pase de `validateUnitAvailability`; la query ya selecciona `scheduledDate`. |
| Mensaje largo rompe layout del banner | Baja | `summarizeConflicts` trunca a 3 + `+N más`; banner ya es multiline. |
| Regresión en TC-3 al añadir aserción negativa | Baja | Aserción negativa con `not.toBeVisible()` es no bloqueante si el banner no existe. |
| Botón submit sin testid establecido en TC-7 | Baja | Usar `getByRole('button', { name: /guardar|crear|enviar/i })` o el selector implícito de TC-3. |

---

## 12. Handoff a SOFIA

**Archivo:** `context/interconsultas/HANDOFF_ARCH-20260804-04_SOFIA_BLOQUEO-ASIMETRICO.md` (redactado por INTEGRA en esta Fase 0). Contiene: plan paso a paso (5 pasos), validaciones, data-testids, restricciones, y solicitud de revisión final a GEMINI.

---

*Generado por INTEGRA — ARCH-20260804-04 — 2026-08-05*
