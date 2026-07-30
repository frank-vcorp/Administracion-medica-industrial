# Plan FIX-20260730-02 (extend scope) — SUPERADMIN en lab/migration

**ID intervención:** FIX-20260730-03  
**ID tarea:** FIX-20260730-02  
**SPEC:** `context/SPECs/SPEC_FIX-20260730-02-SUPERADMIN-INHERITS-ADMIN.md`, sección “Sitios residuales (FIX-20260730-02 extend scope — segunda iteración)”

## Objetivo

Propagar la herencia `SUPERADMIN ⊃ ADMIN` a las guardas residuales de los módulos `lab` y `migration`, reutilizando exclusivamente `isAdminLike` desde `@/lib/auth/roles`, sin modificar el helper, sus tests, contratos públicos, esquemas, dependencias ni comportamiento ajeno a autorización.

## Estado inicial verificado

- Working tree contiene los 13 cambios de la primera iteración y el helper/tests nuevos; se preservarán.
- Ninguno de los 16 archivos del alcance tiene cambios previos locales.
- Baseline frontend:
  - `./node_modules/.bin/tsc --noEmit`: PASS, 0 errores.
  - `./node_modules/.bin/vitest run`: PASS, 20 archivos y 291/291 tests.
  - `./node_modules/.bin/eslint .`: PASS según criterio solicitado, 0 errores; 12 warnings preexistentes fuera del alcance.
- Inventario actual:
  - 15 guardas negativas `role !== "ADMIN"` dentro de los archivos listados.
  - `app/api/lab/cat2/[mod]/route.ts` usa una guarda positiva `role === "ADMIN"`; se transformará a `isAdminLike(role)` para cumplir la misma semántica de la SPEC.
- Dependientes identificados: componentes de recepción, catálogos, resultados, trazabilidad y migración importan las acciones; las rutas conservan métodos, firmas, respuestas y códigos HTTP. No requieren edición.

## Implementación

### Corte 1 — Server Actions

Añadir `import { isAdminLike } from '@/lib/auth/roles'` respetando el estilo de comillas/formato de cada archivo, y sustituir la guarda ADMIN-only por `!isAdminLike(role)` en:

1. `frontend/src/actions/lab-order.actions.ts`
2. `frontend/src/actions/lab-catalog.actions.ts`
3. `frontend/src/actions/lab-result.actions.ts`
4. `frontend/src/actions/lab-trace.actions.ts`
5. `frontend/src/actions/migration.actions.ts`

Validación incremental: `./node_modules/.bin/tsc --noEmit`.

### Corte 2 — Páginas admin

Añadir el mismo helper y cambiar la condición de rechazo a `!isAdminLike(session.user?.role)` en:

6. `frontend/src/app/admin/lab/cutover/page.tsx`
7. `frontend/src/app/admin/lab/migration/page.tsx`

Se preservan redirects y estados de error existentes.

Validación incremental: `./node_modules/.bin/tsc --noEmit`.

### Corte 3 — API routes de laboratorio

Añadir el helper y actualizar únicamente la guarda RBAC en:

8. `frontend/src/app/api/lab/search/[type]/route.ts`
9. `frontend/src/app/api/lab/catalogs/[mod]/route.ts`
10. `frontend/src/app/api/lab/cat2/[mod]/route.ts`
11. `frontend/src/app/api/lab/orders/route.ts`
12. `frontend/src/app/api/lab/orders/[id]/confirm/route.ts`
13. `frontend/src/app/api/lab/orders/[id]/route.ts`
14. `frontend/src/app/api/lab/orders/[id]/items/route.ts`
15. `frontend/src/app/api/lab/orders/[id]/items/[itemId]/route.ts`

En `cat2`, sustituir la guarda positiva por `if (isAdminLike(session?.user?.role)) return session.user`; en las otras rutas usar `!isAdminLike(role)` dentro de la condición de rechazo existente. Se preservan `await params` de Next.js 16, validación, acceso Prisma y códigos HTTP.

Validación incremental: `./node_modules/.bin/tsc --noEmit`.

### Corte 4 — API admin migrate

Añadir el helper y sustituir la guarda por `!isAdminLike(session.user.role)` en:

16. `frontend/src/app/api/admin/migrate/route.ts`

Se mantienen intactos el requisito de `MIGRATE_SECRET`, diagnóstico y ejecución de migraciones.

## Validación final

Desde `frontend/`:

1. `./node_modules/.bin/tsc --noEmit` — esperado: exit 0, 0 errores.
2. `./node_modules/.bin/vitest run` — esperado: todos los tests verdes, sin tests nuevos/modificados.
3. `./node_modules/.bin/eslint .` — esperado: 0 errores; comparar warnings con los 12 preexistentes.
4. Verificación residual:
   `grep -rn "role !== 'ADMIN'\|role !== \"ADMIN\"" src/ --include="*.ts" --include="*.tsx" | grep -v "lib/auth/roles.ts"`
   — esperado: salida vacía.
5. Verificación adicional de la variante positiva: confirmar que `cat2/[mod]/route.ts` ya no contiene comparación directa con `ADMIN` y usa `isAdminLike`.
6. Revisar `git diff --check`, `git diff --` limitado a los 16 archivos y `git status --short` para asegurar ausencia de cambios fuera de alcance.

## Self-review y límites

- Confirmar que solo se amplía ADMIN a SUPERADMIN; ADMIN conserva comportamiento y roles inferiores siguen rechazados.
- Confirmar que no se altera `frontend/src/lib/auth/roles.ts` ni `frontend/src/lib/auth/__tests__/roles.test.ts`.
- No crear tests, porque la tarea pide solo verificación y el helper ya cubre SUPERADMIN/ADMIN/roles inferiores/nulos.
- No modificar mensajes de UI o comentarios históricos aunque mencionen “ADMIN”; no forman parte de la guarda ni del grep requerido.
- No commit, push, PR, deploy, migraciones ni acciones destructivas.

## Reporte de cierre

Reportar rutas y líneas finales de los 16 archivos, resultados de los tres gates, salida vacía del grep residual, resultado de `git diff --check`, y cualquier desviación. La única desviación conocida de la tabla es la forma positiva real del check en `cat2`, resuelta con `isAdminLike` sin ampliar alcance.
