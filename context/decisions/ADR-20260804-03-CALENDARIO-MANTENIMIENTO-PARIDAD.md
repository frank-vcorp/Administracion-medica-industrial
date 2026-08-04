# ADR-20260804-03 — Paridad visual y vinculación cruzada del Calendario de Mantenimiento con el Calendario de Proyectos

**Estado:** Aceptado
**Fecha:** 2026-08-04
**ID tarea:** IMPL-20260804-03-CALENDARIO-MANTENIMIENTO-PARIDAD
**Decisores:** Frank (product owner), ATLAS M3 (análisis previo), INTEGA (decisión arquitectónica)
**Spec afectada:** `context/SPECs/SPEC_ARCH-20260804-03-CALENDARIO-MANTENIMIENTO-PARIDAD.md` (nueva) y addendum a `SPEC_ARCH-20260711-01` §5.5
**ADRs previos relacionados:** `ADR-20260804-01` (unificación de rutas), `ADR-20260804-02` (alineación de estilo del catálogo)

## Contexto

El módulo de Unidades Móviles ya recibió dos refactor visuales (ADR-20260804-01 y 02) que alinearon catálogo, cards y modales con el sistema de diseño inferido de `/branches`. **El calendario de mantenimiento quedó fuera del alcance de ambos ADRs** y mantiene la UI legacy pre-sistema de diseño de `IMPL-20260711-01`:

- Header `text-2xl font-semibold` (vs `text-3xl font-black tracking-tight` vigente).
- Botón primario `bg-blue-600` (vs `bg-slate-900`).
- Grid `gap-1 border rounded-lg` con celdas `min-h-[100px] p-1` (vs `gap-2` + `min-h-44 rounded-2xl border p-3`).
- Modales `bg-black/40 backdrop` + `rounded-lg shadow-xl` (vs `bg-black/50 backdrop-blur-sm` + `rounded-xl shadow-2xl`).
- Inicio de semana en domingo (vs lunes de `ProjectsCalendar`).

En paralelo, Frank identificó tres gaps operativos:

1. El calendario de mantenimiento no muestra los proyectos que la unidad atiende en cada día, aunque la regla de negocio §3.1 (`validateUnitAvailability`/`checkMaintenanceConflicts`) ya detecta conflictos proyecto↔mantenimiento. El operador no ve el conflicto hasta que intenta programar y el action lo rechaza.
2. El calendario de proyectos no muestra qué mantenimientos tiene la unidad asignada a cada proyecto.
3. La edición de un lado no se refleja en el otro porque no hay `revalidatePath` cruzado.

## Decisión

**Refactor en 4 fases** que cierra las 4 brechas detectadas:

1. **Paridad visual** de `MaintenanceCalendar.tsx` con `ProjectsCalendar.tsx` (tokens, grid, modales, inicio de semana en lunes).
2. **Superposición** de project cards en el grid de mantenimiento (vinculación directa §3.1).
3. **Indicador visual de conflictos** proyecto↔mantenimiento (anillo rojo + badge ⚠️ + banner en `ReprogramModal`).
4. **Vinculación inversa**: `ProjectsCalendar` muestra badge 🔧 Mant. en pills de proyecto + `revalidatePath` cruzado en actions.

### Decisiones subsidiarias

- **Modales locales inline, NO migrar a `ProjectFormModal` pattern.** Los modales de mantenimiento (`Modal`, `ReprogramModal`, `CompleteModal`) se mantienen como componentes locales de `MaintenanceCalendar.tsx` con tokens modernizados. Razón: `ProjectFormModal` está acoplado a la entidad `Project` y su contexto de recepción/empresa; los modales de mantenimiento tienen lógica específica (verificar disponibilidad, sugerencias, completar con costo, próximo mantenimiento). Migrarlos a un patrón shared añadiría indirection sin ganar consistencia real.
- **Detección de conflicto visual es client-side, no reemplaza el dictamen server-side.** La regla §3.1 sigue siendo la fuente de verdad al crear/reprogramar; el indicador visual solo muestra el choque potencial en el grid para que el operador lo vea antes de intentarlo.
- **2 actions nuevos de solo lectura, aditivos.** `getProjectsByMobileUnit(unitId)` y `getMaintenancesByUnitIds(unitIds, statuses?)` no rompen contrato existente. El primero filtra por `mobileUnitId` y excluye `CANCELLED`; el segundo hace `IN` sobre `unitIds` para evitar N queries.
- **Tipos compartidos en archivo nuevo** `maintenance-calendar-types.ts` para no acoplar `MaintenanceCalendar` a `ProjectsCalendar` ni viceversa.
- **Inicio de semana en lunes.** Cambio de `firstDayOfWeek.getDay()` a `(firstDay.getDay() + 6) % 7` (paridad ProjectsCalendar). Validado contra tests e2e: TC-4 y TC-5 clican por `data-testid`, no por offset de grid.

## Por qué 4 fases y no incremental monolítico

Frank pidió explícitamente "4 fases". La justificación arquitectónica que respalda esa decisión:

1. **Aislamiento de regresión:** cada fase tiene riesgo de romper tests e2e (`mobile-units.spec.ts` TC-1..TC-6). Hacerlas gates separadas permite identificar en cuál fase se introdujo un fallo. Un monolito hace forense el debug.
2. **Fase 1 es cosmético puro:** si rompe algo, es solo tokens. Fácil de revertir.
3. **Fase 2 introduce el contrato de datos nuevo** (`getProjectsByMobileUnit` + props). Si el shape no cuaja, se detecta antes de apilar conflictos encima.
4. **Fase 3 depende de Fase 2** (necesita `unitProjects` en memoria para calcular conflictos). No tiene sentido mezclarlas.
5. **Fase 4 es la única que toca `ProjectsCalendar`** (las 3 primeras solo tocan `MaintenanceCalendar`). Aislar el riesgo del otro componente.

**Contra-argumento rechazado:** "4 fases = 4 gates = 4 invocaciones de Spark 1.1 caro". Falso: las 4 fases van en **un solo handoff a SOFIA**. SOFIA las ejecuta secuencialmente y reporta al final. SOFIA corre en M3 (ilimitado). El gateo es interno a SOFIA (valida antes de pasar a la siguiente fase), no requiere intervención de INTEGRA entre fases.

## Trade-offs

### Positivos

- Paridad visual completa entre los dos calendarios operativos del dominio.
- El operador ve conflictos antes de intentarlo (ahorra clicks fallidos al action).
- Vinculación bidireccional: desde proyecto → calendario de la unidad, desde mantenimiento → editar proyecto.
- `revalidatePath` cruzado elimina estado stale entre las dos superficies.
- 2 actions nuevos son reutilizables para futuras vistas (dashboard, reportes).
- Cobertura e2e futura habilitada con nuevos testids (`maintenance-badge`, `conflict-badge`, `unit-projects-toggle`).

### Negativos

- **Saturación potencial de celdas** al mezclar mantenimientos + proyectos (3+ pills por día). Mitigación: `slice(0,3)` + `+N más` + toggle "Mostrar proyectos superpuestos" (SPEC §6.4).
- **Tests e2e actuales no cubren los nuevos badges** 🔧/⚠️. Mitigación: se añaden testids para futura cobertura; no se exigen tests nuevos en esta SPEC para no ampliar alcance.
- **`revalidatePath('/projects')` puede invalidar caché de ProjectsCalendar.** Mitigación: `/projects` ya es `force-dynamic` (ver `projects/page.tsx` línea 11). No hay caché que romper.
- **Cambio de inicio de semana (Dom→Lun) puede confundir al operador acostumbrado.** Mitigación: paridad con ProjectsCalendar (que ya arranca en lunes y el operador lo usa). Consistencia gana sobre familiaridad.
- **Risk de cycle import** si `MaintenanceCalendar` importa `ProjectFormModal` y `ProjectsCalendar` también. Mitigación: `ProjectFormModal` ya es independiente; si aparece cycle, mover `ProjectForEdit` al archivo de tipos compartidos.

## Cambios Concretos

### Archivos nuevos (3)
- `frontend/src/components/mobile-units/maintenance-calendar-types.ts` — tipos `UnitProjectItem`, `UnitMaintenanceItem`, `CalendarConflict`.
- `frontend/src/lib/calendar-utils.ts` — helpers compartidos (`isProjectActiveOnDay`, `startOfGrid`, etc.) extraídos de ProjectsCalendar.
- `context/interconsultas/HANDOFF_ARCH-20260804-03_SOFIA_CALENDARIO-PARIDAD.md` — handoff.

### Archivos modificados (6)
- `frontend/src/components/mobile-units/MaintenanceCalendar.tsx` — Fases 1-3.
- `frontend/src/components/ProjectsCalendar.tsx` — Fase 4 (badge 🔧 Mant.).
- `frontend/src/app/admin/mobile-units/[id]/maintenance/page.tsx` — pasar `unitProjects` + `unitName`.
- `frontend/src/app/projects/page.tsx` — obtener y pasar `unitMaintenances`.
- `frontend/src/actions/project.actions.ts` — nuevo `getProjectsByMobileUnit` + `revalidatePath` cruzado.
- `frontend/src/actions/maintenance.actions.ts` — nuevo `getMaintenancesByUnitIds` + `revalidatePath('/projects')`.

### No se tocan
- `frontend/tests/mobile-units.spec.ts` — sin cambios.
- `frontend/src/middleware.ts` — sin cambios.
- Schema Prisma, migraciones, endpoints FastAPI.

Total: 9 archivos (3 nuevos + 6 modificados).

## Validación

Específica de cada fase, gateada:

- **Fase 1:** `pnpm typecheck` 0 + `pnpm test` verde + `pnpm lint` 0 + TC-4/TC-5 pasan.
- **Fase 2:** mismas gates + verificación manual de superposición.
- **Fase 3:** mismas gates + verificación manual de anillo rojo + badge ⚠️.
- **Fase 4:** mismas gates +全套 TC-1..TC-6 pasan + GEMINI auditoría sin bloqueadores.

Baseline vitest: 388 tests (post ADR-20260804-02). No introducir regresiones.

## Reversibilidad

**Media-alta.** Cada fase es independiente y reversible:

1. **Fase 1 (tokens):** revertir `MaintenanceCalendar.tsx` desde git restaura UI legacy. No toca actions ni otros componentes.
2. **Fase 2 (superposición):** quitar prop `unitProjects` de `MaintenanceCalendar` + quitar llamada en page wrapper. Action `getProjectsByMobileUnit` queda huérfano pero no rompe nada.
3. **Fase 3 (conflictos):** quitar cálculo client-side de conflictos. No toca actions.
4. **Fase 4 (vinculación inversa):** quitar prop `unitMaintenances` de `ProjectsCalendar` + quitar `revalidatePath('/projects')` en `maintenance.actions.ts` + quitar `revalidatePath('/admin/mobile-units/.../maintenance')` en `project.actions.ts`. Action `getMaintenancesByUnitIds` queda huérfano.

Las 2 actions nuevos son aditivos; pueden eliminarse sin tocar contrato existente. Los tipos compartidos pueden eliminarse una vez eliminados sus consumidores.

## Referencias

- SPEC: `context/SPECs/SPEC_ARCH-20260804-03-CALENDARIO-MANTENIMIENTO-PARIDAD.md`
- SPEC base: `context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md` §3.1 (conflictos) y §5.5 (calendario mantenimiento)
- SPEC calendario proyectos: `context/SPECs/SPEC_ARCH-20260519-16-CALENDARIO-PROYECTOS-VISITAS.md`
- ADR previo unificación rutas: `context/decisions/ADR-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES.md`
- ADR previo alineación estilo: `context/decisions/ADR-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS.md`
- Componentes canónicos: `frontend/src/components/ProjectsCalendar.tsx` (referencia visual), `frontend/src/components/mobile-units/MaintenanceCalendar.tsx` (refactor target)
- Actions: `frontend/src/actions/maintenance.actions.ts`, `frontend/src/actions/project.actions.ts`
- Tests e2e: `frontend/tests/mobile-units.spec.ts` TC-4 (conflicto) y TC-5 (reprogramar)
- Discusión original: chat 2026-08-04 con Frank (solicitudes explícitas 1-4)
