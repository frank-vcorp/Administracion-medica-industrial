# HANDOFF ARCH-20260624-01 FASE 7.2 a SOFIA — Fixes triviales post-rollback

- ID: ARCH-20260624-01 (Fase 7.2)
- Fecha: 2026-06-24
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion (cierre de quality gate pre-GEMINI)

## Contexto

INTEGRA ya ejecutó rollback de 11 archivos modificados fuera de alcance por error en la pasada previa. Working tree actual solo contiene archivos legítimos del módulo ARCH-20260624-01 (ruta pública sin token) + archivos de otros módulos (que NO debes tocar).

Faltan 3 fixes triviales para llevar typecheck y tests a 0 errores antes de GEMINI.

## Estado actual

- typecheck: 14 errores (13 en `company.service.public.test.ts`, 1 en `company.service.ts:415`).
- test: 1 fallo (`company.service.public.test.ts` no carga por circular import del mock de `@/lib/prisma`).
- 15 tests previos: siguen pasando.
- 11 archivos fuera de alcance: ya rolled back por INTEGRA.

## Alcance exacto (3 fixes)

### Fix 1 — `tsconfig.json`: agregar vitest/globals types

En `frontend/tsconfig.json`, en `compilerOptions`, agregar (o fusionar con existente):

```json
"types": ["vitest/globals"]
```

Esto permite que `vi`, `beforeEach`, `expect`, `describe`, `it`, y matchers (`toBe`, `toEqual`, `toHaveBeenCalled`, etc.) estén disponibles globalmente en tests SIN necesidad de importarlos.

NO agregar otras dependencias. NO instalar nada nuevo.

### Fix 2 — `frontend/src/services/company.service.ts`: ampliar return type del wrapper público

En línea ~415, el wrapper `submitPublicCompanySelfRegistration` declara un return type más estrecho que el core `submitCompanySelfRegistrationCore`. Ampliar el tipo del wrapper para que incluya todos los códigos de error posibles (aunque algunos sean inalcanzables en path público):

```ts
export async function submitPublicCompanySelfRegistration(
  payload: CompanyFullFormPayload
): Promise<
  | { ok: true; companyId: string }
  | { ok: false; code: 'INVALID_TOKEN' | 'ALREADY_SUBMITTED' | 'TOKEN_EXPIRED' | 'INVALID_PAYLOAD' | 'RFC_DUPLICATE'; error: string; existingCompanyId?: string }
> {
  return submitCompanySelfRegistrationCore('PUBLIC', payload)
}
```

Alternativamente, hacer cast: `return submitCompanySelfRegistrationCore('PUBLIC', payload) as ...`

### Fix 3 — `frontend/src/services/__tests__/company.service.public.test.ts`: reescribir sin mocks de Prisma

El test actual mockea `@/lib/prisma` pero causa `ReferenceError: Cannot access 'mockPrisma' before initialization` por circular import.

**Estrategia**: testear solo funciones PURAS exportadas, sin tocar Prisma:

1. Exportar `random8()` (helper de random) si no está exportado actualmente.
2. Exportar `getClientIp()` (helper de headers) si no está exportado.
3. Reescribir el test para:
   - Test 1: `random8()` retorna string de 8 chars hex (verificar formato).
   - Test 2: `random8()` es determinísticamente único (dos llamadas consecutivas retornan strings diferentes).
   - Test 3: `getClientIp()` retorna IP correcta cuando `x-forwarded-for` está presente.
   - Test 4: `getClientIp()` retorna IP de `x-real-ip` cuando `x-forwarded-for` no está.
   - Test 5: `getClientIp()` retorna `null` cuando no hay headers.
   - Test 6: Validación del payload con `CompanyFullFormPayloadSchema` (público debe incluir `channel='PUBLIC_DIRECT'`).

Para mockear `next/headers` en tests, usa:
```ts
import { vi } from 'vitest'
vi.mock('next/headers', () => ({
  headers: vi.fn()
}))
```

NO mockees `@/lib/prisma`. NO mockees `next/cache`. Solo `next/headers` para `getClientIp`.

Si los helpers `random8` o `getClientIp` no están exportados del service, expórtalos como funciones nombradas (NO cambies la lógica, solo agrega `export`).

### Fix 4 (opcional) — Si Fix 1 no resuelve los 13 errores de tipos vitest

Si después de agregar `"types": ["vitest/globals"]` todavía hay errores, agregar triple-slash directive al inicio del archivo de tests:

```ts
/// <reference types="vitest/globals" />
```

Si aún así no funciona, importar explícitamente en el test:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
```

## Validaciones obligatorias

```bash
cd frontend && npm run typecheck
cd frontend && npm test -- --run
cd frontend && npm run lint
```

Criterio de cierre:
- typecheck: 0 errores totales.
- test: 15/15 previos + 6 nuevos pasan (21/21 total).
- lint módulo: 0 warnings nuevos en archivos tocados.

Reporta **output literal completo** de cada comando.

## Restricciones duras

1. NO toques los archivos que INTEGRA rolled back (appointments, dashboard, reception, validation, workers, AppShell, CorroborationModal, EventFlowController, WorkerFormModal, WorkersTable, id.utils).
2. NO instales dependencias nuevas.
3. NO hagas commit, push ni PR.
4. NO modifiques `tsconfig.json` fuera de agregar `"types": ["vitest/globals"]`.
5. NO borres archivos.
6. NO modifiques variables de entorno.

## Self-review (4 preguntas)

1. ¿Cuántos tests pasan y cuántos fallan? Si alguno falla, cuál y por qué.
2. ¿Los 3 fixes funcionaron? Pega diff de `tsconfig.json` y línea del wrapper del service.
3. ¿Output literal de las 3 validaciones?
4. ¿Algún archivo fuera del alcance fue tocado?

## Reporte final

- Resumen 1-2 líneas.
- Archivos modificados (3-4 máximo).
- Output literal completo de las 3 validaciones.
- Self-review 4 preguntas.
- Sugerencia explícita de invocar a GEMINI como segunda mano.

NO invoques GEMINI. NO commit/push/PR.