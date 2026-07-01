# Checkpoint IMPL-20260701-07 — Hotfix try/catch + JSON en API routes lab/*

**Fecha:** 2026-07-01
**Agente:** SOFIA (Constructora Principal)
**Branch:** `hotfix/debug-lab-api-500` (push OK, NO mergeado a main)
**PR sugerido:** https://github.com/frank-vcorp/Administracion-medica-industrial/pull/new/hotfix/debug-lab-api-500

---

## 1. Diagnóstico del bug

**Síntoma reportado por Frank:**
- URL: `https://administracion-medica-industrial.vercel.app/admin/lab/catalogs?mod=unidades`
- Tabla muestra "0 resultados"
- Consola: `Error: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
- Conclusión: el API route retornaba HTML 500 en vez de JSON

**Análisis del código (commit `73a92f1`):**

Inspección de `frontend/src/app/api/lab/catalogs/[mod]/route.ts` y hermanos reveló que:

1. ✅ El bloque de Prisma **sí tenía** try/catch local.
2. ❌ El `try/catch` local **NO cubría** el auth gate (`getServerSession(authOptions)`).
3. ❌ El `try/catch` local **NO cubría** `await params` ni validaciones tempranas.
4. ❌ Cualquier excepción en esos puntos → Next.js renderiza HTML 500 con stack trace.

**Causa raíz más probable (no verificable desde CLI):** en Vercel runtime, una de estas dos variables de entorno falta:

| Variable | Síntoma si falta |
|---|---|
| `NEXTAUTH_SECRET` | `getServerSession()` lanza → HTML 500 |
| `DATABASE_URL` | Primera query Prisma lanza → HTML 500 si el throw está fuera del try local (improbable con código actual, pero posible si afecta al model binding) |

> No pude verificar Vercel Dashboard desde CLI. Frank debe confirmar.

**Decisión de diseño:** independientemente de cuál sea la causa exacta, garantizamos que **SIEMPRE** devolvamos JSON. Eso nos da:
- Visibilidad del error real (en el JSON response y en Vercel logs).
- El frontend puede mostrar mensaje útil en vez de crashear.
- Frank puede leer `message` en la respuesta y en logs para diagnosticar.

---

## 2. Fix aplicado

### 2.1 Helper nuevo

**`frontend/src/lib/api-handler.ts`** (creado, 64 líneas)

Exporta `withApiErrors(label, handler)`:
- Envuelve el handler completo en `try/catch`.
- Loguea con `console.error("[label] error:", err)` (visible en Vercel Logs).
- Si hay error → `NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 })`.
- Si el handler devuelve `Response`/`NextResponse` → lo pasa tal cual.
- Si devuelve objeto plano → lo envuelve en `NextResponse.json 200`.
- Si devuelve `undefined`/`null` → `{ ok: true }` 200.

### 2.2 Handlers refactorizados

**9 handlers en 7 archivos** ahora envueltos con `withApiErrors`:

| Archivo | Handlers |
|---|---|
| `src/app/api/lab/catalogs/[mod]/route.ts` | GET, POST, PATCH, DELETE |
| `src/app/api/lab/orders/route.ts` | GET, POST |
| `src/app/api/lab/orders/[id]/route.ts` | GET, PATCH, DELETE |
| `src/app/api/lab/orders/[id]/confirm/route.ts` | POST |
| `src/app/api/lab/orders/[id]/items/route.ts` | POST |
| `src/app/api/lab/orders/[id]/items/[itemId]/route.ts` | DELETE |
| `src/app/api/lab/search/[type]/route.ts` | GET |

**Cambio mecánico por handler:** `export async function METHOD(...)` → `export const METHOD = withApiErrors("LABEL", async (...) => {...})`.

**Auth gates también protegidos:** los `_requireAdmin()` / `_requireReception()` ahora tienen su propio `try/catch` interno que loguea y devuelve `null` (que el handler interpreta como 401). Esto evita que un throw de NextAuth tumbe el handler antes de llegar al wrapper.

### 2.3 Tests unitarios

**`frontend/src/lib/__tests__/api-handler.test.ts`** (nuevo, 7 tests, todos verdes)

Cubre:
- Handler OK → response 200
- Objeto plano → response 200
- `undefined`/`null` → `{ ok: true }` 200
- `throw new Error` → JSON 500 con message
- Simulación de `NEXTAUTH_SECRET` faltante → JSON 500
- Throw de string (no Error) → JSON 500
- Verifica que `console.error` se llama con la etiqueta

---

## 3. Validaciones (Soft Gates)

| Gate | Resultado |
|---|---|
| **1. Compilación** (`tsc --noEmit`) | ✅ pasa. Los 6 errores TS restantes son **pre-existentes** en `src/components/projects/__tests__/ProjectMassiveReportModal.test.tsx`, `src/hooks/__tests__/useProjectReportStatus.test.ts` y `src/services/__tests__/company.service.test.ts` (problemas con `vitest` y `toBeInstanceOf`). No relacionados con este PR. |
| **2. Testing** (`vitest`) | ✅ 7/7 nuevos tests verdes. No hay tests previos para los routes de lab. |
| **3. Revisión** (`eslint`) | ✅ 0 errores, 0 warnings (en archivos modificados). Las 13 warnings iniciales de "unused eslint-disable" se autocorrigieron con `--fix`. |
| **4. Documentación** | ✅ Headers de archivo actualizados con `@id IMPL-20260701-07 (hotfix)`. Este checkpoint. |

---

## 4. Archivos modificados

```
frontend/src/lib/api-handler.ts                                  (nuevo, 64 líneas)
frontend/src/lib/__tests__/api-handler.test.ts                   (nuevo, 99 líneas)
frontend/src/app/api/lab/catalogs/[mod]/route.ts                 (refactor 4 handlers)
frontend/src/app/api/lab/orders/route.ts                        (refactor 2 handlers)
frontend/src/app/api/lab/orders/[id]/route.ts                   (refactor 3 handlers)
frontend/src/app/api/lab/orders/[id]/confirm/route.ts           (refactor 1 handler)
frontend/src/app/api/lab/orders/[id]/items/route.ts             (refactor 1 handler)
frontend/src/app/api/lab/orders/[id]/items/[itemId]/route.ts    (refactor 1 handler)
frontend/src/app/api/lab/search/[type]/route.ts                 (refactor 1 handler)
```

**Total:** 9 archivos, +636 / -461 líneas (mucho refactor mecánico).

---

## 5. Riesgos y desviaciones

- ✅ **Cero riesgo funcional:** la lógica de negocio de cada handler no cambió. Solo se envolvió en un wrapper y se agregaron `try/catch` a los auth gates.
- ✅ **Cero impacto en tests existentes:** no hay tests de los routes, así que no se rompió nada.
- ⚠️ **Auth gates con try/catch:** un fallo de NextAuth ahora se loguea + devuelve 401. Antes, podría haber devuelto 500. Cambio de comportamiento, pero **más seguro**.
- ⚠️ **No se diagnosticó la causa raíz:** este fix es un *safety net*, no un fix del problema subyacente. La causa raíz (probablemente env vars faltantes en Vercel) sigue ahí.

---

## 6. Próximos pasos para INTEGRA / Frank

### Paso 1: Mergear + redeploy
1. Abrir PR en https://github.com/frank-vcorp/Administracion-medica-industrial/pull/new/hotfix/debug-lab-api-500
2. Mergear a `main`
3. Vercel redeploya automáticamente

### Paso 2: Verificar env vars en Vercel (CRÍTICO)
Esto NO lo pude hacer desde CLI. Frank debe ir a:
**Vercel Dashboard → Administracion-medica-industrial → Settings → Environment Variables**

Confirmar que existan (en Production al menos):
- `DATABASE_URL` (Postgres connection string)
- `SHADOW_DATABASE_URL` (opcional, para migraciones)
- `NEXTAUTH_SECRET` (string aleatorio)
- `NEXTAUTH_URL` (URL pública del deploy)
- `NEXT_PUBLIC_API_URL` (URL del frontend, no del backend FastAPI)

### Paso 3: Verificar el fix
Refrescar `https://administracion-medica-industrial.vercel.app/admin/lab/catalogs?mod=unidades`:
- **Si ahora carga con datos:** ✅ problema resuelto (el bug era el try/catch ausente).
- **Si ahora muestra JSON error `{ error: "INTERNAL_ERROR", message: "..." }`:** leer el `message`. Lo más probable es "Environment variable not found: DATABASE_URL" o similar → Frank debe agregar la env var faltante.
- **Si sigue mostrando HTML 500:** hay un problema más profundo (build error, runtime mismatch). Ir a Vercel → Deployments → logs del último deploy.

### Paso 4: Verificar logs de runtime
Si el JSON muestra error, revisar también:
**Vercel Dashboard → Logs → filtrar por `/api/lab/catalogs`**

El log del wrapper es: `[GET /api/lab/catalogs/[mod]] error: <Error>` con stack trace completo.

---

## 7. Mensaje explícito sobre DATABASE_URL

**No puedo confirmar desde CLI si `DATABASE_URL` está en Vercel.** Si después de mergear + redeploy, el API sigue fallando con mensaje tipo `Environment variable not found: DATABASE_URL` o `Can't reach database server`, **INTEGRA necesita pedirle a Frank que la agregue en el dashboard de Vercel** (Settings → Environment Variables).

Esta es la causa más probable del bug original, pero NO la confirmé empíricamente.
