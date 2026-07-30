# SPEC-FIX-20260729-01 — Remediación de baseline frontend (3 gates a 0 errores)

**ID:** `FIX-20260729-01-BASELINE`
**Fecha:** 2026-07-29
**Prioridad:** P0 (bloqueante para IMPL-20260729-02)
**Tipo:** Fix baseline / deuda técnica
**Estado:** [~] En implementación (delegado a SOFIA)

---

## 1. Contexto

La baseline de `frontend/` está rota en sus tres gates:

- **TypeScript (`npm run typecheck`):** 30 errores
  - 28 errores preexistentes en archivos de tests por tipos de `vitest` y tipos de `ExpectChain` (no expuestos en el `tsconfig` actual)
  - 2 errores locales en `tests/flujo-completo.spec.ts` (líneas 73 y 360) que se corrigirán al editar el archivo
- **Vitest (`npm test`):** 12 fallos concentrados en un único archivo
  - `src/actions/__tests__/maintenance.helpers.test.ts`: `calculateNextDueDate is not a function`. El test importa del módulo `maintenance.actions.ts` una función que ya no se exporta o cuyo nombre no coincide.
- **ESLint (`npm run lint`):** 95 errores + 65 warnings en 59 archivos

Esta baseline bloquea el inicio de `IMPL-20260729-02` (gating estricto). Frank aprobó llevar los tres gates a **0 errores**.

## 2. Reglas ESLint y taxonomía

| Regla | Frecuencia | Estrategia |
|-------|-----------:|------------|
| `@typescript-eslint/no-unused-vars` | 46 (35 warnings + 11 errors) | Eliminar/renombrar imports y variables no usadas; quitar parámetros `_err` o usar `_` prefix. |
| `react-hooks/error-boundaries` | 37 errors | Refactorizar `try/catch` que envuelve JSX en cada componente (`src/app/events/[id]/page.tsx` concentra 37) hacia un error boundary real (vía `error.tsx` o componente `<ErrorBoundary>`). |
| `react-hooks/set-state-in-effect` | 25 errors | Mover lógica de hidratación a `useMemo`, derivar desde props, o usar patrón `useSyncExternalStore`/`useReducer` según corresponda; en componentes con fetch inicial, mover a `useState` lazy initializer o server actions. |
| `@typescript-eslint/no-explicit-any` | 16 errors | Reemplazar `any` por `unknown` con narrowing o por interfaces específicas ya existentes. |
| `react/no-unescaped-entities` | 10 errors | Reemplazar `"..."` por `&quot;...&quot;` en JSX. |
| `@next/next/no-img-element` | 5 warnings | Usar `<Image />` de `next/image` salvo que el archivo sea externo no controlable. |
| `react-hooks/exhaustive-deps` | 3 errors | Agregar/quitar dependencias de los `useEffect` correspondientes. |
| `@typescript-eslint/no-require-imports` | 2 errors | Convertir los `require()` a `import` ESM (caso en `useProjectReportStatus.test.ts`). |
| `@typescript-eslint/ban-ts-comment` | 1 error | Sustituir `@ts-ignore` por `@ts-expect-error` con descripción. |
| `@next/next/no-html-link-for-pages` | 1 error | Reemplazar `<a href="/lab/reception/">` por `<Link>`. |
| `@typescript-eslint/no-throw-literal` (regla faltante) | 1 error | Definir la regla en config o sustituir por `throw new Error('...')`. |
| `prefer-const` | 1 error | Convertir `let total` a `const total` en `lib/reports/conteos.ts`. |
| `@typescript-eslint/no-empty-object-type` | 1 error | Cambiar `interface Empty extends Foo {}` a `type Empty = Foo` o agregar miembros. |
| Errores de parser (`<parser>`) | 11 errors | Provienen de los archivos de tests sin tipos correctos; se resuelven al arreglar el tsconfig/test setup. |

## 3. Alcance

**Incluido:**

- Todos los archivos TypeScript/TSX bajo `frontend/src/`, `frontend/tests/`, `frontend/src/actions/__tests__/`, `frontend/src/components/**/__tests__/`, `frontend/src/hooks/__tests__/`, `frontend/src/lib/__tests__/`, `frontend/src/services/__tests__/`.
- Configuración:
  - `frontend/tsconfig.json` (ajuste de `types`, `lib`, o agregado de `vitest/expect` si la causa es configuración).
  - `frontend/eslint.config.*` (ajuste de reglas faltantes o activación de overrides por carpeta de tests para relajar reglas estructurales no relacionadas a producción sin devaluar código de producción).
  - `frontend/.eslintignore` → migrar a `ignores` en `eslint.config.js` (warning existente).

**Excluido:**

- Cambios funcionales al producto.
- Cambios al backend FastAPI.
- Cambios al schema Prisma o migraciones.
- Cambios a tests E2E más allá de lo mínimo necesario para que typecheck pase en `tests/flujo-completo.spec.ts`.
- Reescritura completa del componente de eventos `[id]/page.tsx`: mantener su comportamiento, solo extraer el `try/catch` a un `error.tsx`/boundary.

## 4. Decisiones arquitectónicas

### D1. Reglas con impacto estructural alto

- **`react-hooks/error-boundaries`**: se aplica exclusivamente porque hay `try/catch` que envuelve JSX. La solución correcta es:
  1. En `app/events/[id]/page.tsx` y `events/[id]/_components/*` envolver el bloque crítico en un boundary.
  2. En la raíz `app/events/[id]/` crear/ajustar `error.tsx` que muestre fallback con `reset()`.
  3. Mantener el `try/catch` solo donde captura errores esperados antes del render (queries, formateos, etc.), eliminando el envolvimiento JSX que ya no aporta.
- **`react-hooks/set-state-in-effect`**: para cada caso identificar si la solución correcta es:
  - Hidratación inicial desde props → mover a `useState` con `lazy initializer` o derivar durante render.
  - Sincronización con sistema externo → convertir a `useSyncExternalStore` o callback en suscripción.
  - Fetch inicial → preferir server actions / loader y pasar datos vía props; si es inevitable, mover a `useEffect` con cleanup y documentar la causa.

### D2. Tipos de Vitest en tests

- No se deben usar `vi`, `beforeEach`, `afterEach` desde `vitest` sin que `vitest` esté en `types` o `compilerOptions.types`. Se acepta cualquiera de:
  - A) agregar `"vitest/globals"` a `compilerOptions.types` en `frontend/tsconfig.json`.
  - B) conversión explícita a `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`.
  - C) configuración local `tsconfig.test.json` referenciada desde `tsconfig.json`.
- Preferir opción **B** explícita por archivo para evitar globals implícitos; si el costo es alto, usar opción **A** con acuerdo explícito.

### D3. `calculateNextDueDate`

- El test `src/actions/__tests__/maintenance.helpers.test.ts` línea 20-89 espera una función `calculateNextDueDate(completed, type, override?)` que devuelve `Date | null`. El módulo `src/actions/maintenance.actions.ts` muestra `STATUS_VALUES` no exportado.
- Estrategia: localizar la definición equivalente (puede estar renombrada o haber sido movida a un helper interno `mobile_unit_service.calculateNextDueDate`). Si existe y solo cambió el nombre, **actualizar el import** del test. Si no existe, **implementarla o reexportarla** desde `maintenance.actions.ts`.

### D4. ESLint config y overrides

- En `eslint.config.*` se pueden agregar overrides como:
  - `files: ["**/__tests__/**/*", "tests/**/*"]` con reglas relajadas: `no-explicit-any`, `no-unused-vars` (permitir `e`, `_`), `no-img-element`, exhaustive-deps.
  - `files: ["scripts/**"]` con reglas relajadas para scripts administrativos.
- No se permite degradar reglas en código de producción.

### D5. Variables sin uso

- Warnings de `no-unused-vars` en el archivo E2E (`tests/flujo-completo.spec.ts`) son cosméticos y no rompen gates; sin embargo, al pasar `lint` por completo con `0 errors` habrá que decidir si se eliminan o se configuran con prefijo `_`. Preferir prefijo `_` para no perder trazabilidad.

## 5. Definition of Ready

- [x] Plan estratégico aprobado por Frank (gating estricto + 0 errores)
- [x] Inventario de errores capturado (esta SPEC, sección 2)
- [x] Decisiones arquitectónicas definidas (sección 4)
- [ ] Snapshot de baseline (timestamp + commit) previo a edición
- [ ] Sin dependencias pendientes fuera del árbol del proyecto

## 6. Definition of Done

- `cd frontend && npm run typecheck` → **0 errores, 0 warnings**.
- `cd frontend && npm test` → **todos los tests pasando** (los 273 actuales; los 12 de `maintenance.helpers.test.ts` corregidos).
- `cd frontend && npm run lint` → **0 errores, 0 warnings** (los 160 problemas resueltos).
- Sin cambios en:
  - contratos públicos de endpoints/servidor.
  - esquema Prisma o migraciones.
  - archivos del backend (`backend/`).
  - archivos UI sin justificación (cambios deben limitarse a lo necesario para gates).
- Checkpoint final `context/checkpoints/CHK_FIX-20260729-01-BASELINE.md` con:
  - antes/después por gate (cifras exactas).
  - lista de archivos modificados y breve justificación.
  - lista de archivos de tests/config sin cambios.
  - commit hash y comandos de validación ejecutados.
- PROYECTO.md actualizado con cierre de `FIX-20260729-01-BASELINE` y desbloqueo de `IMPL-20260729-02`.
- Reporte a INTEGRA con archivos tocados, evidencia de gates verdes y self-review.

## 7. Procedimiento de remediación (orientativo)

1. **Snapshot:** ejecutar los tres comandos y guardar salida cruda en `context/audits/baseline-20260729-{before,after}.txt`.
2. **Orden recomendado:**
   1. TypeScript config + tipos de vitest → desbloquea casi todo typecheck.
   2. `maintenance.helpers.test.ts` + export `calculateNextDueDate`.
   3. ESLint config global + overrides para tests.
   4. Errores triviales (prefer-const, ban-ts-comment, no-empty-object-type, no-html-link-for-pages, no-require-imports, no-unescaped-entities).
   5. `no-explicit-any` (16 casos).
   6. `no-unused-vars` (46 casos).
   7. `react-hooks/exhaustive-deps` (3 casos).
   8. `react-hooks/set-state-in-effect` (25 casos) — más delicado.
   9. `react-hooks/error-boundaries` (37 casos concentrados en `events/[id]/page.tsx`).
   10. Warnings `<img>` (`next/image` cuando aplique).
3. **Iteración:** tras cada bloque, re-ejecutar el gate correspondiente y no avanzar si quedan errores del bloque previo.
4. **Self-review final:** comparar diff y gates contra snapshot inicial.

## 8. Riesgos

- **R1: regresión funcional al refactorizar `events/[id]/page.tsx`** — mitigar extrayendo solo el `try/catch` a error boundary; preservar render intacto.
- **R2: configuración de Vitest types mal aplicada** — preferir opción B (imports explícitos) para tests.
- **R3: cambio de export `calculateNextDueDate` rompe otros tests/usos** — buscar referencias antes de renombrar.
- **R4: ruido en changelog** — agrupar commits por gate (uno por gate resuelto).
- **R5: degradación accidental de reglas en código de producción** — overrides SOLO para `**/__tests__/**`, `tests/**` y opcional `scripts/**`; el resto mantiene strict.

## 9. Entregables

1. Cambios en código fuente cubiertos por la sección 3.
2. Configuración TypeScript/ESLint ajustada.
3. `context/audits/baseline-20260729-before.txt` y `baseline-20260729-after.txt`.
4. `context/checkpoints/CHK_FIX-20260729-01-BASELINE.md` con métricas.
5. Commit(s) y push autorizado por Frank posterior a la validación.
6. Reporte estructurado de cierre (SOFIA → INTEGRA → Frank) con archivos tocados, líneas modificadas, resultado de gates y capturas de validación.

## 10. Estado

[~] **En implementación**
**Responsable:** @SOFIA
**Gating:** IMPL-20260729-02 (Gap G2/G3) bloqueado hasta gates verdes.
**Próxima acción:** Delegar a SOFIA con handoff completo que cite esta SPEC como contrato; GEMINI auditará el incremento antes de cerrar `DONE`.
