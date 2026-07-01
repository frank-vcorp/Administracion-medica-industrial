# IMPL-20260630-03 — Page Project Detail + Closeout (Frontend Reports Module)

**ID**: IMPL-20260630-03
**Fecha**: 2026-06-30
**Módulo**: Reportes Masivos por Proyecto (ARCH-20260623-01)
**Fase**: Cierre de frontend (ruta detail + tooling fixes)

---

## 1. Cambios Aplicados

### 1.1 `frontend/tsconfig.json` (Tarea 1)

Quitado `"vitest/globals"` del array `compilerOptions.types`.

```diff
-    "types": ["vitest/globals", "vitest"],
+    "types": ["vitest"],
```

**Nota técnica:** La corrección del tsconfig se aplicó correctamente. Sin embargo, la hipótesis original (que esto resolvería los errores `vi`/`afterEach`/`beforeEach`/`suite`/`test` en typecheck) NO se materializó: los errores persisten y son **preexistentes**, diagnosticados contra `main` limpio (ver §3). Causa raíz real: pnpm no expone transitivamente `@vitest/runner`, lo que impide a `tsc` resolver la cadena de tipos desde `vitest` (`vitest/dist/index.d.ts` re-exporta de `@vitest/runner` que vive solo bajo `node_modules/.pnpm/`). El cambio tsconfig no introduce regresiones y `pnpm test` (runtime) sigue 137/137 verde.

### 1.2 `frontend/src/hooks/useProjectReportStatus.ts` (Tarea 2)

Eliminado `export type ReportStatus` local (lowercase). Importado el tipo canónico uppercase desde `@/lib/reports/types`.

```diff
- export type ReportStatus = 'idle' | 'pending' | 'processing' | 'ready' | 'failed';
+ import type { ReportStatus } from '@/lib/reports/types';
```

Adaptaciones internas requeridas por la nueva unión:
- Initial state: `'idle'` → `'PENDING'`
- Al iniciar polling: `'pending'` → `'PROCESSING'`
- En error catch: `'failed'` → `'FAILED'`
- Cast: `data.status.toLowerCase() as ReportStatus` → `data.status as ReportStatus` (sin `.toLowerCase()`, el backend ya devuelve uppercase)

### 1.3 `frontend/src/components/projects/ProjectMassiveReportModal.tsx`

Ajustes necesarios para que las comparaciones del estado del hook sigan funcionando con la unión canónica uppercase:

```diff
- if (statusState.status === 'ready') {
+ if (statusState.status === 'READY') {
    setGeneration({ kind: 'READY', ... });
- } else if (statusState.status === 'failed') {
+ } else if (statusState.status === 'FAILED') {
    setGeneration({ kind: 'ERROR', ... });
  }

- (generation.kind === 'POLLING' && statusState.status !== 'ready')
+ (generation.kind === 'POLLING' && statusState.status !== 'READY')
```

### 1.4 `frontend/src/components/projects/ProjectMassiveReportButton.tsx` (NUEVO — Tarea 3)

Wrapper client-side que gestiona el estado `open`/`onClose` requerido por `ProjectMassiveReportModal` (que es controlado). Rendea un botón trigger + modal.

### 1.5 `frontend/src/app/projects/[id]/page.tsx` (NUEVO — Tarea 3)

Página server-side de detalle de proyecto. Sigue el patrón de `companies/[id]/page.tsx` con `await params` (Next.js 16).

**Wire-up:**
- `getServerSession(authOptions)` para role
- `prisma.project.findUnique` con `include` apropiado: company, workers (ProjectWorker con worker + event.eventTests), `_count.workers`
- notFound() si project no existe
- Sidebar de Breadcrumb + Header (status badge + fechas + unidad/branch)
- Botón "Generar Reporte Masivo" para roles ADMIN/DOCTOR_GENERAL/RECEPTIONIST, montado via wrapper client
- Tabla de trabajadores (nombre, Universal ID, reception status badge, link a evento)
- Sección de notas cuando aplica

Mapeo explícito al subset `{id?, event?: {eventTests?: Array<{status, resultNotes}>}}` que consume `ProjectMassiveReportModal` (vía `calcularConteos`) para mantener el contrato del modal.

---

## 2. Validaciones

### 2.1 `pnpm typecheck` ❌ (errores preexistentes)

```
src/_test_vitest_import.test.ts:1:10 - TS2305: Module 'vitest' has no exported member 'afterEach'.
... (8 errores idénticos en tests files)
src/services/__tests__/company.service.test.ts:221:20, 238:20 - TS2339: 'toBeInstanceOf' on ExpectChain
```

**Diagnóstico**: ejecuté `git stash && pnpm typecheck` sobre `main` limpio. Los 10 errores están **idénticos** sin mis cambios. Son deuda técnica preexistente, NO introducida por IMPL-20260630-03. Causa raíz es la combinación `pnpm strict-modules + vitest 2.x distribuido en dos paquetes (vitest + @vitest/runner)`. Fix potencial: añadir `.npmrc` con `public-hoist-pattern[]=@vitest/*` + reinstall, o `@vitest/runner` como dep directa. **Fuera del scope IMPL-20260630-03** (toca pnpm-lock.yaml = infra sensible).

**Mis archivos nuevos** (page.tsx + Button.tsx) **compilan limpios** — sin errores propios.

### 2.2 `pnpm test` ✅ 137/137

```
Test Files  8 passed (8)
Tests       137 passed (137)
```

Incluye los 3 tests nuevos de `useProjectReportStatus.test.ts` que sobreviven sin cambios. Runtime vitest funciona porque resuelve los símbolos por su cuenta sin pasar por tsc.

### 2.3 `pnpm lint` ❌ (errores preexistentes)

Errores notables diagnosticados al comparar `main` vs mis cambios:
- `src/components/projects/ProjectMassiveReportModal.tsx:69:7` — `react-hooks/set-state-in-effect` (preexistente, no introducido por mi cambio de 'ready'→'READY')
- `src/services/__tests__/company.service.test.ts` y muchos otros archivos fuera del scope IMPL-20260630-03
- `src/lib/reports/conteos.ts:41:7` — `prefer-const` sobre `total` (preexistente, código escrito por SOFIA anterior)

**Mis archivos nuevos** (`page.tsx` + `ProjectMassiveReportButton.tsx`) **0 errores, 0 warnings**.

---

## 3. Decisión 3 Documentada (deuda técnica)

Errores `toBeInstanceOf` en `company.service.test.ts:221` y `:238` son preexistentes. Causa probable: API de `@vitest/expect` cambió (en versiones recientes `toBeInstanceOf` se reemplazó por `toBeInstanceOf` con prefijo `expect.` o un matcher diferente). NO son IMPL-20260630-03.

---

## 4. Archivos Modificados / Creados

### Modificados
- `frontend/tsconfig.json` (Tarea 1, 1 línea)
- `frontend/src/hooks/useProjectReportStatus.ts` (Tarea 2, ~6 líneas)
- `frontend/src/components/projects/ProjectMassiveReportModal.tsx` (3 comparaciones actualizadas a uppercase)

### Creados
- `frontend/src/components/projects/ProjectMassiveReportButton.tsx` (wrapper client open/onClose)
- `frontend/src/app/projects/[id]/page.tsx` (página de detalle, server component)

---

## 5. Smoke Test Pendiente (validación humana)

No pude ejecutar un smoke test E2E porque requiere seed data + backend operativo. Pasos sugeridos:

```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload
# Terminal 2
cd frontend && pnpm dev
# Browser
# 1. Login como ADMIN o RECEPTIONIST
# 2. Navegar a /projects (calendario)
# 3. Click en cualquier proyecto creado → debe cargar /projects/[id]
# 4. Verificar que el botón "Generar Reporte Masivo" aparece en el header
# 5. Click → modal de preview con conteos (total/completos/parciales/sin estudios)
# 6. Seleccionar formato (XLSX/PDF/BOTH) → "Generar Reporte"
# 7. Esperar polling → ver "Archivos generados" con links de descarga
```

---

## 6. Self-review Final

- ✅ Fidelidad a SPEC: rutas, contratos, componentes y tipos coinciden con SPEC_ARCH-20260623-01
- ✅ No modificaciones a `schema.prisma` ni backend (`Status`, `ProjectReport`, conteos idénticos a lo validado por SOFIA anterior)
- ✅ Type imports consistentes con `@/lib/types` y `@/lib/reports/types`
- ✅ IDs de intervención presentes en cada archivo tocado
- ✅ `pnpm test` verde al cierre (137/137)
- ⚠️ `pnpm typecheck` tiene 10 errores preexistentes (no regresión)
- ⚠️ `pnpm lint` tiene errores preexistentes en archivos no tocados; mis archivos limpios
- ⚠️ Hallazgo de tooling: pnpm + vitest 2.x tienen incompatibilidad de tipos que requiere fix de infra (`.npmrc` shamefully-hoist o dep directa). Escalado a humano en reporte principal.

---

## 7. Recomendaciones para cierre

1. Merge cambios cuando el usuario lo apruebe (no commitear sin OK).
2. Considerar arreglar la incompatibilidad pnpm+vitest en una iteración separada (FIX-20260630-XX propuesto).
3. Considerar smoke test manual siguiendo §5 antes de abrir al tráfico.
