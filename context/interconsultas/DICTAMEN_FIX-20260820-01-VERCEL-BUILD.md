# DICTAMEN FIX-20260820-01-VERCEL-BUILD

- **ID:** FIX-20260820-01 (archivo `DICTAMEN_FIX-20260820-01-VERCEL-BUILD.md`, ruta asignada por instrucción directa de Frank)
- **Fecha:** 2026-08-20
- **Solicitante:** Frank (vía ATLAS)
- **Tarea/SPEC:** Diagnóstico de fallo reproducible de build en Vercel (commit `d6295b1`), vinculado a ARCH-20260820-01 (Calibración fuente única, Fases 2-5). SPEC de referencia: `context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md`.
- **Nivel:** L2 (recomendado; alternativa L1 documentada en §F.2)
- **Estado:** `CAUSA_CONFIRMADA` — reproducción local idéntica al fallo de Vercel.

> **Nota de trazabilidad (colisión de ID):** el número `FIX-20260820-01` ya aparece en `PROYECTO.md` y handoffs de ARCH-20260820-01 referido a una auditoría forense DEBY previa (drift histórico de snapshots, H9, backend; "11/11 hipótesis confirmadas"), sin archivo de dictamen propio. Para evitar ambigüedad en cadenas de referencia, este dictamen se cita siempre por su filename completo: `DICTAMEN_FIX-20260820-01-VERCEL-BUILD.md`. Si ATLAS lo considera, el próximo dictamen DEBY debería usar `FIX-20260820-02` en adelante.

---

## A. Síntoma y alcance

El deploy de Vercel del commit `d6295b1` ("feat(calibration): complete phases 3-5 runtime snapshots") falla en `npx next build` (Next.js **16.1.6**, bundler **Turbopack**, buildCommand de `vercel.json`: `npx prisma generate && npx next build`).

Error primario (1 de 8):

```
./src/actions/calibration-v3.actions.ts:52:1
Only async functions are allowed to be exported in a "use server" file.
```

Errores derivados (7 de 8): al fallar la validación del módulo `'use server'`, Turbopack anula el registro completo del módulo ("The module has no exports at all") y todos los imports contra él fallan en los grafos `app-rsc`, `app-client` y `app-ssr`, incluidos los exports async válidos:

| Export reportado como inexistente | Importador (línea) | Grafo |
|---|---|---|
| `extractSnapshotVersioningFromBackendAudit` | `src/actions/ai-prediagnosis.actions.ts:21` | app-rsc |
| `extractSnapshotVersioningFromBackendAudit` | `src/actions/event-test.actions.ts:17` | app-rsc |
| `getPublishedCalibrationForEventTest` | `src/actions/event-test.actions.ts:17` | app-rsc |
| `getPublishedVersionForSnapshot` | `src/actions/ai-prediagnosis.actions.ts:21` | app-rsc |
| `getPublishedVersionForSnapshot` | `src/actions/event-test.actions.ts:17` | app-rsc |
| `saveAICalibrationV3` | `src/components/calibration/AICalibrationEditor.tsx:21` | app-client |
| `saveAICalibrationV3` | `src/components/calibration/AICalibrationEditor.tsx:21` | app-ssr |

Resultado: `Turbopack build failed with 8 errors`, deploy bloqueado. Alcance: solo frontend Next.js; backend (Railway) no afectado. No hay incidente de seguridad ni corrupción de datos.

## B. Reproducción

- **Determinista:** sí (100% reproducible; error de compilación estático).
- **Entorno de reproducción:** local, Node v22.23.1, `frontend/` del commit `d6295b1` (HEAD de main), mismo comando que Vercel.
- **Comando:** `npx prisma generate && npx next build` (workdir `frontend/`).
- **Esperado:** build exitoso (exit 0).
- **Observado:** exit 1 con la cadena exacta de 8 errores descrita en §A. Log completo: `/tmp/kilo/vercel-build-repro.log` (extractos en §C).
- **Precondiciones:** `node_modules` instalado; Prisma Client generado por el propio comando. No requiere base de datos (el fallo es de compilación, previo a cualquier runtime).

## C. Evidencia

Extracto primario (log local, idéntico al reportado de Vercel):

```
▲ Next.js 16.1.6 (Turbopack)
> Build error occurred
Error: Turbopack build failed with 8 errors:
./src/actions/calibration-v3.actions.ts:52:1
> 52 | export const PUBLISH_REQUIRED_ROLE: UserRole = 'SUPERADMIN'
Only async functions are allowed to be exported in a "use server" file.
```

Extracto derivado (patrón repetido para cada import):

```
The export saveAICalibrationV3 was not found in module
  [project]/src/actions/calibration-v3.actions.ts [app-client] (ecmascript).
The module has no exports at all.
```

Stack de propagación del error primario (del log):

```
at ./src/actions/calibration-v3.actions.ts:52:1
at ./src/actions/ai-prediagnosis.actions.ts:21:1
at ./src/actions/event-test.actions.ts:17:1
at ./src/components/calibration/AICalibrationEditor.tsx:21:1
```

Violaciones concretas en `frontend/src/actions/calibration-v3.actions.ts` (directiva `'use server'` a nivel de archivo, línea 27):

| Línea | Export | Violación |
|---|---|---|
| 52 | `export const PUBLISH_REQUIRED_ROLE: UserRole = 'SUPERADMIN'` | const (no es función async) |
| 58 | `export const MAX_SUPERSEDED_VERSIONS = 20` | const (no es función async) |
| 999 | `export function extractSnapshotVersioningFromBackendAudit(...)` | función **síncrona** (no async) |

Los `export type` / `export interface` del archivo (L75, L94, L98, L725, L845) son type-only y se borran en compilación: no violan la regla. Los 4 `export async function` (`saveAICalibrationV3`, `publishAICalibrationV3`, `getPublishedCalibrationForEventTest`, `getPublishedVersionForSnapshot`) son válidos.

Sin secretos ni PII en la evidencia (el log nombra archivos `.env.*` pero no expone contenido).

## D. Hipótesis evaluadas

| # | Hipótesis | A favor | En contra | Estado |
|---|---|---|---|---|
| H1 | Exports no-async en archivo `'use server'` violan el contrato de Server Actions de Next.js 16 | Error primario apunta exactamente a L52 (`PUBLISH_REQUIRED_ROLE`); regla documentada de Next.js; 3 violaciones verificables en el fuente | — | **CONFIRMADA** (reproducción + eliminación teórica del fallo) |
| H2 | Los errores derivados indican que cada función exportada está mal individualmente | Los 7 errores derivados nombran exports async válidos | Los exports async son legales; el mensaje "The module has no exports at all" indica anulación del módulo completo, no defecto por función | DESCARTADA |
| H3 | Fallo de configuración (`vercel.json`, `next.config.ts`, Prisma generate) | El build corre el mismo comando en Vercel | `vercel.json` y `next.config.ts` son inocuos (sólo rewrites); `prisma generate` succeeds; el error es de validación de módulo, no de config | DESCARTADA |
| H4 | Incompatibilidad Next 16 / Turbopack vs webpack | Next 16 usa Turbopack por defecto | La regla de exports `'use server'` aplica igual en ambos bundlers; no es un bug del bundler sino del código | DESCARTADA |

## E. Causa raíz

**Confirmada.** `frontend/src/actions/calibration-v3.actions.ts` declara `'use server'` a nivel de archivo (L27), lo que obliga a que todo export de runtime sea una función async (Next.js registra cada export como Server Action referenciable desde el cliente). El archivo exporta dos constantes (`PUBLISH_REQUIRED_ROLE` L52, `MAX_SUPERSEDED_VERSIONS` L58) y una función síncrona (`extractSnapshotVersioningFromBackendAudit` L999). Turbopack rechaza el módulo en compilación y, al anularlo, deja sin exports también a las funciones async válidas → cascada de 7 errores derivados y build fallido.

**Cronología (importante para el loop breaker y el despliegue):**

- Las violaciones de constantes se introdujeron en `0cce88f` (Fase 2, ARCH-20260820-01). El build está roto **desde ese commit**; no es un defecto nuevo de `d6295b1`.
- `d6295b1` (Fases 3-5) añadió la tercera violación (función síncrona) y los nuevos consumidores (`ai-prediagnosis.actions.ts`, `event-test.actions.ts`, tests), multiplicando los errores derivados. Es el primer deploy que se intenta tras `0cce88f`, por eso el fallo se hace visible ahí.
- Ningún otro archivo `'use server'` del repo (40+ archivos) tiene esta violación: los demás exportan `const x = async (...) => {...}` (funciones async asignadas, válidas). Es un caso único.

**Respuesta a la pregunta sobre los helpers:**

- `extractSnapshotVersioningFromBackendAudit`: **sí, debe salir** del archivo `'use server'`. Es una función pura y síncrona (sin Prisma, sin session); no puede ser Server Action y sus únicos consumidores son otros server actions y tests. Ubicación correcta: módulo normal (puro), ver §F.
- `getPublishedVersionForSnapshot`: **no es obligatorio moverlo**. Es `async` (export válido en `'use server'`) y lee Prisma directamente, por lo que debe permanecer server-side. Puede quedarse en el archivo de actions; moverlo sería churn innecesario.
- Además de los helpers, las constantes `PUBLISH_REQUIRED_ROLE` y `MAX_SUPERSEDED_VERSIONS` también deben salir (misma clase de violación; son el error primario).

## F. Solución recomendada

### F.1 Opción A — Extraer exports no-action a módulo puro (RECOMENDADA)

Crear `frontend/src/lib/calibration-v3-shared.ts` (módulo normal, sin `'use server'`, siguiendo la convención de `src/lib/calibration-schema.ts`: "función pura — sin dependencias de servidor ni Prisma") y mover allí:

1. `PUBLISH_REQUIRED_ROLE` (con `import type { UserRole } from '@prisma/client'` — type-only, sin runtime).
2. `MAX_SUPERSEDED_VERSIONS`.
3. `extractSnapshotVersioningFromBackendAudit` + sus privados `_sha256Prefixed` y `readString`.
4. `export interface PublishedVersionForSnapshot` (referenciada por la firma del helper y por el retorno de `getPublishedVersionForSnapshot`).

Cambios por archivo:

| # | Archivo | Cambio |
|---|---|---|
| 1 | `frontend/src/lib/calibration-v3-shared.ts` | **NUEVO**: items 1-4 anteriores. Header de advertencia: "no importar desde componentes cliente" (contiene `require('node:crypto')`). |
| 2 | `frontend/src/actions/calibration-v3.actions.ts` | Eliminar L52, L58, L999-1054 y privados `_sha256Prefixed`/`readString`; importar `PUBLISH_REQUIRED_ROLE`, `MAX_SUPERSEDED_VERSIONS` y `type PublishedVersionForSnapshot` desde el módulo compartido. Mantiene `'use server'` a nivel de archivo y sus 4 async functions. |
| 3 | `frontend/src/actions/ai-prediagnosis.actions.ts` | Dividir el import L21-24: `getPublishedVersionForSnapshot` de `./calibration-v3.actions`; `extractSnapshotVersioningFromBackendAudit` de `@/lib/calibration-v3-shared`. |
| 4 | `frontend/src/actions/event-test.actions.ts` | Ídem (L17): `getPublishedCalibrationForEventTest` + `getPublishedVersionForSnapshot` de actions; helper del módulo compartido. |
| 5 | `frontend/src/actions/__tests__/calibration-v3.actions.test.ts` | `MAX_SUPERSEDED_VERSIONS`/`PUBLISH_REQUIRED_ROLE` desde `@/lib/calibration-v3-shared` (L57-58). |
| 6 | `frontend/src/components/clinical/__tests__/ClinicalExtractionRenderer.fase5.test.ts` | `extractSnapshotVersioningFromBackendAudit` desde `@/lib/calibration-v3-shared`; `getPublishedVersionForSnapshot` se mantiene desde actions (L33-36). |

Sin cambios: `AICalibrationEditor.tsx` (importa `saveAICalibrationV3`, action válida), `calibration-fase3.actions.test.ts`, `calibration-fase3.event-test.test.ts` (mock completo del módulo).

**Propiedades:** contrato público intacto (las 4 actions siguen exportadas desde la misma ruta); semántica server-only del archivo preservada (directiva a nivel de archivo); cambio mecánico sin decisión funcional ni de comportamiento; reversible (revert del commit).

### F.2 Opción B — Directiva `'use server'` por función (alternativa hotfix L1)

Eliminar `'use server'` de archivo (L27) y añadir `'use server'` como primera sentencia dentro de cada una de las 4 funciones async exportadas. 1 archivo, ~5 líneas, cero cambios en consumidores ni tests.

**Trade-off (por qué no es la recomendada):** el módulo pierde la garantía server-only de la directiva de archivo — un futuro import cliente de `extractSnapshotVersioningFromBackendAudit` o de las constantes arrastraría `prisma`/`next-auth` al grafo cliente (fallo de build o fuga de código servidor). Además se aparta de la convención del repo (40+ archivos con directiva de archivo). Útil sólo si se exige un hotfix de un solo archivo.

### F.3 Clasificación

**L2** (Opción A): causa confirmada, implementación mecánica no trivial, 6 archivos (>2, supera el límite L1), sin decisión funcional, sin contrato público nuevo, sin schema/migración/auth/secretos. Ejecutor: **SOFIA** en sesión independiente activada por ATLAS. La Opción B cabría como L1 por tamaño, pero toca la semántica de seguridad del módulo (directiva server-only), lo que según §6/§7 eleva el riesgo y favorece la Opción A.

## G. Prueba de regresión y validación

Mínimo exigible tras el fix (en `frontend/`):

1. **Build (reproducción exacta del fallo):** `npx prisma generate && npx next build` → exit 0, sin errores "Only async functions..." ni "has no exports". Es el mismo buildCommand de Vercel (`vercel.json`).
2. **Tests dirigidos:** `npx vitest run src/actions/__tests__/calibration-v3.actions.test.ts src/actions/__tests__/calibration-fase3.actions.test.ts src/actions/__tests__/calibration-fase3.event-test.test.ts src/components/clinical/__tests__/ClinicalExtractionRenderer.fase5.test.ts` → verde (cubren constantes, helper, publish/retención y espejo Fase 5).
3. **Typecheck:** `npx tsc --noEmit` → exit 0 (detecta cualquier import path drifted).
4. **Guarda estática anti-regresión:** `rg "^export (const|let|var|function) " src/actions/calibration-v3.actions.ts` → sin resultados (solo `export async function` / `export type` / `export interface`). Repetible como check para cualquier archivo `'use server'`.

## H. Parche L1 aplicado

**No.** Instrucción explícita del solicitante: no editar código ni hacer commit/push. Este dictamen es diagnóstico puro (`DIAGNOSED`).

## I. Handoff, riesgos y reversión

**Handoff:**

```text
[DIAGNOSED]
FIX: FIX-20260820-01 — context/interconsultas/DICTAMEN_FIX-20260820-01-VERCEL-BUILD.md
Tarea/SPEC: ARCH-20260820-01 (Fases 2-5), SPEC_ARCH-20260820-01 v1.1
Nivel: L2 (Opción A recomendada; Opción B documentada como alternativa)
Síntoma: Vercel build falla en d6295b1 — 8 errores Turbopack; primario: export no-async en archivo 'use server'
Causa: confirmada — calibration-v3.actions.ts ('use server' de archivo) exporta 2 constantes (L52, L58) y 1 función síncrona (L999); violación presente desde 0cce88f
Parche aplicado: no (diagnóstico por instrucción del solicitante)
Evidencia: reproducción local idéntica (exit 1, 8 errores); log /tmp/kilo/vercel-build-repro.log; extractos en §C
Dueño siguiente: ATLAS (pivota SOFIA en sesión independiente)
Acción exacta: SOFIA aplica Opción A (§F.1, 6 archivos) y valida con §G completo antes de entregar READY_FOR_VERIFYING
Riesgos: ver abajo
```

**Riesgos:**

- Opción A: mínimos — movimiento de código puro sin cambio de comportamiento; riesgo residual de import paths incompletos, cubierto por typecheck + tests dirigidos. El módulo compartido no debe importarse desde componentes cliente (documentar en header).
- Opción B (si se eligiera): erosión de la garantía server-only del módulo; exige disciplina futura o `import 'server-only'` (requiere dependencia nueva y rompe vitest — no recomendada).
- Deploy: el build está roto desde `0cce88f`; cualquier deploy de main entre ese commit y el fix fallará. No hay workaround de configuración (la regla de exports `'use server'` no es configurable).

**Reversión recomendada (sin ejecutar):** revertir el commit del fix si la validación §G falla; el estado anterior (build roto) no es peor que el actual. No se recomienda rollback de `d6295b1` como solución: revertiría las Fases 3-5 completas y el build seguiría roto por `0cce88f`.

**Observación secundaria (no bloqueante):** el build emite el warning "The 'middleware' file convention is deprecated. Please use 'proxy' instead" (Next 16). No relacionado con este fallo; registrar como hallazgo si ATLAS lo considera.

---

*Autoauditoría DEBY: causa confirmada con reproducción determinista; evidencia sin secretos/PII; clasificación por riesgo (no sólo líneas); sin edición de código ni artefactos de otro owner; sin delegación lateral; loop breaker verificado (sin dictamen previo para este síntoma — la colisión de ID FIX-20260820-01 corresponde a una auditoría de otro componente y está documentada); handoff a un único dueño (ATLAS) con una acción concreta.*
