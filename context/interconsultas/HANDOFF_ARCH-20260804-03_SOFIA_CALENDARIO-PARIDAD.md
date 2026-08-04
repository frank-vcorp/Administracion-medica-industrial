# HANDOFF a SOFIA — Paridad visual y vinculación cruzada del Calendario de Mantenimiento

**ID tarea:** IMPL-20260804-03-CALENDARIO-MANTENIMIENTO-PARIDAD
**De:** INTEGRA
**Para:** SOFIA
**Fecha:** 2026-08-04
**SPEC:** `context/SPECs/SPEC_ARCH-20260804-03-CALENDARIO-MANTENIMIENTO-PARIDAD.md`
**ADR:** `context/decisions/ADR-20260804-03-CALENDARIO-MANTENIMIENTO-PARIDAD.md`
**Modelo esperado:** MiniMax M3 (ilimitado). No requiere gateway.
**Estimación:** 6.5–8.5 h (4 fases gateadas).

---

## 0. Contexto ejecutivo

Frank detectó que `MaintenanceCalendar.tsx` (legacy IMPL-20260711-01) no tiene paridad visual con `ProjectsCalendar.tsx` (moderno IMPL-20260527-01), no muestra los proyectos de la unidad superpuestos, no marca conflictos visuales, y no hay vinculación inversa en `/projects`. Esta SPEC cierra las 4 brechas en 4 fases.

**Regla de coste (§14 INTEGRA):** tú eres el codificador. Yo NO escribí código. Todo lo que necesitas está en la SPEC + este handoff. Si algo falta, devuelve `BLOQUEO DE CONTEXTO` antes de improvisar.

---

## 1. Archivos a tocar (9 total)

### Nuevos (3)

1. `frontend/src/components/mobile-units/maintenance-calendar-types.ts`
   - Tipos: `UnitProjectItem`, `UnitMaintenanceItem`, `CalendarConflict`, `ProjectForEdit` (mover aquí si hay riesgo de cycle import al importar `ProjectFormModal`).
   - Solo tipos, sin lógica.

2. `frontend/src/lib/calendar-utils.ts`
   - Helpers extraídos de `ProjectsCalendar.tsx`: `toDate`, `startOfMonth`, `addMonths`, `addDays`, `startOfGrid` (con lunes), `isSameDay`, `isSameMonth`, `overlapsMonth`, `isProjectActiveOnDay`, `formatMonthLabel`, `formatRange`.
   - Decisiones: si al extraer rompes algún cierre de `ProjectsCalendar`, deja el helper como duplicado privado en `MaintenanceCalendar` y documenta por qué. Preferencia: extraer para reutilizar.

3. `context/interconsultas/HANDOFF_ARCH-20260804-03_SOFIA_CALENDARIO-PARIDAD.md`
   - Este archivo (ya creado por INTEGRA; no lo modifiques).

### Modificados (6)

4. `frontend/src/components/mobile-units/MaintenanceCalendar.tsx` (Fases 1-3)
5. `frontend/src/components/ProjectsCalendar.tsx` (Fase 4)
6. `frontend/src/app/admin/mobile-units/[id]/maintenance/page.tsx` (Fase 2)
7. `frontend/src/app/projects/page.tsx` (Fase 4)
8. `frontend/src/actions/project.actions.ts` (Fase 2 + Fase 4)
9. `frontend/src/actions/maintenance.actions.ts` (Fase 4)

### Límite: 9 archivos. Si necesitas abrir un décimo, devuelve `BLOQUEO DE CONTEXTO`.

---

## 2. Plan Fase 1 → 4 (gateado)

### FASE 1 — Refactor cosmético de MaintenanceCalendar (1.5–2 h)

**Objetivo:** alinear tokens visuales con ProjectsCalendar. Sin nueva lógica, sin superposición, sin conflictos todavía.

**Pasos:**

1. **Header interno:** quitar el `<h1>` y `<p>` internos del componente (ya existen en el page wrapper, línea 31-36 de `page.tsx`). El componente empieza directo con el contenedor `rounded-3xl border border-slate-200 bg-white p-5 shadow-sm`.
2. **Toggle Calendario/Lista:** reemplazar el botón único por toggle segmentado:
   - Contenedor: `inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm`.
   - Botón activo: `rounded-lg px-3 py-2 text-sm font-semibold bg-slate-900 text-white`.
   - Botón inactivo: `rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100`.
   - Labels: `Calendario` / `Lista`.
3. **Botones navegación mes:** cambiar `px-3 py-1.5 text-sm border rounded-md bg-white` por `rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50`. Quitar flechas `←`/`→`.
4. **Botón "+ Programar mantenimiento":** cambiar `bg-blue-600 text-white hover:bg-blue-700` por `bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg shadow font-medium`. **PRESERVAR `data-testid="schedule-button"`**.
5. **Mes label:** mostrar como `text-lg font-bold capitalize text-slate-900` con label arriba `text-xs font-semibold uppercase tracking-wide text-slate-400`.
6. **Leyenda colores:** reemplazar `TYPE_COLOR` legacy por `MAINTENANCE_TYPE_BADGES` modernizado:
   - PREVENTIVO: `border-emerald-200 bg-emerald-50 text-emerald-700`
   - CORRECTIVO: `border-red-200 bg-red-50 text-red-700`
   - VERIFICACION: `border-blue-200 bg-blue-50 text-blue-700`
   - LIMPIEZA: `border-violet-200 bg-violet-50 text-violet-700`
   - Pill de leyenda: `inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold`.
7. **Filtros + resumen:** envolver en grid `grid gap-3 md:grid-cols-2 xl:grid-cols-3`. Select: `min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none`. Label arriba `text-xs font-semibold uppercase tracking-wide text-slate-400`. Card resumen: `rounded-2xl bg-slate-50 px-4 py-3`.
   - Añadir filtro por estado de mantenimiento (PROGRAMADO/COMPLETADO/CANCELADO/REPROGRAMADO/Todos).
8. **Grid mensual:**
   - Headers weekday: contenedor `grid grid-cols-7 gap-2`; celda `rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500`.
   - Labels: `['Lun','Mar','Mie','Jue','Vie','Sab','Dom']` (cambiar de `['Dom'...'Sab']`).
   - **Cálculo startOfGrid:** cambiar `firstDayOfWeek.setDate(firstDayOfWeek.getDate() - firstDayOfWeek.getDay())` por offset `(firstDay.getDay() + 6) % 7` (paridad ProjectsCalendar). Si extraes helper a `calendar-utils.ts`, usarlo en ambos componentes.
   - Celdas: contenedor `grid grid-cols-1 gap-2 md:grid-cols-7`; celda `min-h-44 rounded-2xl border p-3` (mes actual `border-slate-200 bg-white`, otro `border-slate-100 bg-slate-50/80`, hoy `ring-2 ring-blue-200`).
   - Número día: `inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold` (hoy `bg-blue-600 text-white`, actual `bg-slate-100 text-slate-700`, otro `bg-slate-100 text-slate-400`).
   - Contador esquina sup. derecha: `text-[11px] font-semibold uppercase tracking-wide text-slate-400` con `{N} activos`.
   - Vacío: `rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400` con texto `Sin actividad`.
9. **Pill de evento mantenimiento:** cambiar `block w-full text-left p-1 rounded border-l-2 ${TYPE_COLOR}` por `w-full rounded-2xl border px-3 py-2 text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5 ${MAINTENANCE_TYPE_BADGES[r.type]}`. **PRESERVAR `data-testid="event-${r.id}"`**.
10. **Modales (Modal, ReprogramModal, CompleteModal):** aplicar tokens §5.10 de SPEC:
    - Backdrop: `fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4`.
    - Content: `bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg`.
    - Header h2: `text-lg font-bold`.
    - Botón ✕: `text-slate-400 hover:text-slate-600 text-sm`.
    - Inputs: `w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500`.
    - Labels: `text-xs text-slate-500 mb-1 block`.
    - Botón primario: `bg-purple-600 hover:bg-purple-700 text-white rounded shadow font-medium`.
    - Botón secundario: `border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-sm font-medium`.
    - Botón "Verificar disponibilidad" / "Buscar alternativas": `border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50`.
    - Sugerencias libres: `rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100`.
    - Banner info: `mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700`.
    - **PRESERVAR** `data-testid="schedule-date"`, `"schedule-description"`, `"confirm-reprogram"`, `"confirm-complete"`.

**Gate Fase 1:**
- `pnpm typecheck` → 0 errores.
- `pnpm test` (vitest run) → verde, sin regresiones vs baseline 388.
- `pnpm lint` → 0 errores en archivos tocados.
- Verificación manual: cargar `/admin/mobile-units/{id}/maintenance`, ver grid moderno, abrir modal crear, abrir reprogramar (si hay evento), abrir completar. Los testids siguen funcionando.

Si TC-4 o TC-5 fallan por el cambio de inicio de semana, **detente y devuelve `BLOQUEO DE CONTEXTO`** con evidencia (no deberían fallar: clican por `data-testid`).

---

### FASE 2 — Superposición de proyectos en grid de mantenimiento (2–2.5 h)

**Objetivo:** mostrar pills de proyecto superpuestas en el grid de mantenimiento de la unidad.

**Pasos:**

1. **Crear action `getProjectsByMobileUnit(unitId)`** en `project.actions.ts`:
   - Auth: `requireAdminOrReceptionist` (paridad con `getProjects`).
   - Query: `prisma.project.findMany({ where: { mobileUnitId: unitId, NOT: { status: 'CANCELLED' } }, include: { company: { select: { id: true, name: true } }, _count: { select: { workers: true } } }, orderBy: { startDate: 'desc' } })`.
   - Retornar el array directo.
2. **Crear `maintenance-calendar-types.ts`** con tipo `UnitProjectItem` matching el shape retornado.
3. **Modificar page wrapper** `/admin/mobile-units/[id]/maintenance/page.tsx`:
   - Importar `getProjectsByMobileUnit`.
   - Llamar junto a `getMaintenanceRecords(id)` (paralelizable con `Promise.all`).
   - Pasar props `unitProjects` y `unitName={unit.name}` a `<MaintenanceCalendar>`.
4. **Extender props de `MaintenanceCalendar`**:
   ```ts
   interface MaintenanceCalendarProps {
     unitId: string
     initialRecords: Maintenance[]
     unitProjects: UnitProjectItem[]  // NUEVO
     unitName: string                 // NUEVO
   }
   ```
5. **Render mezclado por día:**
   - Para cada día del grid, calcular `projectsOnDay = unitProjects.filter(p => isProjectActiveOnDay(p, day))`.
   - Mezclar `dayRecords` + `projectsOnDay` en un array, ordenados: mantenimientos primero, luego proyectos. Dentro de cada grupo, por fecha/hora.
   - Aplicar `slice(0,3)` y mostrar `+N más` si hay más.
6. **Pill de proyecto superpuesto:** usar `STATUS_BADGES` de ProjectsCalendar (importar o redefinir las constantes `STATUS_BADGES`, `STATUS_LABELS`, `STATUS_OPTIONS` en `maintenance-calendar-types.ts` o en `MaintenanceCalendar.tsx`). Clase base pill igual que mantenimiento pero con badge de proyecto:
   - `w-full rounded-2xl border px-3 py-2 text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5 ${STATUS_BADGES[project.status]}`.
   - Header: `line-clamp-2 font-semibold` con `project.name`.
   - Cuerpo: `project.company?.name ?? '— sin empresa —'` + `formatRange(project.startDate, project.endDate)`.
   - NO incluye botón de recepción (eso vive en `/projects`).
7. **Toggle "Mostrar proyectos superpuestos"** (default ON):
   - testid `unit-projects-toggle`.
   - Token: `inline-flex items-center gap-2 text-xs font-semibold text-slate-600` + checkbox `rounded border-slate-300`.
   - Cuando OFF, solo renderizar mantenimientos en el grid.
8. **Click en pill de proyecto:** abrir `ProjectFormModal` en modo edición:
   - Importar `ProjectFormModal` y `ProjectForEdit` en `MaintenanceCalendar.tsx`.
   - Si hay cycle import, mover `ProjectForEdit` a `maintenance-calendar-types.ts`.
   - Reutilizar el shape `toProjectForEdit` de ProjectsCalendar.
   - El modal se renderiza al final del componente, controlado por estado `editProject`/`editOpen`.
   - `ProjectFormModal` necesita props `companies`, `branches`. Pasar las empresas de los `unitProjects` (deducir) o hacer query mínima. Si requiere más, llama a `getCompanies()`/`getBranches()` desde el page wrapper y pasa por props. **Atajo:** si `ProjectFormModal` ya acepta edición con solo `projectToEdit`, omitir companies/branches (verificar firma vigente antes de decidir).

**Gate Fase 2:** typecheck + vitest + lint + TC-4/TC-5 pasan. Verificación manual: ver pills de proyecto superpuestas en el grid, click abre `ProjectFormModal`.

---

### FASE 3 — Indicador visual de conflictos (1–1.5 h)

**Objetivo:** marcar días con conflicto proyecto↔mantenimiento.

**Pasos:**

1. **Cálculo client-side de conflictos:** para cada día del grid, calcular `hasConflict = dayRecords.some(r => r.status === 'PROGRAMADO' || r.status === 'REPROGRAMADO') && projectsOnDay.length > 0`.
   - Construir array `conflicts: CalendarConflict[]` (tipo de `maintenance-calendar-types.ts`) para uso en resumen y en `ReprogramModal`.
2. **Tokens de conflicto en celda:**
   - Si `hasConflict`: añadir `ring-2 ring-red-400` a la celda (si también es hoy, predomina el rojo).
3. **Pill ⚠️ en celda:**
   - En la esquina superior derecha (junto al contador `{N} activos`), si `hasConflict`: pill `inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700` con texto `⚠️ Conflicto`.
   - testid `conflict-badge`.
4. **Ring en pills en conflicto:**
   - Pill de mantenimiento en conflicto: añadir `ring-2 ring-red-400 ring-offset-1`.
   - Pill de proyecto superpuesto en conflicto: añadir `ring-2 ring-red-400 ring-offset-1`.
5. **Banner en ReprogramModal:** cuando se abra `ReprogramModal` para un mantenimiento cuyo día está en conflicto, mostrar banner arriba del formulario: `mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700` con texto `Conflicto con proyecto {projectName} en esta fecha`.
6. **Métrica en resumen (§5.5):** añadir `{K} días con conflicto` al card de resumen, calculado client-side contando días del mes con `hasConflict`.

**Gate Fase 3:** typecheck + vitest + lint + TC-4/TC-5 pasan. Verificación manual: programar mantenimiento en fecha con proyecto superpuesto, ver anillo rojo + badge ⚠️ + ring en pills.

---

### FASE 4 — Vinculación inversa y revalidatePath cruzado (2–2.5 h)

**Objetivo:** ProjectsCalendar muestra badge de mantenimientos + revalidatePath cruzado.

**Pasos:**

1. **Crear action `getMaintenancesByUnitIds(unitIds, statuses?)`** en `maintenance.actions.ts`:
   - Auth: `requireAnyAuth` (paridad con `getMaintenanceRecords`).
   - Query: `prisma.maintenanceRecord.findMany({ where: { mobileUnitId: { in: unitIds }, ...(statuses ? { status: { in: statuses } } : {}) }, select: { id: true, mobileUnitId: true, type: true, status: true, scheduledDate: true, technician: true } })`.
   - Retornar array plano.
2. **Modificar `/projects/page.tsx`:**
   - Después de obtener `projects`, extraer `mobileUnitIds = [...new Set(projects.map(p => p.mobileUnit?.id).filter(Boolean))] as string[]`.
   - Si `mobileUnitIds.length > 0`, llamar `getMaintenancesByUnitIds(mobileUnitIds, ['PROGRAMADO','REPROGRAMADO'])`.
   - Pasar `unitMaintenances` como prop a `<ProjectsCalendar>`.
3. **Extender props de `ProjectsCalendar`:** añadir `unitMaintenances?: UnitMaintenanceItem[]`.
4. **Badge 🔧 Mant. en pill de proyecto:**
   - En cada pill de proyecto (dentro del render del día, en el bloque `visibleItems.map`), debajo del `formatRange`, calcular `maintenancesInRange = unitMaintenances?.filter(m => m.mobileUnitId === project.mobileUnit?.id && isMaintenanceInRange(m, project.startDate, project.endDate)) ?? []`.
   - Helper `isMaintenanceInRange(m, startDate, endDate)`: `toDate(m.scheduledDate) >= dayStart(toDate(startDate)) && toDate(m.scheduledDate) <= dayEnd(toDate(endDate))`.
   - Si `maintenancesInRange.length > 0`: pill `inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700` con texto `🔧 {N} mant.`.
   - testid `maintenance-badge`.
   - Click en la pill (no en la card de proyecto): `Link` a `/admin/mobile-units/${project.mobileUnit?.id}/maintenance`.
   - Si `maintenancesInRange.length === 0`, no renderizar nada.
5. **Toggle "Solo proyectos con mantenimiento"** (default OFF):
   - Token paridad §6.4.
   - Cuando ON, `filteredProjects` filtra además `project => maintenancesInRange.length > 0`.
6. **revalidatePath cruzado en `maintenance.actions.ts`:**
   - En `createMaintenanceRecord`, `reprogramMaintenance`, `completeMaintenance`, `updateMaintenanceRecord`: añadir `revalidatePath('/projects')` después de los existentes.
7. **revalidatePath cruzado en `project.actions.ts`:**
   - En `createProject` y `updateProject` (acciones de mutación — localizarlas en el archivo): si el proyecto tiene `mobileUnitId`, añadir `revalidatePath('/admin/mobile-units/${mobileUnitId}/maintenance')`.
   - Si `mobileUnitId` es null/undefined, no revalidar (evitar path inválido).
   - Localizar las funciones: buscar `export async function createProject` y `export async function updateProject` en el archivo. Si no existen con ese nombre, identificar las equivalentes (p.ej. `createProjectAction`) y aplicar lo mismo.

**Gate Fase 4:** typecheck + vitest + lint +全套 TC-1..TC-6 pasan + GEMINI auditoría sin bloqueadores.

---

## 3. data-testids a PRESERVAR (CRÍTICO)

NO romper estos selectores — los usan `frontend/tests/mobile-units.spec.ts`:

| testid | Ubicación | TC |
|---|---|---|
| `schedule-button` | Botón "+ Programar mantenimiento" en header de MaintenanceCalendar | TC-4 |
| `schedule-date` | Input fecha en modal crear | TC-4 |
| `schedule-description` | Textarea descripción en modal crear | TC-4 implícito |
| `event-${r.id}` | Botón/pill de cada evento de mantenimiento en el grid | **TC-5** (vía `[data-testid^="event-"]`) |
| `confirm-reprogram` | Botón confirmar en ReprogramModal | implícito |
| `confirm-complete` | Botón confirmar en CompleteModal | implícito |

### Nuevos testids a añadir

- `unit-projects-toggle` — toggle "Mostrar proyectos superpuestos" (Fase 2).
- `conflict-badge` — pill ⚠️ en día conflictivo (Fase 3).
- `maintenance-badge` — pill 🔧 Mant. en ProjectsCalendar (Fase 4).

---

## 4. Restricciones (NO negociables)

1. NO tocar `frontend/src/middleware.ts`.
2. NO modificar `PROYECTO.md` (lo hace CRONISTA vía handoff separado).
3. NO crear SPEC nueva sin aprobar. Esta SPEC ya está aprobada; si surge decisión nueva, devolver `BLOQUEO DE CONTEXTO`.
4. NO commitear ni pushear sin OK explícito de INTEGRA/Frank.
5. NO introducir librería nueva de calendario (fullcalendar, react-big-calendar, etc.). Implementación propia como ya lo es.
6. NO modificar schema Prisma ni migraciones.
7. NO modificar endpoints FastAPI.
8. NO modificar `frontend/tests/mobile-units.spec.ts`. Si TC-4 o TC-5 fallan por cambios legítimos del componente, devolver `BLOQUEO DE CONTEXTO` con evidencia antes de tocar el test.
9. Máximo 9 archivos (3 nuevos + 6 modificados). Si necesitas décimo, `BLOQUEO DE CONTEXTO`.
10. Si surge ambigüedad de contrato (firma de `ProjectFormModal`, shape de `UnitProjectItem`, etc.), devolver `BLOQUEO DE CONTEXTO` antes de improvisar.

---

## 5. Validaciones obligatorias antes de cerrar

Por fase (gate):

1. `pnpm typecheck` → 0 errores.
2. `pnpm test` (vitest run) → verde, sin regresiones vs baseline 388.
3. `pnpm lint` → 0 errores en archivos tocados (al menos: `MaintenanceCalendar.tsx`, `ProjectsCalendar.tsx`, los 2 actions, los 2 page wrappers, `calendar-utils.ts`, `maintenance-calendar-types.ts`).
4. `pnpm exec tsc --noEmit --skipLibCheck` (alternativa si `typecheck` no existe como script) → 0 errores.

Antes de reportar como listo, incluye self-review manual:

- ¿El código refleja la SPEC ARCH-20260804-03?
- ¿Hay code smells evidentes?
- ¿Los edge cases listados en la SPEC §15 están cubiertos?
- ¿Algún riesgo de regresión en TC-1..TC-6?

### Solicitud de segunda mano (REQUERIDA)

Antes de reportar como listo para INTEGRA, invoca a **GEMINI** vía `task` tool con `subagent_type='gemini'` como segunda mano de validación. Pásale:

- Resumen de cambios por fase.
- Lista de archivos tocados.
- Resultado de typecheck + vitest + lint.
- Pregunta específica: "Audita consistencia con SPEC ARCH-20260804-03, riesgo de regresión en TC-1..TC-6, code smells, y si los revalidatePath cruzados están bien aplicados".

GEMINI es auditor; no cambia SPEC ni arquitectura. Si devuelve bloqueadores, corrígelos y re-valida. Si devuelve observaciones no bloqueadoras, documentalas en el reporte final.

---

## 6. Modelo de reporte final a INTEGRA

Al cerrar (todas las fases gateadas + GEMINI auditado), reporta a INTEGRA:

1. **Fases completadas:** 1/2/3/4 (lista).
2. **Archivos tocados:** tabla con archivo, fase, líneas +/- aproximadas.
3. **Validaciones:** typecheck (0), vitest (N/388), lint (0), TC-1..TC-6 (pass/fail por TC).
4. **GEMINI auditoría:** APROBADO / APROBADO_CON_OBSERVACIONES / RECHAZADO + resumen.
5. **data-testids preservados:** confirmación de los 5 heredados + 3 nuevos.
6. **Riesgos detectados:** cualquier cosa fuera de SPEC §15.
7. **Autoevaluación:** ¿el código refleja la SPEC? ¿edge cases cubiertos?
8. **No commiteado:** confirmar que NO hiciste commit/push (esperar OK de INTEGRA/Frank).

---

## 7. DoD (para que INTEGRA cierre)

INTEGRA cerrará la tarea cuando SOFIA reporte:

- 4 fases gateadas con typecheck/vitest/lint verdes.
- TC-1..TC-6 pasan contra dev server.
- GEMINI auditoría sin bloqueadores.
- 9 archivos máx. tocados.
- Sin commit/push sin OK.

Luego INTEGRA escala a Frank vía `ask-frank.sh` para commit + push (clasificación ROJA — cambio de UI cross-component).

---

*Generado por INTEGRA — handoff ARCH-20260804-03 — 2026-08-04*
