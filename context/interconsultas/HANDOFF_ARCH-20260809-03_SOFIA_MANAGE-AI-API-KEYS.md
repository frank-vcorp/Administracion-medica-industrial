# HANDOFF a SOFIA — ARCH-20260809-03: Gestión runtime de API Keys de IA vía UI

- **De:** INTEGRA
- **Para:** SOFIA
- **Fecha:** 2026-08-09
- **SPEC:** `context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md`
- **ADR:** `context/decisions/ADR-20260809-03-GESTION-API-KEYS-IA-RUNTIME.md`
- **ID implementación sugerido:** `IMPL-20260809-05` (sigue a `IMPL-20260809-04` ya en main)
- **Estado SPEC:** READY (cumple DoR)

---

## 1. Objetivo

Permitir insertar/rotar/borrar API keys de los proveedores IA (M3, Gemini, DR7/MedGemma) desde la UI sin tocar env vars ni redeploys. Cifrado AES-256-GCM en BD, `KeyResolver` con caché TTL 60 s + invalidación, precedencia BD→env var, feature flag opt-in, solo SUPERADMIN edita.

---

## 2. Lectura obligatoria previa (Fact-Forcing)

Antes de tocar nada, SOFIA debe **re-verificar** el patrón de lectura de keys documentado en SPEC §1 (y ADR §1.1). Puntos exactos a confirmar leyendo el código:

- `backend/app/services/ai/base.py:111-115` → `GeminiBase.__init__` cachea `self.api_key`.
- `backend/app/services/ai/base.py:393-416` → `M3VisionBase.__init__` cachea `api_key/base_url/model`.
- `backend/app/services/ai/base.py:237-260` → `FeatherlessVisionBase.__init__` idem.
- `backend/app/services/ai/prediagnostic.py:38-44` → constantes de módulo (`DR7_API_KEY`, `DR7_BASE_URL`, `DR7_MODEL`, `MEDGEMMA_ENABLED`) evaluadas al importar.
- `backend/app/main.py:149-173` → constantes de módulo + `main.py:257-259` construcción de servicios con `api_key=<constante>`.
- `backend/app/services/ai/extractor.py:308-360` → checks de capacidad leen env fresco, pero las instancias ya cachean.

Si el patrón difiere de lo documentado, **detente y reporta** antes de implementar.

---

## 3. Alcance y archivos a tocar

### 3.1 Backend (Python)

| Archivo | Acción | Detalle |
|---|---|---|
| `backend/prisma/schema.prisma` | Editar | Añadir `model AIProviderKey` (SPEC §3.1) + back-relation `aiProviderKeys AIProviderKey[]` en `model User`. |
| `frontend/prisma/schema.prisma` | Editar | Sincronizar el mismo modelo (ambos schemas deben quedar idénticos). |
| `backend/prisma/migrations/<ts>_add_ai_provider_key/migration.sql` | Nuevo | SQL `CREATE TABLE ai_provider_keys (...)` siguiendo patrón de `IMPL-20260730-01`. Aplicar vía `sync-prisma-migrations.ts`. |
| `backend/app/services/ai/keys.py` | **Nuevo** | `KeyResolver` (SPEC §5) + `encrypt_key`/`decrypt_key` (AES-256-GCM, lib `cryptography`). Singleton del resolver. |
| `backend/app/services/ai/base.py` | Editar | Añadir `_refresh_keys()` al inicio de `call_gemini` (GeminiBase), `call_m3` (M3VisionBase), `call_featherless_vision` (FeatherlessVisionBase). Aceptar resolver inyectado (opcional, default None = comportamiento legacy). **No romper** la firma pública ni los tests existentes. |
| `backend/app/services/ai/prediagnostic.py` | Editar | Convertir constantes de módulo (líneas 38-44) a lecturas vía resolver dentro de los métodos que las usan (ej. donde se construye el header `Authorization: Bearer {DR7_API_KEY}` en `prediagnostic.py:879`). Mantener defaults hardcode como fallback. Añadir `key_source` al metadata de auditoría clínica. |
| `backend/app/services/ai/extractor.py` | Editar | Checks de capacidad (308-360) y construcción de instancias M3/Gemini vía resolver. Añadir `key_source` a `extraction_snapshot.audit` (junto a `extraction_provider_used`). |
| `backend/app/main.py` | Editar | (a) Nuevos endpoints `GET/PUT/DELETE /api/v2/admin/ai-keys` (SPEC §6); (b) leer `AI_KEYS_FROM_DB_ENABLED` env var; (c) inyectar el resolver al construir servicios en líneas 257-259 (no pasar `api_key=<constante>` cacheada — dejar que el resolver provea); (d) extender `GET /api/v2/ai/status` (líneas 594-642) con `key_source` por proveedor y `ai_keys_from_db_enabled`. |
| `backend/requirements.txt` | Editar (si falta) | Asegurar `cryptography>=41.0` (para `AESGCM`). Si ya está, no tocar. |
| `backend/tests/test_ai_keys.py` | **Nuevo** | Suite pytest: cifrado roundtrip + tamper, precedencia flag on/off, permisos 403/200, audit log, key_source, ENCRYPTION_KEY ausente (503 PUT + fallback env), optimistic locking 409, invalidación de caché. |
| `backend/tests/test_ai_pipeline.py` | Editar | Extender con test de `key_source` en metadata + resolver fallback (env cuando flag off). |

### 3.2 Frontend (TypeScript/React)

| Archivo | Acción | Detalle |
|---|---|---|
| `frontend/src/types/ai-keys.ts` | **Nuevo** | Tipos compartidos: `AIProviderKeyInfo`, `UpdateAIProviderKeyInput`. |
| `frontend/src/actions/ai-keys.actions.ts` | **Nuevo** | Server actions `listAIProviderKeys` (ADMIN+SUPERADMIN), `updateAIProviderKey` (SUPERADMIN), `deleteAIProviderKey` (SUPERADMIN). Guard real con sesión NextAuth + `isSuperAdmin`/`isAdminLike` de `frontend/src/lib/auth/roles.ts`. Llaman al backend con header `x-ami-role`. |
| `frontend/src/app/admin/ai-keys/page.tsx` | **Nuevo** | Página server component que obtiene sesión + rol, renderiza `AIProviderKeyManager` con gate SUPERADMIN para editar. Next.js 16: si usa `params`/`searchParams`, `await params`. |
| `frontend/src/components/admin/AIProviderKeyManager.tsx` | **Nuevo** | Client component: por proveedor, tarjeta con estado mascareado (`••••••••abcd`), inputs `type=password` (nueva key + confirmación), inputs opcionales `baseUrl`/`defaultModel`, botones Guardar/Eliminar (visibles solo SUPERADMIN), modal de confirmación de borrado. |
| `frontend/src/components/layout/Sidebar.tsx` (o equivalente nav) | Editar | Añadir enlace "API Keys IA" → `/admin/ai-keys`, visible solo con `isSuperAdmin(role)`. |
| `frontend/src/lib/auth/roles.ts` | Sin cambios | Reutilizar `isSuperAdmin`, `isAdminLike`. |
| `frontend/src/middleware.ts` | Sin cambios (ver nota) | `/admin/ai-keys` ya cae bajo la guarda `isAdminLike` de `/admin/*`. El gate SUPERADMIN de edición lo hace la server action + el componente. (Opcional: si se quiere bloquear el acceso de ADMIN a la ruta, añadir un check específico — no obligatorio en este corte.) |
| `frontend/src/__tests__/ai-keys.actions.test.ts` | **Nuevo** | Vitest: action lanza 403 si rol no SUPERADMIN en update/delete; ADMIN puede listar; nunca retorna key completa. |
| `frontend/src/components/admin/__tests__/AIProviderKeyManager.test.tsx` | **Nuevo** (opcional) | Vitest: confirmación doble deshabilita Guardar si keys difieren; botones ocultos para ADMIN. |

---

## 4. Restricciones innegociables

1. **Nunca** loguear/exponer la key completa, ciphertext, nonce ni tag (ni en backend, ni en respuestas HTTP, ni en `console.log`). Solo `maskedKeySuffix` (últimos 4).
2. Feature flag `AI_KEYS_FROM_DB_ENABLED` default **`false`**. Con flag off, comportamiento idéntico al actual (env-var-only). Priorizar tests de "flag off = sin regresión".
3. El refactor del resolver **no debe romper** la firma pública de `call_gemini`/`call_m3`/`call_featherless_vision` ni los tests existentes.
4. Ambos `schema.prisma` sincronizados.
5. `params`/`searchParams` en Next.js 16 son `Promise` → `await params` (regla del AGENTS.md del proyecto; no reportar como error).
6. Pydantic para validar el body del `PUT` (equivalente server-side a Zod).
7. No auto-poblar la BD desde env vars (Frank puebla vía UI al activar el flag).

---

## 5. Validaciones obligatorias antes de reportar como listo

```
1. pnpm typecheck   (o npm run typecheck) — 0 errores nuevos
2. pnpm test        (vitest) — pasa, incluye nuevos tests
3. pnpm lint        (o npm run lint) — 0 errores nuevos
4. pytest backend/tests -v — pasa, incluye nuevos tests de keys.py y endpoints
```

Antes de reportar como listo, **NO pidas `qodo` (está sunset).** En su lugar, incluye en el reporte final un self-review manual:
- ¿El código refleja la SPEC?
- ¿Hay code smells evidentes?
- ¿Los tests cubren los edge cases listados en la SPEC §10?
- ¿Algún riesgo de regresión en el refactor del resolver (especialmente `base.py`, `prediagnostic.py` constantes de módulo, `main.py:257-259`)?

**Solicitar revisión final a GEMINI (`subagent_type='gemini'`) como segunda mano de validación antes de marcar la implementación como lista para commit.**

---

## 6. Tests manuales (a validar tras implementar)

- **M-1** Insertar key M3 válida vía UI (SUPERADMIN) → `GET /api/v2/ai/status` muestra `m3_key_present:true`, `key_source.m3="db"`; subir documento de prueba → corrida usa M3 (`extraction_provider_used="m3"`, `key_source="db"` en snapshot).
- **M-2** Borrar key M3 → siguiente extracción cae a env var (si `M3_API_KEY` en env) o a fallback Gemini.
- **M-3** `PUT` con sesión ADMIN → 403 (server action lanza; curl con `x-ami-role=ADMIN` → 403).
- **M-4** `ENCRYPTION_KEY` ausente → `PUT` UI muestra 503; extracciones siguen con env vars.
- **M-5** Confirmación doble: inputs de key distintos → "Guardar" deshabilitado.

---

## 7. Decisión clave de INTEGRA (no re-preguntar)

- **Rol editor:** solo SUPERADMIN (más conservador; Frank no especificó). ADMIN puede ver (listado mascareado). Si Frank quiere bajarlo, lo dice después.
- **Precedencia:** BD gana si existe y `enabled=true`; env var como fallback. Permite rollout incremental sin perder config actual.
- **Cifrado:** AES-256-GCM + env var `ENCRYPTION_KEY` (no KMS/Vault — overkill para single-tenant Railway).
- **Rotación inmediata:** `KeyResolver` con caché TTL 60 s + invalidación en `PUT`/`DELETE`. Refactor de `__init__`/constantes de módulo es **obligatorio** (sin él, rotación no toma efecto sin reinicio).

---

## 8. Dependencias y orden sugerido

1. Schema + migración (ambos schema.prisma) → aplicar.
2. `keys.py` (`KeyResolver` + crypto) + tests unitarios del cifrado.
3. Refactor `base.py` (3 bases) + `prediagnostic.py` + `extractor.py` (con flag off, cero cambio observable).
4. `main.py`: inyección del resolver en servicios + endpoints + extensión status.
5. Tests backend completos.
6. Frontend: types → actions → page + componente → nav.
7. Tests frontend.
8. Self-review + GEMINI.

---

## 9. DoD (cuándo considers terminado)

- AC-1..AC-14 de la SPEC §9 cumplidos.
- Gates §11 verdes.
- Tests manuales M-1..M-5 validados (o documentados como pendientes de Frank en prod).
- GEMINI auditoría recibida (APROBADO o APROBADO_CON_OBSERVACIONES con 0 bloqueadores).
- Reporte final a INTEGRA con: archivos tocados, resultado de los 4 gates, resultado de los tests manuales, observaciones del self-review, riesgos detectados.

---

## 10. Blockers / escalación

- Si el patrón de lectura de keys difiere de SPEC §1 → detente y reporta a INTEGRA.
- Si `cryptography` no instalable en el entorno backend → reporta (alternativa: Fernet AES-128, segunda opción del ADR).
- Si el refactor rompe tests existentes que no puedas arreglar en 2 intentos → escala a DEBY (dictamen) vía `task subagent_type='debugger'`.
- Si necesitas decisión de producto/contrato que no está en la SPEC → escala a INTEGRA (no improvises).

---

**Fin del handoff.** INTEGRA espera el reporte estructurado de SOFIA al terminar.
