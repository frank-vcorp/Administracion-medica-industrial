# HANDOFF ARCH-20260623-03 FASE 7.1 a SOFIA — Fixes triviales para destrabar typecheck/lint

- ID: ARCH-20260623-03 (Fase 7.1 / Fixes triviales)
- Fecha: 2026-06-24
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion (cierre de quality gate pre-GEMINI)

## Objetivo

Llevar `pnpm typecheck` a 0 errores y `pnpm lint` a 0 warnings nuevos dentro del módulo Ficha Cliente v2. 4 fixes triviales.

## Alcance exacto

### Fix 1 — Typecheck error en `companies/[id]/page.tsx`

Archivo: `frontend/src/app/companies/[id]/page.tsx`

Error verbatim:
```
src/app/companies/[id]/page.tsx(51,43): error TS2769
  Type 'string | null' is not assignable to type 'string'
```

**Causa**: callback `(profile) => profile.companyId === companyId` donde `profile.companyId` es `string | null` (Prisma) y `companyId` es `string`.

**Fix**: cambiar a `(profile) => profile.companyId === company.id` (asumiendo que `company.id` siempre es string). O agregar null check: `(profile) => profile.companyId != null && profile.companyId === company.id`. Elige la opción más legible.

### Fix 2 — Warning en `CompanyFullFormView.tsx`

Archivo: `frontend/src/components/companies/CompanyFullFormView.tsx`

```
10:6  warning  'JsonLike' is defined but never used
```

**Fix**: eliminar el import no usado de `JsonLike` en la línea 10.

### Fix 3 — Warning en `SelfRegistrationForm.tsx`

Archivo: `frontend/src/components/companies/SelfRegistrationForm.tsx`

```
628:3  warning  'seccion' is defined but never used
```

**Fix**: la línea 628 define un parámetro o variable `seccion` que no se usa. Si es un parámetro de función que la API espera, prefija con `_seccion`. Si es una variable local, elimínala.

### Fix 4 — Consolidar `next-auth.d.ts` duplicado

Archivos:
- `frontend/types/next-auth.d.ts` (raíz, recién creado)
- `frontend/src/types/next-auth.d.ts` (en src, recién creado)

**Diagnóstico**: hay 2 archivos `next-auth.d.ts`. Uno en `frontend/types/` (fuera de src) y otro en `frontend/src/types/`. Solo uno debe existir. La convención del proyecto es dentro de `src/`.

**Fix**:
1. Compara el contenido de ambos.
2. Si son idénticos: elimina `frontend/types/next-auth.d.ts` (raíz).
3. Si difieren: consolida el contenido correcto en `frontend/src/types/next-auth.d.ts` y elimina el otro.
4. Verifica que `tsconfig.json` incluya `src/types` en `include` o que el archivo sea detectado automáticamente.

### Validaciones obligatorias

```bash
cd frontend && npm run typecheck
cd frontend && npm test -- --run
cd frontend && npm run lint
```

**Criterio de cierre**:
- `typecheck`: **0 errores totales**.
- `test`: **15/15 pasan** (no deben cambiar).
- `lint`: 29 errores pre-existentes OK; **0 warnings nuevos en archivos del módulo**.

Reporta **output literal completo** de cada comando (pega stdout/stderr entero, no resumas).

### Checkpoint

Actualiza `context/checkpoints/CHK_IMPL-20260623-03-FASE7-CORRECCION-TYPECHECK.md` agregando una sección "Fase 7.1 — Fixes triviales" con:
1. Output literal de las 3 validaciones post-fix.
2. Confirmación de 0 typecheck errors y 0 warnings nuevos.

## Restricciones duras

1. NO modifiques archivos fuera de los 4 listados + checkpoint.
2. NO introduzcas dependencias nuevas.
3. NO hagas commit, push ni PR.
4. NO borres archivos (salvo el `next-auth.d.ts` duplicado en Fix 4).
5. NO modifiques variables de entorno.

## Self-review (3 preguntas)

1. ¿Output literal de las 3 validaciones post-fix?
2. ¿Quedó algún archivo `next-auth.d.ts` y dónde?
3. ¿Warnings pre-existentes en archivos del módulo que persistan?

## Reporte final

- Resumen 1-2 líneas.
- Archivos modificados (4 + checkpoint).
- Output literal completo de `npm run typecheck`, `npm test -- --run`, `npm run lint`.
- Self-review 3 preguntas.
- Sugerencia explícita de invocar GEMINI.

NO invoques GEMINI. NO commit/push/PR.