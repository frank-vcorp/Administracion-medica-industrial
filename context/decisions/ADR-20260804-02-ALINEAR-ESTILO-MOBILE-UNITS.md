# ADR-20260804-02 — Alinear estilo del módulo Unidades Móviles con sistema de diseño

**Estado:** Aceptado
**Fecha:** 2026-08-04
**ID tarea:** IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
**Decisores:** Frank (product owner), ATLAS M3 (ejecución), GEMINI (auditoría)
**Spec afectada:** `context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md` §5.6

## Contexto

El módulo de Unidades Móviles (`/admin/mobile-units/*` y `/operations/mobile-units`) había sido desarrollado en `IMPL-20260711-01`, **antes** de que el sistema de diseño informal del proyecto se consolidara en `/branches` (`IMPL-20260730-04/05`). Como resultado:

- Componentes (`MobileUnitManager`, `MobileUnitForm`, página de detalle) usaban tokens distintos al resto:
  - Color primario `bg-blue-600` (genérico) en lugar de `bg-purple-600` (de marca, definido en `BranchCreateModal`/`BranchEditForm`).
  - Botón header `bg-blue-600` en lugar de `bg-slate-900`.
  - Inputs sin `focus:ring-purple-500` ni `text-sm`.
  - Labels con `text-sm font-medium` en lugar de `text-xs text-slate-500`.
  - Status badge `rounded` con borde en lugar de `rounded-full` (paridad `BranchStatusBadge`).
  - Tabla CRUD `<table>` plana sin chrome; el resto del sistema usa cards (`BranchCard`) o tabla densa con sombra.
  - Submit con `rounded-md` en lugar de `rounded`.
  - Header `font-semibold` en lugar de `font-bold`.
  - Subtítulo `text-slate-600` en lugar de `text-slate-500`.
  - Empty state plano en lugar de banner ámbar.
- Creación vía página `/admin/mobile-units/new` en lugar de modal (paridad `BranchCreateModal`).

`IMPL-20260804-01` unificó las rutas del módulo pero no migró el estilo. Frank detectó la inconsistencia y pidió alineación.

## Decisión

**Refactor cosmético completo** para alinear el módulo con los tokens visuales inferidos del sistema (convención `/branches` como referencia canónica):

1. **Botones:**
   - Submit form: `bg-purple-600 hover:bg-purple-700 text-white rounded shadow font-medium`.
   - Header primary: `bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg shadow`.
   - Header secondary (toggle, volver): `text-xs text-slate-500 underline` o `border border-slate-200 rounded-lg`.
   - Delete: `border-red-200 text-red-600 hover:bg-red-50` (trigger) / `bg-red-600 hover:bg-red-700 text-white` (confirmación).
2. **Tipografía:**
   - Headers h2: `text-2xl font-bold text-slate-800`.
   - Subtítulos: `text-sm text-slate-500`.
3. **Inputs/forms:**
   - Input: `w-full border border-slate-300 p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500`.
   - Label: `text-xs text-slate-500 mb-1 block`.
   - Banner error: `bg-red-50 text-red-700 p-3 rounded text-sm`.
4. **Status badge (`MobileUnitStatusBadge`):**
   - `text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-{color}-100 text-{color}-700`.
   - Paridad con `BranchStatusBadge`.
5. **Cards (`MobileUnitCard`):**
   - `bg-white p-0 rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all`.
   - Header con emoji 🚑 grande o `Image` (si tiene `imageUrl`).
   - Body con nombre, placa, status badge, datos relevantes.
   - Footer con botón ghost "Configurar" (ADMIN) o "Ver" (staff).
6. **Patrón de lista:**
   - Migrar de `<table>` a grid de cards: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`.
7. **Modal de creación (`MobileUnitCreateModal`):**
   - Backdrop `fixed inset-0 bg-black/50 backdrop-blur-sm z-50`.
   - Content `bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl`.
   - Cierre con click en backdrop (Escape queda como NIT-6).
   - Tras éxito, redirect a `/[id]/edit` para completar imagen + equipamiento.
8. **Página de detalle (`/admin/mobile-units/[id]`):**
   - Header h2 + acciones (Editar slate-900, Calendario outline, Eliminar red outline).
   - Cards de métricas: `bg-white p-4 rounded-lg border border-slate-200`.
   - Lista de proyectos con status badge pill (paridad branches).
   - Timeline de mantenimientos preservado (pre-existente).
9. **Filtros:**
   - Envueltos en card `bg-white p-4 rounded-xl border border-slate-200 shadow-sm` (paridad `/companies`).
   - Toggle "Mostrar/Ocultar inactivas" en header (paridad `/branches`).
10. **Empty state:**
    - Banner ámbar `bg-amber-50 rounded-xl border border-amber-300` con texto explicativo de permisos.
11. **Tabs en `/operations/mobile-units`:**
    - Color de marca `border-purple-500 text-purple-600` (paridad `BranchDetailTabs`).
12. **Redirect `/admin/mobile-units/new`:**
    - Server-side `redirect()` a `/admin/mobile-units` (preserva deep-links externos).
13. **Eliminación:**
    - Restaurada en header de página de detalle, solo visible para ADMIN (`isAdminLike`).
    - Componente `MobileUnitDeleteButton` con flujo de confirmación (`confirming` state).
    - Server action `deleteMobileUnit` ya validaba sesión (defense-in-depth).

## Consecuencias

### Positivas
- Paridad visual completa con `/branches` y resto del sistema.
- Eliminación ahora descubrible para ADMIN (previamente oculta por accidente).
- Modal de creación más rápido (no requiere navegar a `/new`).
- Empty state informativo para staff no-admin (sabe por qué no ve datos).
- Tokens consistentes (`purple-600`, `slate-900`, `rounded-xl`) — futuros módulos nuevos pueden copiarlos sin dudar.

### Negativas / Trade-offs
- Migración de `<table>` a cards rompe testid `units-table` (adaptado: ahora es el contenedor grid). Renombrar a `units-grid` sería más preciso, pero el spec de e2e ya esperaba el nombre y el cambio rompería tests legacy.
- Eliminación se movió de cards a detalle: ADMIN requiere 2 clicks (card → detalle → eliminar). Más seguro (evita clicks accidentales en card) y consistente con `BranchDeleteGuardModal`.
- Migración a modal implica 2 pasos para alta (crear básicos → completar en `/edit`). Trade-off a favor de UX (modal más rápido, edición detallada posterior).

### Remoción explícita
- **Botón "Editar" / "Calendario" / "Eliminar" por fila de tabla:** removidos al migrar a cards. Editar y Calendario se acceden desde la página de detalle. Eliminar también, pero solo ADMIN.
- **Filtros inline (select blanco a la derecha):** movidos a card con `shadow-sm` y label uppercase (paridad `/companies`).

## Archivos tocados

### Nuevos (4)
- `frontend/src/components/mobile-units/MobileUnitStatusBadge.tsx` — píldora paridad BranchStatusBadge.
- `frontend/src/components/mobile-units/MobileUnitCard.tsx` — card paridad BranchCard.
- `frontend/src/components/mobile-units/MobileUnitCreateModal.tsx` — modal paridad BranchCreateModal.
- `frontend/src/components/mobile-units/MobileUnitDeleteButton.tsx` — botón delete con confirm flow (ADMIN-only).

### Modificados (8)
- `frontend/src/components/mobile-units/constants.ts` — añadido `MOBILE_UNIT_STATUS_BADGE` (colores sutiles para badge).
- `frontend/src/components/mobile-units/MobileUnitForm.tsx` — tokens sistema, removida creación (ahora modal).
- `frontend/src/components/mobile-units/MobileUnitManager.tsx` — grid cards, header sistema, filtros en card, toggle.
- `frontend/src/app/admin/mobile-units/page.tsx` — wrapper mínimo.
- `frontend/src/app/admin/mobile-units/new/page.tsx` — `redirect()` server-side.
- `frontend/src/app/admin/mobile-units/[id]/page.tsx` — header sistema, cards, MobileUnitDeleteButton.
- `frontend/src/app/admin/mobile-units/[id]/edit/page.tsx` — wrapper con header sistema.
- `frontend/src/app/admin/mobile-units/[id]/maintenance/page.tsx` — wrapper con header sistema.
- `frontend/src/app/operations/mobile-units/page.tsx` — header sistema, tabs purple, spacing sistema.
- `frontend/src/actions/mobile-unit.actions.ts` — `revalidatePath('/operations/mobile-units')` en create/update/delete.
- `frontend/tests/mobile-units.spec.ts` — flujo migrado a cards+modal+delete en detalle.
- `context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md` — §5.6 actualizada.

## Validación
- `npx tsc --noEmit` — pasa sin errores.
- `npx vitest run` — 388/388 tests pasan (23 archivos, 0 fallos).
- GEMINI auditoría: `APROBADO_CON_OBSERVACIONES` (todas aplicadas antes de merge).
- Tests e2e actualizados al nuevo flujo (cards + modal + delete en detalle).

## Reversibilidad
Baja-media. Cambios contenidos en 12 archivos + SPEC + este ADR. Para revertir:
1. Restaurar `MobileUnitManager.tsx` desde git (tabla plana).
2. Restaurar `MobileUnitForm.tsx` (versión con creación).
3. Restaurar `/admin/mobile-units/new/page.tsx` (formulario).
4. Eliminar 4 archivos nuevos.
5. Revertir tokens en pages.

## Referencias
- Sistema de diseño inferido: `frontend/src/app/branches/_components/*` y `/branches/page.tsx`.
- ADR previo: `context/decisions/ADR-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES.md`.
- Discusión original: chat 2026-08-04 con Frank.