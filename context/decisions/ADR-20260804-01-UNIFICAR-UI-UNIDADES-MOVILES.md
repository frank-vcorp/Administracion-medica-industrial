# ADR-20260804-01 — Unificar UI del módulo de Unidades Móviles

**Estado:** Aceptado
**Fecha:** 2026-08-04
**ID tarea:** IMPL-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES
**Decisores:** Frank (product owner), ATLAS M3 (análisis), SOFIA-style execution
**Spec afectada:** `context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md` §5.6

## Contexto

El módulo de Unidades Móviles estaba fragmentado en dos rutas con dos UX distintas y dos entradas en la barra lateral:

| Ruta | Propósito | UI | Permisos |
|---|---|---|---|
| `/admin/mobile-units` | CRUD catálogo (alta, edición, eliminar, mantenimiento) | `MobileUnitManager` (tabla + modal + filtro, client component) | Solo ADMIN (middleware `src/middleware.ts:41-45`) |
| `/operations/mobile-units` | Dashboard operativo (métricas, calendario semanal, conflictos) | Server component plano (314 líneas inline) | Staff autenticado |

**Síntomas reportados:**
1. Dos NavItems distintos para la misma entidad: "Unidades Móviles" (🚑) en bloque staff y "Catálogo Unidades" (🚐) en bloque admin.
2. UX inconsistente entre CRUD admin y dashboard operativo.
3. Inconsistencia con el módulo `/branches`, que tiene catálogo + creación + operación en una sola ruta con tabs.
4. Para tareas básicas (alta, ver detalle) hay que saltar entre módulos.

## Decisión

**Opción B elegida:** Consolidar el NavItem y unificar la ruta `/operations/mobile-units` con dos pestañas, manteniendo la separación técnica que requiere el middleware.

### Cambios concretos

1. **Un solo NavItem** en `AppShell.tsx`: eliminado el duplicado "Catálogo Unidades" (🚐). El acceso a CRUD vive ahora en la pestaña "Catálogo" de `/operations/mobile-units`. Las rutas `/admin/mobile-units/*` siguen existiendo para deep-links.
2. **`/operations/mobile-units` con tabs** (`?view=catalog|operations`, default `catalog`):
   - **Catálogo:** reusa `MobileUnitManager` con prop `readOnly={!isAdmin}` para staff no-admin.
   - **Operación:** nuevo componente `MobileUnitOperationsPanel` con métricas, próximos mantenimientos, conflictos y calendario semanal dual.
3. **`MobileUnitManager` extendido** con props `readOnly` y `showCreate` para soportar el modo vista-mixta.
4. **`MobileUnitOperationsPanel`** extraído como client component (la lógica server sigue en el page.tsx).

### Por qué NO Opción A (fusionar `/admin/mobile-units` y `/operations/mobile-units` en una sola ruta raíz)

- El middleware (`src/middleware.ts:41-45`) restringe `/admin/*` a ADMIN. Staff no-admin necesita acceso al menos de lectura a la lista de unidades.
- Migrar rutas rompe deep-links externos, tests e2e y referencias en actions (`revalidatePath('/admin/mobile-units')` aparece 6 veces en `mobile-unit.actions.ts` y 5 veces en `maintenance.actions.ts`).
- La SPEC §5.6 define el dashboard operativo como ruta con propósito distinto a §5.1 (CRUD). Mantener la separación técnica respeta el contrato.
- El usuario pidió consistencia visual, no fusión de rutas. Eso se logra con tabs.

### Por qué NO Opción C (solo cosmético)

- No resuelve la queja principal de Frank ("tengo que salir al menú principal").
- Mantiene fragmentación de NavItems.

## Consecuencias

### Positivas
- Un solo NavItem "Unidades Móviles" para todo el módulo.
- UX uniforme con `/branches` (tabs Catálogo + Operación).
- Personal no-admin ve el catálogo en modo lectura sin perder el dashboard operativo.
- ADMIN sigue viendo los botones de edición cuando está en `/operations/mobile-units?view=catalog`.
- Cero impacto en tests e2e (siguen apuntando a `/admin/mobile-units`).
- Cero impacto en `revalidatePath` (siguen apuntando a `/admin/mobile-units`).
- Cero impacto en middleware.

### Negativas / Trade-offs
- Lógica de tabs implementada con searchParam (no client state). Trade-off a favor de Next.js caching.
- Hay que pasar `isAdmin` desde server para condicionar `readOnly`. Una página más densa que la original.
- El dashboard "Operación" antes era la única vista útil para staff; ahora la pestaña default es "Catálogo". Decisión consciente para que el módulo se sienta unificado, pero puede requerir acostumbramiento.

### Remoción explícita
- **Tabla "Utilización por unidad" eliminada** (ex-SPEC §5.6 último bullet: `_count.projects / _count.maintenances / capacity`). Razón: la misma información ya está disponible en la pestaña **Catálogo** (columnas `Proyectos` y `Capacidad`, más `Próximo mantenimiento`). No se pierde información de producto; se elimina duplicación visual. Si en el futuro se requiere comparativa cross-unidad, se añadirá como widget dentro de la pestaña Operación.
- **Cast `p.mobileUnitId as string` en serialización:** runtime seguro (los matches solo se hacen contra ids de unidades no-nulas) pero oculta `null` del schema. Tipar `mobileUnitId: string | null` en Props del panel es follow-up de hardening (NIT).

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `frontend/src/components/AppShell.tsx` | Eliminado NavItem duplicado "Catálogo Unidades" (🚐) |
| `frontend/src/app/operations/mobile-units/page.tsx` | Refactor: tabs Catálogo\|Operación, server-side auth check, integración `getMobileUnits()` para consistencia con admin |
| `frontend/src/components/mobile-units/MobileUnitManager.tsx` | Añadidas props `readOnly` y `showCreate` |
| `frontend/src/components/mobile-units/MobileUnitOperationsPanel.tsx` | **Nuevo** — extraído del page.tsx original |
| `context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md` | §5.6 actualizada para reflejar el módulo unificado |

## Validación

- `npx tsc --noEmit` — pasa sin errores.
- `npx vitest run` — 388 tests pasan (23 archivos, 0 fallos).
- Tests e2e (`mobile-units.spec.ts`) siguen apuntando a `/admin/mobile-units` y no requieren cambios.

## Reversibilidad

Baja. Cambios contenidos en 4 archivos + SPEC + este ADR. Para revertir:
1. Restaurar NavItem en `AppShell.tsx`.
2. Restaurar `page.tsx` original (314 líneas) — aún disponible en git.
3. Eliminar `MobileUnitOperationsPanel.tsx`.
4. Revertir props en `MobileUnitManager.tsx`.

## Referencias

- Discusión original: chat 2026-08-04 con Frank.
- Spec base: `context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md`.
- Módulo de referencia (Sucursales): `frontend/src/app/branches/page.tsx` + `frontend/src/app/branches/_components/`.
- Middleware: `frontend/src/middleware.ts` líneas 41-45.