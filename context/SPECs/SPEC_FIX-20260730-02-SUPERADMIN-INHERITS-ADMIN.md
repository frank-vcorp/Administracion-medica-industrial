# SPEC_FIX-20260730-02 — SUPERADMIN hereda permisos de ADMIN

**ID:** FIX-20260730-02
**Tipo:** Fix (cross-cutting)
**Prioridad:** P1 (bloquea uso real de SUPERADMIN)
**Stack:** Next.js 16 (App Router) + Prisma + TypeScript
**Autor:** INTEGRA (2026-07-30)
**Origen:** Frank 2026-07-30 05:55 — "estoy como superadmin pero me limitaste los permisos, también debo ver todo lo que ve el admin"

---

## 1. Problema

`IMPL-20260730-01` añadió el rol `SUPERADMIN` con permisos de eliminación masiva, pero **NO propagó** el rol a través del sistema de autorización. Resultado: SUPERADMIN está bloqueado por defecto en casi todas las rutas/acciones del sistema.

Auditoría completa (24 lugares):

| Archivo | Línea | Patrón |
|---------|-------|--------|
| `frontend/src/middleware.ts` | 41 | `token.role !== "ADMIN"` (bloquea `/admin/*`) |
| `frontend/src/components/AppShell.tsx` | 100 | `isAdmin = role === 'ADMIN'` (sidebar no muestra admin sections) |
| `frontend/src/components/companies/CompanyActionsPanel.tsx` | 57-60 | `role === 'ADMIN'` (toggle, change seller) |
| `frontend/src/components/companies/GenerateCompletionLinkButton.tsx` | 38 | `role === 'ADMIN' \|\| role === 'VENDEDOR'` |
| `frontend/src/components/CompanyFormModal.tsx` | 46 | `role === 'ADMIN' \|\| role === 'VENDEDOR'` |
| `frontend/src/lib/schemas/company-full-form.ts` | 318 | `user.role !== 'VENDEDOR' && user.role !== 'ADMIN'` |
| `frontend/src/actions/timeline.actions.ts` | 19, 43 | `role !== 'ADMIN'` |
| `frontend/src/actions/audit.actions.ts` | 80 | `role !== 'ADMIN'` |
| `frontend/src/actions/maintenance.actions.ts` | 69 | `role !== 'ADMIN'` |
| `frontend/src/actions/mobile-unit.actions.ts` | 74 | `role !== 'ADMIN'` |
| `frontend/src/actions/company.actions.ts` | 93, 118, 181, 204, 301, 357 | `role !== 'ADMIN'` o `role === 'ADMIN'` |
| `frontend/src/app/companies/[id]/edit/page.tsx` | 35 | `role !== 'ADMIN'` |
| `frontend/src/app/companies/[id]/page.tsx` | 75 | `role === 'ADMIN'` |

### Sitios residuales (FIX-20260730-02 extend scope — segunda iteración)

Detectados durante implementación: hay **16 checks adicionales** en módulos `lab/` y `migration` que no estaban en el alcance original de la SPEC §1. Como Frank explícitamente pidió "ver todo lo que ve el admin", la propagación incluye también:

| Archivo:línea | Patrón | Helper a aplicar |
|---|---|---|
| `frontend/src/actions/lab-order.actions.ts:63` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/actions/lab-catalog.actions.ts:81` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/actions/lab-result.actions.ts:58` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/actions/lab-trace.actions.ts:45` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/actions/migration.actions.ts:61` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/admin/lab/cutover/page.tsx:49` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/admin/lab/migration/page.tsx:21` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/api/lab/search/[type]/route.ts:45` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/api/lab/catalogs/[mod]/route.ts:71` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/api/lab/cat2/[mod]/route.ts:31` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/api/lab/orders/route.ts:36` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/api/lab/orders/[id]/confirm/route.ts:21` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/api/lab/orders/[id]/route.ts:26` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/api/lab/orders/[id]/items/route.ts:23` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/api/lab/orders/[id]/items/[itemId]/route.ts:21` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `frontend/src/app/api/admin/migrate/route.ts:155` | `role !== 'ADMIN'` | `!isAdminLike(role)` |

Total final tras FIX-20260730-02: **40 sitios** actualizados.

## 2. Decisión arquitectónica

**Jerarquía de roles (de mayor a menor privilegio):**

```
SUPERADMIN ⊃ ADMIN ⊃ VENDEDOR ⊃ RECEPTIONIST, DOCTOR_*, CAPTURIST, COMPANY_CLIENT
```

`SUPERADMIN` hereda **todos** los permisos de `ADMIN` (más las acciones destructivas de IMPL-20260730-01). `ADMIN` no hereda los permisos de SUPERADMIN (la separación de poderes se preserva).

**Implementación:** Helper centralizado `frontend/src/lib/auth/roles.ts` con funciones puras. Refactor de las 24 comprobaciones para usarlas.

## 3. Modelo de datos

Sin cambios en schema. Solo comportamiento.

## 4. Diseño

### 4.1 Helper module

**Nuevo:** `frontend/src/lib/auth/roles.ts`

```ts
import type { UserRole } from '@prisma/client'

/**
 * Roles con privilegios administrativos (sidebar admin, edición de empresas, etc.).
 * SUPERADMIN hereda todos los permisos de ADMIN.
 */
export const ADMIN_LIKE_ROLES: readonly UserRole[] = ['SUPERADMIN', 'ADMIN']

/** Roles con permisos de gestión comercial (vendedor, admin, super). */
export const SELLER_LIKE_ROLES: readonly UserRole[] = ['SUPERADMIN', 'ADMIN', 'VENDEDOR']

/** ¿Tiene el rol permisos de admin o superior? */
export function isAdminLike(role: UserRole | string | null | undefined): boolean {
  if (!role) return false
  return (ADMIN_LIKE_ROLES as readonly string[]).includes(role)
}

/** ¿Tiene el rol permisos de vendedor o superior? */
export function isSellerLike(role: UserRole | string | null | undefined): boolean {
  if (!role) return false
  return (SELLER_LIKE_ROLES as readonly string[]).includes(role)
}

/** ¿Tiene el rol permisos destructivos (sólo SUPERADMIN)? */
export function isSuperAdmin(role: UserRole | string | null | undefined): boolean {
  return role === 'SUPERADMIN'
}
```

### 4.2 Tabla de reemplazos

| Archivo:línea | Antes | Después |
|---|---|---|
| `middleware.ts:41` | `if (token.role !== "ADMIN")` | `if (!isAdminLike(token.role))` |
| `AppShell.tsx:100` | `const isAdmin = role === 'ADMIN'` | `const isAdmin = isAdminLike(role)` |
| `CompanyActionsPanel.tsx:57-60` | `role === 'ADMIN' \|\| role === 'VENDEDOR'` | `isSellerLike(role)` |
| `CompanyActionsPanel.tsx:58` | `role === 'ADMIN'` | `isAdminLike(role)` |
| `GenerateCompletionLinkButton.tsx:38` | `role === 'ADMIN' \|\| role === 'VENDEDOR'` | `isSellerLike(role)` |
| `CompanyFormModal.tsx:46` | `role === 'ADMIN' \|\| role === 'VENDEDOR'` | `isSellerLike(role)` |
| `company-full-form.ts:318` | `user.role !== 'VENDEDOR' && user.role !== 'ADMIN'` | `!isSellerLike(user.role)` |
| `timeline.actions.ts:19,43` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `audit.actions.ts:80` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `maintenance.actions.ts:69` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `mobile-unit.actions.ts:74` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `company.actions.ts:93,118,181,301` | `role !== 'ADMIN' && role !== 'VENDEDOR'` | `!isSellerLike(role)` |
| `company.actions.ts:204,357` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `companies/[id]/edit/page.tsx:35` | `role !== 'ADMIN'` | `!isAdminLike(role)` |
| `companies/[id]/page.tsx:75` | `role === 'ADMIN'` | `isAdminLike(role)` |

### 4.3 Tests del helper

**Nuevo:** `frontend/src/lib/auth/__tests__/roles.test.ts`

Cubrir:
- `isAdminLike('SUPERADMIN')` → true
- `isAdminLike('ADMIN')` → true
- `isAdminLike('VENDEDOR')` → false
- `isAdminLike('COMPANY_CLIENT')` → false
- `isAdminLike(null/undefined/'')` → false
- `isSellerLike('SUPERADMIN')` → true
- `isSellerLike('ADMIN')` → true
- `isSellerLike('VENDEDOR')` → true
- `isSellerLike('COMPANY_CLIENT')` → false
- `isSuperAdmin('SUPERADMIN')` → true
- `isSuperAdmin('ADMIN')` → false

## 5. Estructura de archivos

```
frontend/src/
  lib/
    auth/
      roles.ts                (NUEVO)
      __tests__/
        roles.test.ts         (NUEVO)
  middleware.ts               (modificado)
  components/
    AppShell.tsx              (modificado)
    CompanyFormModal.tsx      (modificado)
    companies/
      CompanyActionsPanel.tsx (modificado)
      GenerateCompletionLinkButton.tsx (modificado)
  actions/
    timeline.actions.ts       (modificado)
    audit.actions.ts          (modificado)
    maintenance.actions.ts    (modificado)
    mobile-unit.actions.ts    (modificado)
    company.actions.ts        (modificado)
  app/
    companies/
      [id]/
        edit/page.tsx         (modificado)
        page.tsx              (modificado)
  lib/
    schemas/
      company-full-form.ts    (modificado)
```

## 6. Seguridad

| Capa | Mecanismo |
|------|-----------|
| **Helper centralizado** | Una sola fuente de verdad para "qué roles pueden hacer qué". |
| **Tests del helper** | Cualquier nuevo rol debe actualizar el helper (no se puede olvidar). |
| **Backend FastAPI** | No se modifica: el frontend sigue siendo la fuente de verdad de auth. |
| **Middleware** | Único punto de control de rutas: cubre `/admin/*` para SUPERADMIN. |

## 7. Riesgos y edge cases

1. **Regresión de permisos:** Un ADMIN actual podría ver cosas nuevas. NO — la semántica es "SUPERADMIN ⊃ ADMIN", ADMIN no cambia.
2. **Tests existentes** que asumen que sólo ADMIN pasa: revisar `company.service.test.ts` y `audit.actions.test.ts` si existen.
3. **Componentes con render condicional** (`isAdmin && <Componente />`): pueden romper si `isAdmin` cambia de `boolean` a `boolean` (sin cambio de tipo). Verificar el wrapping de la condicional.
4. **Tipos de UserRole**: el helper acepta `UserRole | string | null | undefined` para compatibilidad con código que compara strings sin cast.

## 8. Plan de pruebas

### 8.1 Vitest del helper (NUEVO)
- Cubrir los 11 casos listados en §4.3.

### 8.2 Verificación manual (Frank)
- Login como SUPERADMIN en producción.
- Verificar:
  - Acceso a `/admin/users` (antes bloqueado).
  - Sidebar muestra secciones de admin.
  - Botón "Configurar Empresa" editable.
  - Botón "Toggle habilitar/deshabilitar" visible.
  - En `/companies`, aparecen los checkboxes (ya estaba) Y el botón Editar también.
  - Login como ADMIN normal: comportamiento idéntico al actual (no regresión).
  - Login como VENDEDOR: sigue viendo sus permisos restringidos.
  - Login como COMPANY_CLIENT: sigue sin acceso a `/admin/*`.

## 9. Definition of Done

- [ ] `pnpm typecheck` → 0 errores.
- [ ] `pnpm test` → todos verde (incluidos los nuevos).
- [ ] `pnpm lint` → 0 errores.
- [ ] Smoke test manual con SUPERADMIN (login + acceder a `/admin/*` + editar empresa + ver sidebar admin).
- [ ] Smoke test con ADMIN, VENDEDOR, COMPANY_CLIENT (sin regresión).
- [ ] GEMINI revisión final sin bloqueadores.
- [ ] Commit + push a `main` espera confirmación explícita de Frank.

## 10. NO HACER

- No commitear, pushear ni hacer PR sin OK explícito de Frank.
- No aplicar cambios al backend FastAPI.
- No cambiar la jerarquía ni añadir permisos nuevos (sólo propagar SUPERADMIN como ≥ ADMIN).
- No eliminar SUPERADMIN ni revertir IMPL-20260730-01.