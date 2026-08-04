# SPEC: Paridad visual y vinculación cruzada del Calendario de Mantenimiento con el Calendario de Proyectos

**ID:** ARCH-20260804-03
**Fecha:** 2026-08-04
**Estado:** APROBADO PARA IMPLEMENTACIÓN (FASE 0 — handoff a SOFIA)
**Agente Autor:** INTEGRA
**Prioridad:** Alta — cierra la brecha visual detectada por Frank entre los dos calendarios del dominio operativo
**Puntaje INTEGRA:** (3×3) + (3×2) - (1×0.5) = **14.5**
*(Valor=3: paridad visual + vinculación bidireccional es producto | Urgencia=3: Frank lo pidió explícito | Complejidad=2: refactor cosmético + 2 actions nuevos + lógica client-side de conflictos)*

---

## 1. Contexto y Problema

AMI tiene dos superficies calendario operativas que coexisten sin hablarse:

| Calendario | Ruta | Componente | Origen | UI actual |
|---|---|---|---|---|
| **Proyectos** | `/projects` | `ProjectsCalendar.tsx` (681 l.) | IMPL-20260527-01 | Moderna, tokenizada, `rounded-3xl`, `shadow-sm`, toggle Calendario/Tabla, panel de recepción |
| **Mantenimiento** | `/admin/mobile-units/[id]/maintenance` | `MaintenanceCalendar.tsx` (592 l.) | IMPL-20260711-01 | Legacy: `text-2xl font-semibold`, `bg-blue-600`, `rounded-md`, grid `gap-1`, modal `bg-black/40` |

La brecha visual ya fue atacada para el resto del módulo de unidades móviles por **ADR-20260804-01** (unificación de rutas) y **ADR-20260804-02** (alineación de estilo de catálogo, cards y modales). El calendario de mantenimiento **quedó fuera del alcance de ambos ADRs** y mantiene la UI legacy pre-sistema de diseño.

Paralelamente, la SPEC base `ARCH-20260711-01` §3.1 establece la regla de negocio de detección de conflictos proyecto↔mantenimiento, implementada en `validateUnitAvailability` y `checkMaintenanceConflicts`. Esa detección vive en los actions pero **no tiene reflejo visual en el grid**: hoy el operador no ve el conflicto hasta que intenta programar y el action lo rechaza.

Finalmente, los proyectos pueden tener `mobileUnitId` asignado (`getProjects()` ya retorna `mobileUnit { id, name, plate, status }`), pero el calendario de mantenimiento no muestra qué proyectos cubre la unidad en cada día, y el calendario de proyectos no muestra qué mantenimientos tiene la unidad asignada.

### Solicitudes explícitas de Frank (2026-08-04)

1. Paridad visual con `ProjectsCalendar`.
2. Superponer proyectos de la unidad en el grid de mantenimiento (vinculación §3.1).
3. Indicador visual de conflictos proyecto↔mantenimiento.
4. Vinculación inversa: proyectos muestran mantenimientos de su unidad.

---

## 2. Objetivo

Construir **un solo lenguaje visual** para los dos calendarios operativos y **cruzamiento bidireccional de información** entre ellos, sin tocar la lógica de negocio (actions vigentes), sin romper tests e2e (`mobile-units.spec.ts` TC-1..TC-6) y sin alterar la SPEC base `ARCH-20260711-01` más allá de un addendum a §5.5.

---

## 3. Alcance

### Incluye

1. Refactor cosmético completo de `MaintenanceCalendar.tsx` para alinear tokens con `ProjectsCalendar.tsx`.
2. Superposición de project cards sobre el grid de mantenimiento de la unidad.
3. Indicador visual de conflicto proyecto↔mantenimiento en el día del grid.
4. Vinculación inversa: `ProjectsCalendar.tsx` muestra badge de mantenimientos de la unidad asignada al proyecto.
5. `revalidatePath` cruzado en `maintenance.actions.ts` y `project.actions.ts` para que la edición en un lado se refleje en el otro.
6. Dos server actions nuevos de lectura (query) para alimentar la superposición y la vinculación inversa.

### No incluye

1. Drag-and-drop ni reprogramación arrastrando bloques.
2. Vista por hora / día (solo mes + lista).
3. Cambios en schema Prisma ni migraciones.
4. Cambios en endpoints FastAPI backend.
5. Migración de los modales de mantenimiento al patrón `ProjectFormModal` (decisión §9).
6. Cambios en la regla de negocio §3.1 (la detección sigue siendo la de `validateUnitAvailability`/`checkMaintenanceConflicts`).
7. Toques al catálogo `/admin/mobile-units` ni a `/operations/mobile-units` (ya alineados por ADR-20260804-01/02).

---

## 4. Modelo de Datos y Contrato de Actions

### 4.1 Actions existentes (NO se rompe contrato)

Estas firmas ya están en producción y **no se modifican** salvo el añadido de `revalidatePath` cruzado (§8):

- `getMaintenanceRecords(mobileUnitId, status?)` → `MaintenanceRecord[]` (orden `scheduledDate desc`).
- `getProjects()` → incluye `mobileUnit { id, name, plate, status }`, `_count.workers`, `_count.reports`, `workers[]`.
- `validateUnitAvailability(mobileUnitId, startDate, endDate, excludeProjectId?)` → `{ available, conflicts: {type, id, name}[], suggestions: {iso, label}[] }`.
- `suggestMaintenanceDates(mobileUnitId, startAfter, searchWindowDays, maxSuggestions)` → `{iso, label}[]`.
- `checkMaintenanceConflicts(mobileUnitId, scheduledDate)` → mismo shape que `validateUnitAvailability`.

### 4.2 Actions nuevos (solo lectura, aditivos)

**`getProjectsByMobileUnit(unitId: string)`** en `project.actions.ts`:
- Auth: `requireAdminOrReceptionist` (paridad con `getProjects`).
- Query: `prisma.project.findMany({ where: { mobileUnitId: unitId, NOT: { status: 'CANCELLED' } }, include: { company: {select:{id,name}}, _count: {select:{workers:true}} }, orderBy: { startDate: 'desc' } })`.
- Retorno: subconjunto del shape de `getProjects` con al menos `{ id, name, status, startDate, endDate, companyId, company, branchId, branch?, unitRef, _count: { workers } }`.
- Uso: alimentar la superposición en el grid de mantenimiento. No incluye `workers[]` completo (no hace falta recepción aquí).

**`getMaintenancesByUnitIds(unitIds: string[], statuses?: MaintenanceStatus[])`** en `maintenance.actions.ts`:
- Auth: `requireAnyAuth` (paridad con `getMaintenanceRecords`).
- Query: `prisma.maintenanceRecord.findMany({ where: { mobileUnitId: { in: unitIds }, status: statuses ? { in: statuses } : undefined }, select: { id, mobileUnitId, type, status, scheduledDate, technician } })`.
- Retorno: array plano con `{ id, mobileUnitId, type, status, scheduledDate, technician }`.
- Uso: alimentar la vinculación inversa en `ProjectsCalendar` sin N queries por unidad.

### 4.3 Tipo compartido `CalendarConflict`

Definir en `frontend/src/components/mobile-units/maintenance-calendar-types.ts` (archivo nuevo, solo tipos, sin lógica) el tipo que ambas vistas consumen para indicar conflictos:

```ts
export interface CalendarConflict {
  dateISO: string          // YYYY-MM-DD del día conflictivo
  unitId: string
  projectId: string
  projectName: string
  maintenanceId: string
  maintenanceType: 'PREVENTIVO' | 'CORRECTIVO' | 'VERIFICACION' | 'LIMPIEZA'
}
```

Este tipo se llena client-side cruzando `unitProjects` + `records` (mantenimiento) o `unitMaintenances` + `projects` (proyectos). **No** reemplaza el dictamen de `validateUnitAvailability`; es solo presentación.

---

## 5. Tokens Visuales del Calendario Unificado

Fuente canónica: `ProjectsCalendar.tsx` (vigente). Todo lo que aplique a `MaintenanceCalendar.tsx` debe replicar exactamente estas clases salvo indicación.

### 5.1 Header y subtítulo

| Elemento | Clase (vigente ProjectsCalendar) |
|---|---|
| Título h2 | `text-3xl font-black tracking-tight text-slate-900` |
| Subtítulo | `text-sm font-medium text-slate-500` |

En el page wrapper `/admin/mobile-units/[id]/maintenance/page.tsx` el header actual usa `text-2xl font-bold text-slate-800`. Mantener ese wrapper tal cual (ya fue alineado por ADR-20260804-02) y hacer que el header **interno** del componente `MaintenanceCalendar` NO duplique el título: el componente empieza directo con el contenedor `rounded-3xl`. El título "Calendario de mantenimiento · {unit.name}" vive en el page wrapper; el componente solo renderiza controles + grid + modales.

### 5.2 Toggle Calendario/Lista

Reemplazar el botón único "Vista lista/Vista calendario" por un toggle segmentado paridad ProjectsCalendar:

- Contenedor: `inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm`.
- Botón activo: `rounded-lg px-3 py-2 text-sm font-semibold bg-slate-900 text-white`.
- Botón inactivo: `rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100`.
- Labels: `Calendario` / `Lista` (paridad exacta con `Calendario`/`Tabla` de ProjectsCalendar).

### 5.3 Contenedor principal

- Outer: `rounded-3xl border border-slate-200 bg-white p-5 shadow-sm` (era `p-6 space-y-4` sin border ni rounded).

### 5.4 Navegación de mes

| Elemento | Clase |
|---|---|
| Botones (anterior/hoy/siguiente) | `rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50` |
| Label "Mes visible" (encabezado pequeño) | `text-xs font-semibold uppercase tracking-wide text-slate-400` |
| Valor del mes | `text-lg font-bold capitalize text-slate-900` (vía `toLocaleDateString('es-MX', { month:'long', year:'numeric' })`) |

Reemplazar los botones `← Mes anterior` / `Mes siguiente →` actuales por labels sin flecha (paridad ProjectsCalendar: `Mes anterior`, `Hoy`, `Mes siguiente`). La flecha es ruido visual.

### 5.5 Filtros y resumen

Mantener los filtros existentes (tipo de mantenimiento) pero envolverlos en el mismo patrón que ProjectsCalendar:

- Select: `min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none`.
- Label arriba: `text-xs font-semibold uppercase tracking-wide text-slate-400`.
- Card resumen: `rounded-2xl bg-slate-50 px-4 py-3` mostrando "{N} mantenimientos en el mes · {M} proyectos superpuestos · {K} conflictos".

Añadir filtro por estado de mantenimiento (`PROGRAMADO`/`COMPLETADO`/`CANCELADO`/`REPROGRAMADO` o `Todos`) en el mismo card de filtros.

### 5.6 Leyenda de colores

Reemplazar la leyenda inline actual por una fila de pills paridad `STATUS_BADGES`:

| Tipo | Clase (modernizada, paridad ProjectsCalendar) |
|---|---|
| PREVENTIVO | `border-emerald-200 bg-emerald-50 text-emerald-700` |
| CORRECTIVO | `border-red-200 bg-red-50 text-red-700` |
| VERIFICACION | `border-blue-200 bg-blue-50 text-blue-700` |
| LIMPIEZA | `border-violet-200 bg-violet-50 text-violet-700` |

Las pills de leyenda usan `inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold`. El puntito de color actual (`w-2 h-2 rounded-full bg-current`) puede conservarse.

### 5.7 Grid mensual

- Headers de weekday: contenedor `grid grid-cols-7 gap-2`; celda `rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500`.
- Labels: `['Lun','Mar','Mie','Jue','Vie','Sab','Dom']` (cambiar de `['Dom'...'Sab']` para alinear con ProjectsCalendar; el grid también arranca en lunes vía `startOfGrid`).
- Celdas del grid: contenedor `grid grid-cols-1 gap-2 md:grid-cols-7`; celda `min-h-44 rounded-2xl border p-3`.
  - Mes actual: `border-slate-200 bg-white`.
  - Otro mes: `border-slate-100 bg-slate-50/80`.
  - Hoy: añade `ring-2 ring-blue-200`.
- Número del día: `inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold` (hoy `bg-blue-600 text-white`, actual `bg-slate-100 text-slate-700`, otro `bg-slate-100 text-slate-400`).
- Contador esquina superior derecha: `text-[11px] font-semibold uppercase tracking-wide text-slate-400` con texto `{N} activos` (mantenimientos+proyectos del día).
- Vacío en mes actual: `rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400` con texto `Sin actividad`.
- Desbordamiento: `rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500` con texto `+{N} más`.

**Cambio de inicio de semana:** el grid legacy arranca en domingo (`firstDayOfWeek.getDay()`); el nuevo arranca en lunes (paridad ProjectsCalendar: `(firstDay.getDay() + 6) % 7`). Validar que los tests e2e TC-4 y TC-5 no dependan del offset (no lo hacen: clican por `data-testid`).

### 5.8 Eventos en el grid (mantenimientos y proyectos)

Cada evento (mantenimiento o proyecto superpuesto) es una pill/card con clase base:

`w-full rounded-2xl border px-3 py-2 text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5`

- **Mantenimiento** (pill de mantenimiento): usar `MAINTENANCE_TYPE_BADGES` (§5.6) según `r.type`. Header de la pill: `{TYPE_LABEL}` + badge de estado a la derecha `text-[10px] font-bold uppercase` con color por estado (PROGRAMADO ámbar, COMPLETADO emerald, CANCELADO slate, REPROGRAMADO violet outline). Cuerpo: descripción truncada `truncate text-[11px]`.
- **Proyecto superpuesto** (pill de proyecto): usar `STATUS_BADGES` de `ProjectsCalendar` (`DRAFT`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`) para que visualmente sea el mismo bloque que ve el operador en `/projects`. Header: nombre del proyecto `line-clamp-2 font-semibold`. Cuerpo: `company.name` + rango `formatRange(startDate,endDate)`. No incluye botón de recepción (eso vive en `/projects`).
- **Orden de apilado**: mantenimiento primero, luego proyectos, ordenados por hora de inicio del día.
- **Tope visible**: `slice(0,3)` como en ProjectsCalendar; resto al `+N más`.

### 5.9 Comportamiento de click

- Click en pill de mantenimiento: mantiene la lógica actual (abre `ReprogramModal` si `PROGRAMADO`/`REPROGRAMADO`/`CANCELADO`, abre `CompleteModal` si está en otro estado). Preservar `data-testid="event-${r.id}"` en el botón de la pill de mantenimiento (TC-5 lo requiere).
- Click en pill de proyecto superpuesto: abre `ProjectFormModal` en modo edición (reutilizar el patrón de `ProjectsCalendar.openEdit`). Es el punto de cruce natural: si el operador ve un proyecto chocando con un mantenimiento, puede editar el proyecto desde el calendario de mantenimiento. Reutiliza `toProjectForEdit` shape ya definido en ProjectsCalendar.

### 5.10 Modales (decisión: mantener inline, modernizar tokens)

**Decisión:** los modales `Modal`, `ReprogramModal`, `CompleteModal` se mantienen como componentes locales de `MaintenanceCalendar.tsx`. **NO** se migran al patrón `ProjectFormModal`. Justificación (también en ADR §3):

- `ProjectFormModal` está acoplado a la entidad `Project` y su contexto de recepción/empresa.
- Los modales de mantenimiento tienen lógica específica (verificar disponibilidad, sugerencias, completar con costo, próximo mantenimiento).
- Migrarlos a un patrón shared añadiría indirection sin ganar consistencia real.

**Tokens modernizados (todas las modales):**

- Backdrop: `fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4` (era `bg-black/40`).
- Content: `bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg` (era `bg-white rounded-lg shadow-xl max-w-lg w-full p-4`).
- Header h2: `text-lg font-bold` (era `text-lg font-semibold`).
- Botón cerrar ✕: `text-slate-400 hover:text-slate-600 text-sm`.
- Inputs: `w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500` (paridad sistema).
- Labels: `text-xs text-slate-500 mb-1 block` (era `text-sm font-medium`).
- Botón primario submit: `bg-purple-600 hover:bg-purple-700 text-white rounded shadow font-medium` (era `bg-blue-600`).
- Botón secundario cancelar: `border border-slate-200 rounded text-slate-600 hover:bg-slate-50 text-sm font-medium`.
- Botón "Verificar disponibilidad" / "Buscar alternativas": `border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50`.
- Sugerencias libres: pill `rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100`.
- Banner de info de conflicto: `mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700`.

Preservar `data-testid="schedule-button"`, `"schedule-date"`, `"schedule-description"`, `"confirm-reprogram"`, `"confirm-complete"` exactos.

---

## 6. Superposición de Proyectos en el Grid de Mantenimiento

### 6.1 Datos

El page wrapper `/admin/mobile-units/[id]/maintenance/page.tsx` debe además de `getMaintenanceRecords(id)` llamar a `getProjectsByMobileUnit(id)` (action nuevo §4.2) y pasar `unitProjects` como prop adicional a `MaintenanceCalendar`.

### 6.2 Props nuevas de `MaintenanceCalendar`

```ts
interface MaintenanceCalendarProps {
  unitId: string
  initialRecords: Maintenance[]
  unitProjects: UnitProjectItem[]   // NUEVO
  unitName: string                 // NUEVO (para evitar re-fetch)
}
```

Donde `UnitProjectItem` se define en `maintenance-calendar-types.ts` con el subconjunto que retorna `getProjectsByMobileUnit`.

### 6.3 Render

- Para cada día del grid, además de los mantenimientos del día (`byDay`), calcular `projectsOnDay = unitProjects.filter(p => isProjectActiveOnDay(p, day))` reutilizando el helper `isProjectActiveOnDay` de ProjectsCalendar (extraer a un archivo de helpers compartido `frontend/src/lib/calendar-utils.ts` o duplicar como fn privada — decisión SOFIA según densidad).
- Mezclar ambos arrays en el render del día, ordenados por tipo (mantenimiento primero) y luego por hora/inicio.
- Aplicar `slice(0,3)` y `+N más` igual que ProjectsCalendar.

### 6.4 Filtro cruzado

- El filtro por tipo de mantenimiento NO filtra proyectos (los proyectos no tienen tipo).
- El filtro por estado de mantenimiento NO filtra proyectos.
- Añadir toggle "Mostrar proyectos superpuestos" (default ON) para que el operador pueda ocultarlos si quiere foco puro en mantenimiento. Token: `inline-flex items-center gap-2 text-xs font-semibold text-slate-600` + checkbox `rounded border-slate-300`.

---

## 7. Detección de Conflictos Visual

### 7.1 Definición operativa de conflicto (presentación, no negocio)

Un día del grid de mantenimiento tiene conflicto **visual** si existe AL MENOS un proyecto superpuesto (cuyo rango `[startDate, endDate]` contiene al día) Y AL MENOS un mantenimiento PROGRAMADO o REPROGRAMADO en ese mismo día, ambos para la unidad del calendario.

Esta detección es **client-side**, basada en los datos ya cargados (`unitProjects` + `records`). No reemplaza el dictamen server-side de `validateUnitAvailability` (que sigue siendo la fuente de verdad al crear/reprogramar).

### 7.2 Tokens visuales de conflicto

Cuando un día del grid tenga conflicto:

- La celda añade `ring-2 ring-red-400 ring-offset-0` (apilable con `ring-blue-200` de hoy: si es hoy Y conflicto, predomina el anillo rojo para señalar el problema).
- En la esquina superior derecha (donde ProjectsCalendar pone `{N} activos`), añadir pill: `inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700` con texto `⚠️ Conflicto`.
- La pill de mantenimiento en conflicto añade `ring-2 ring-red-400 ring-offset-1` (resalta cuál de los eventos choca).
- La pill de proyecto superpuesto en conflicto añade también `ring-2 ring-red-400 ring-offset-1` (ambos lados del choque quedan señalados).

### 7.3 Acción desde el conflicto

- Click en pill de mantenimiento en conflicto → abre `ReprogramModal` con aviso visible "Conflicto con proyecto {X} en esta fecha" arriba del formulario (banner ámbar §5.10).
- Click en pill de proyecto en conflicto → abre `ProjectFormModal` en modo edición; el operador puede cambiar fechas o unidad desde allí.

### 7.4 Resumen de conflictos

En el card de resumen (§5.5), la métrica de conflictos se calcula client-side: número de días del mes con al menos un conflicto. Texto: `{K} días con conflicto`.

---

## 8. Vinculación Inversa: ProjectsCalendar muestra mantenimientos

### 8.1 Datos

El page `/projects/page.tsx` debe además de `getProjects()`, `getCompanies()`, `getBranches()` obtener los mantenimientos PROGRAMADO/REPROGRAMADO de las unidades referenciadas por los proyectos visibles. Pasos:

1. Extraer `mobileUnitIds = [...new Set(projects.map(p => p.mobileUnit?.id).filter(Boolean))]`.
2. Llamar a `getMaintenancesByUnitIds(mobileUnitIds, ['PROGRAMADO','REPROGRAMADO'])` (action nuevo §4.2).
3. Pasar `unitMaintenances` como prop nueva a `ProjectsCalendar`.

### 8.2 Props nuevas de `ProjectsCalendar`

```ts
interface ProjectsCalendarProps {
  projects: ProjectItem[]
  companies: CompanyOption[]
  branches: BranchOption[]
  unitMaintenances?: UnitMaintenanceItem[]  // NUEVO opcional
}
```

`UnitMaintenanceItem` se define en `maintenance-calendar-types.ts` con el shape del §4.2.

### 8.3 Badge de mantenimientos en pill de proyecto

En cada pill de proyecto, debajo del rango (donde ProjectsCalendar muestra `formatRange`), añadir si `unitMaintenances` indica que la unidad del proyecto tiene al menos un mantenimiento en `[startDate, endDate]` del proyecto:

- Pill: `inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700` con texto `🔧 {N} mant.` donde N = conteo de mantenimientos en el rango.
- Click en la pill (no en la card de proyecto) → `Link` a `/admin/mobile-units/{mobileUnitId}/maintenance` (deep-link directo al calendario de la unidad).
- Si la unidad no tiene mantenimientos en el rango, no renderizar nada (no mostrar "0 mant.").

### 8.4 Filtro opcional

Añadir toggle "Solo proyectos con mantenimiento" en el card de filtros (default OFF). Token paridad `Mostrar proyectos superpuestos` del §6.4.

---

## 9. revalidatePath Cruzado

### 9.1 En `maintenance.actions.ts`

Añadir en `createMaintenanceRecord`, `reprogramMaintenance`, `completeMaintenance` y `updateMaintenanceRecord`:

- `revalidatePath('/projects')` — para que la pill de 🔧 Mant. en ProjectsCalendar se actualice al crear/reprogramar/completar mantenimientos.

El `revalidatePath('/admin/mobile-units/${mobileUnitId}/maintenance')` ya existe; mantenerlo. No añadir `revalidatePath('/operations/mobile-units')` porque la pestaña Operación no muestra mantenimientos por día (solo contadores).

### 9.2 En `project.actions.ts`

En `createProject` y `updateProject` (acciones de mutación), cuando el proyecto tenga `mobileUnitId` asignado:

- `revalidatePath('/admin/mobile-units/${mobileUnitId}/maintenance')` — para que el calendario de mantenimiento refleje el proyecto superpuesto nuevo o editado.

Si `mobileUnitId` es null/undefined, no revalidar la ruta de mantenimiento (evita path dinámico inválido).

---

## 10. data-testids a Preservar (CRÍTICO — tests e2e)

Sofia NO debe romper estos selectores usados por `frontend/tests/mobile-units.spec.ts`:

| testid | Ubicación | TC |
|---|---|---|
| `schedule-button` | Botón "+ Programar mantenimiento" en header de `MaintenanceCalendar` | TC-4 |
| `schedule-date` | Input fecha en modal crear | TC-4 |
| `schedule-description` | Textarea descripción en modal crear | TC-4 implícito |
| `event-${r.id}` | Botón/pill de cada evento de mantenimiento en el grid | **TC-5** (vía `[data-testid^="event-"]`) |
| `confirm-reprogram` | Botón confirmar en `ReprogramModal` | implícito |
| `confirm-complete` | Botón confirmar en `CompleteModal` | implícito |

Otros testids fuera del componente que NO se tocan en esta SPEC: `units-table`, `new-unit-button`, `calendar-link`, `mobile-unit-selector`, `unit-conflict`, `name-input`, `plate-input`, `save-button`, `delete-${uuid}`.

### 10.1 Nuevos testids a añadir (para futura cobertura e2e)

- `unit-projects-toggle` — toggle "Mostrar proyectos superpuestos" (§6.4).
- `conflict-badge` — pill ⚠️ en día conflictivo (§7.2).
- `maintenance-badge` — pill 🔧 Mant. en ProjectsCalendar (§8.3).

Estos no se exigen en tests actuales pero deben estar para autoevaluación visual.

---

## 11. Plan de Implementación (4 Fases)

Cada fase es un checkpoint gateado: SOFIA valida gates antes de pasar a la siguiente. Si una fase rompe tests, no avanzar.

### Fase 1 — Refactor cosmético de `MaintenanceCalendar`

- Aplicar tokens §5.1–5.10 al componente `MaintenanceCalendar.tsx`.
- Mover inicio de grid a lunes.
- Modernizar los 3 modales locales (Modal, ReprogramModal, CompleteModal) con tokens §5.10.
- Preservar todos los data-testids §10.
- NO añadir superposición ni conflictos todavía.
- **Gate:** `pnpm typecheck` 0 errores + `pnpm test` verde + `pnpm lint` 0 errores. TC-4 y TC-5 siguen pasando.

### Fase 2 — Superposición de proyectos en grid de mantenimiento

- Crear action `getProjectsByMobileUnit(unitId)` en `project.actions.ts`.
- Crear archivo de tipos `frontend/src/components/mobile-units/maintenance-calendar-types.ts`.
- Extender props de `MaintenanceCalendar` con `unitProjects` y `unitName`.
- Modificar page wrapper `/admin/mobile-units/[id]/maintenance/page.tsx` para pasar `unitProjects`.
- Implementar mezcla de pills en el grid (mantenimiento + proyecto).
- Implementar toggle "Mostrar proyectos superpuestos" con testid `unit-projects-toggle`.
- Click en pill de proyecto → abrir `ProjectFormModal` edición (importar `ProjectFormModal` y `ProjectForEdit` en `MaintenanceCalendar`).
- **Gate:** typecheck + vitest + lint + TC-4/TC-5 pasan.

### Fase 3 — Indicador visual de conflictos

- Calcular conflictos client-side cruzando `unitProjects` + `records` (§7.1).
- Aplicar tokens de conflicto §7.2 (anillo rojo celda, pill ⚠️, ring en pills).
- Banner ámbar en `ReprogramModal` cuando el día está en conflicto (§7.3).
- Métrica `{K} días con conflicto` en resumen (§5.5).
- testid `conflict-badge` en pill ⚠️.
- **Gate:** typecheck + vitest + lint + TC-4/TC-5 pasan.

### Fase 4 — Vinculación inversa y revalidatePath cruzado

- Crear action `getMaintenancesByUnitIds(unitIds, statuses?)` en `maintenance.actions.ts`.
- Modificar `/projects/page.tsx` para pasar `unitMaintenances` a `ProjectsCalendar`.
- Extender props de `ProjectsCalendar` con `unitMaintenances?`.
- Implementar badge 🔧 Mant. en pill de proyecto (§8.3) con testid `maintenance-badge`.
- Toggle "Solo proyectos con mantenimiento" (§8.4).
- Añadir `revalidatePath('/projects')` en `maintenance.actions.ts` (§9.1).
- Añadir `revalidatePath('/admin/mobile-units/${mobileUnitId}/maintenance')` en `project.actions.ts` cuando aplique (§9.2).
- **Gate:** typecheck + vitest + lint +全套 TC-1..TC-6 pasan.

---

## 12. Criterios de Aceptación (Definition of Done)

DoD verificable con evidencia:

1. `MaintenanceCalendar.tsx` usa tokens de `ProjectsCalendar.tsx` (header `text-3xl font-black`, contenedor `rounded-3xl ... shadow-sm`, grid `gap-2`, celdas `min-h-44 rounded-2xl`, modales `bg-black/50 backdrop-blur-sm` + `rounded-xl shadow-2xl p-6`).
2. El grid de mantenimiento arranca en lunes (paridad ProjectsCalendar).
3. Los proyectos de la unidad se renderizan como pills superpuestas en el grid, con `STATUS_BADGES` de proyecto (mismo color que en `/projects`).
4. Click en pill de proyecto superpuesto abre `ProjectFormModal` en modo edición.
5. Los días con conflicto proyecto↔mantenimiento muestran anillo rojo + pill ⚠️ con testid `conflict-badge`.
6. El `ReprogramModal` muestra banner ámbar cuando el día está en conflicto.
7. `ProjectsCalendar` muestra badge `🔧 {N} mant.` (testid `maintenance-badge`) en pills de proyecto cuya unidad tiene mantenimientos en rango, con Link a `/admin/mobile-units/{unitId}/maintenance`.
8. `getProjectsByMobileUnit(unitId)` y `getMaintenancesByUnitIds(unitIds, statuses?)` existen y retornan el shape especificado en §4.2.
9. `maintenance.actions.ts` llama `revalidatePath('/projects')` en las 4 mutaciones.
10. `project.actions.ts` llama `revalidatePath('/admin/mobile-units/${mobileUnitId}/maintenance')` cuando el proyecto tiene unidad.
11. Todos los data-testids de §10 preservados.
12. `pnpm typecheck` 0 errores.
13. `pnpm test` (vitest) pasa sin regresiones (baseline 388 tests).
14. `pnpm lint` 0 errores en archivos tocados.
15. `mobile-units.spec.ts` TC-1..TC-6 pasan contra dev server.
16. GEMINI auditoría (`subagent_type='gemini'`) sin bloqueadores.

---

## 13. Restricciones

1. NO tocar middleware ni auth.
2. NO modificar `PROYECTO.md` (lo hace CRONISTA vía handoff separado).
3. NO crear SPEC nueva sin aprobar (esta SPEC ya está aprobada; si surge decisión nueva, devolver `BLOQUEO DE CONTEXTO`).
4. NO commitear ni pushear sin OK explícito de INTEGRA/Frank.
5. NO introducir librería nueva de calendario (fullcalendar, react-big-calendar). Implementación propia como ya lo es.
6. NO modificar schema Prisma ni migraciones.
7. NO modificar endpoints FastAPI.
8. Máximo de archivos a tocar: ver §14.
9. Si surge ambigüedad de contrato, detenerse y devolver `BLOQUEO DE CONTEXTO` antes de expandir alcance.

---

## 14. Archivos a Tocar

### Nuevos (3)
- `frontend/src/components/mobile-units/maintenance-calendar-types.ts` — tipos compartidos (`UnitProjectItem`, `UnitMaintenanceItem`, `CalendarConflict`).
- `frontend/src/lib/calendar-utils.ts` — helpers `isProjectActiveOnDay`, `startOfGrid`, `addDays`, `isSameDay`, `formatRange` extraídos de ProjectsCalendar para reutilización. (Alternativa: duplicar como privadas en MaintenanceCalendar — decisión SOFIA según densidad del código.)
- `context/interconsultas/HANDOFF_ARCH-20260804-03_SOFIA_CALENDARIO-PARIDAD.md` — handoff (lo redacta INTEGRA en esta Fase 0).

### Modificados (6)
- `frontend/src/components/mobile-units/MaintenanceCalendar.tsx` — refactor cosmético + superposición + conflictos (Fases 1-3).
- `frontend/src/components/ProjectsCalendar.tsx` — badge 🔧 Mant. + prop `unitMaintenances` + toggle (Fase 4).
- `frontend/src/app/admin/mobile-units/[id]/maintenance/page.tsx` — pasar `unitProjects` + `unitName` a `MaintenanceCalendar`.
- `frontend/src/app/projects/page.tsx` — obtener `unitMaintenances` y pasar a `ProjectsCalendar`.
- `frontend/src/actions/project.actions.ts` — nuevo `getProjectsByMobileUnit` + `revalidatePath` cruzado en `createProject`/`updateProject`.
- `frontend/src/actions/maintenance.actions.ts` — nuevo `getMaintenancesByUnitIds` + `revalidatePath('/projects')` en las 4 mutaciones.

### No modificables en esta SPEC
- `frontend/tests/mobile-units.spec.ts` — sin cambios (los testids actuales siguen funcionando). Si SOFIA detecta que TC-4 o TC-5 necesitan ajuste por el cambio de inicio de semana, devolver `BLOQUEO DE CONTEXTO`.
- `context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md` — sin cambios; esta SPEC funciona como addendum a §5.5.

### Máximo: 9 archivos (3 nuevos + 6 modificados)

Si SOFIA concluye que necesita abrir un décimo, devolver `BLOQUEO DE CONTEXTO` antes de expandir.

---

## 15. Riesgos y Mitigaciones

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Cambio de inicio de semana (Dom→Lun) rompe TC-4/TC-5 | Media | TC-4 y TC-5 no dependen del offset, clican por `data-testid="event-*"`. Validar antes de cerrar Fase 1. |
| `ProjectFormModal` importado en `MaintenanceCalendar` genera cycle import con `ProjectsCalendar` | Media | `ProjectFormModal` ya es independiente de `ProjectsCalendar`; solo importa el tipo `ProjectForEdit`. Si cycle, mover `ProjectForEdit` a `maintenance-calendar-types.ts`. |
| Saturación visual al mezclar 3+ pills por día | Media | `slice(0,3)` + `+N más` (paridad ProjectsCalendar). Toggle para ocultar proyectos (§6.4). |
| `revalidatePath('/projects')` invalida caché muy agresivo | Baja | El path `/projects` ya es `force-dynamic`. No hay caché que romper. |
| `getMaintenancesByUnitIds` con `unitIds` grande (muchas unidades) | Baja | En producción AMI tiene 6 unidades. Query `IN` sobre 6 ids es trivial. |
| Conflicto visual de `ring` (hoy azul + conflicto rojo) | Baja | Decisión: conflicto predomina (anillo rojo). Documentado en §7.2. |
| Tests e2e actuales no cubren nuevos badges 🔧/⚠️ | Baja | Se añaden testids `maintenance-badge`/`conflict-badge` para futura cobertura. No se exigen tests nuevos en esta SPEC. |

---

## 16. Estimación de Esfuerzo (para SOFIA)

| Fase | Tiempo estimado |
|---|---|
| Fase 1 (refactor cosmético) | 1.5–2 h |
| Fase 2 (superposición proyectos) | 2–2.5 h |
| Fase 3 (conflictos visuales) | 1–1.5 h |
| Fase 4 (vinculación inversa + revalidate) | 2–2.5 h |
| **Total** | **6.5–8.5 h** |

---

## 17. Handoff a SOFIA

**Archivo:** `context/interconsultas/HANDOFF_ARCH-20260804-03_SOFIA_CALENDARIO-PARIDAD.md`

Redactado por INTEGRA en esta misma Fase 0. Contiene: lista exacta de archivos, plan Fase 1→4, validaciones, data-testids, restricciones, y solicitud de revisión final a GEMINI.

---

*Generado por INTEGRA — ARCH-20260804-03 — 2026-08-04*
