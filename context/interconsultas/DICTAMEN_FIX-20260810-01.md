# DICTAMEN TÉCNICO: Probe AI keys "falla" + decrypt_error en Gemini/DR7
- **ID:** FIX-20260810-01
- **Fecha:** 2026-08-10
- **Solicitante:** Frank (interconsulta directa; contexto IMPL-20260809-10)
- **Estado:** §1 ✅ VALIDADO · §2 ❌ REQUIERE MÁS CONTEXTO (root cause acotada a 3 hipótesis; discriminador = logs Railway, fuera de mi alcance)

## §1 Probe de conexión

### A. Causa raíz (VALIDADA)
El endpoint `POST /api/v2/admin/ai-keys/{provider}/probe` **SÍ está desplegado y funciona correctamente**. Evidencia:
- Commit 349178d está en `origin/main`; router registrado en `main.py:141-143`.
- M3 devuelve `not_configured` estructurado (503 → mapeado en `ai-keys.actions.ts:353-379`): comportamiento **esperado** per SPEC AC-4 (sin row BD + `M3_API_KEY` env vacía). Si el endpoint no estuviera desplegado, el frontend mostraría `unknown · Backend error 404` (`actions.ts:380-395`), no un error tipado.
- Gemini/DR7 devuelven `decrypt_error` con el mensaje exacto de `probe.py:402`. El probe **ni siquiera llama al proveedor**: `probe.py:396-403` corta en corto cuando el resolver cae con `warning="decrypt_error"`. Es decir, el síntoma §1 es la misma root cause que §2. La premisa "keys rotas" queda **sin verificar** (la falla ocurre antes del HTTP real).

### Factores secundarios (confusión al reintentar)
- El rate-limit consume el slot ANTES de resolver (`probe.py:360`): reintentos <30s → 429.
- Bug menor frontend: `actions.ts:339` lee `retryAfterSec` en el nivel equivocado (FastAPI anida bajo `detail`) → cooldown siempre muestra 30s.

### B. Quick-fix (opcional, ≤5 líneas, reversible)
`ai-keys.actions.ts` rama 429: leer `(json.detail as {retryAfterSec?:number})?.retryAfterSec ?? 30` (patrón idéntico al ya usado en la rama 503). Riesgo de regresión: nulo; cubierto por `ai-keys.actions.test.ts`.

## §2 decrypt_error en Gemini y DR7

### A. Mecanismo (VALIDADO)
Flag `AI_KEYS_FROM_DB_ENABLED=true` en producción (sin flag on jamás habría `decrypt_error`, sería `flag_off`). El resolver halla row para gemini/dr7 → `decrypt_key` lanza excepción (`keys.py:318-338`) → fallback a env con `warning="decrypt_error"` → GET muestra `keySuffix=null` ("(sin clave en BD)", `admin_ai_keys.py:73-87`) y el probe lo surfacea. **No hay outage funcional**: extracción ya cae a env vars por diseño (CB-1). El daño es operativo/visual + incapacidad de probar keys de BD.

### Causa raíz probable (3 hipótesis, priorizadas)
- **H1 (más probable): rows legacy en BD prod.** Escritas bajo régimen d7dc40a (base64-ASCII guardado en BYTEA); el re-insert de 2942cb8 no habría tocado prod (no hay script en el repo; el commit admite datos corruptos). Fingerprint: excepción `InvalidTag` en logs.
- **H2: mismatch de ENCRYPTION_KEY** (rotación posterior o inserción desde entorno con otra key). Fingerprint: `InvalidTag`.
- **H3: prisma-client-py 0.15.0 devuelve BYTEA como `str` en lectura** → `bytes(str)` → `TypeError`. Sustento: d7dc40a demostró manejo no-estándar de bytes en este cliente (TypeError empírico en escritura); la afirmación de 2942cb8 "devuelve bytes crudos" nunca se validó contra cliente real (tests mockean rows); la "rama defensiva" prometida en el commit message de 2942cb8 **no existe** en el código actual (`keys.py:318-326`).

### Discriminador (requiero, no tengo acceso)
1. **Logs Railway:** `keys.py:329-333` loguea `KeyResolver: descifrado de %s falló (%s)` con el type name. `InvalidTag` → H1/H2; `TypeError` → H3.
2. **SQL:** `SELECT provider, length("keyCiphertext"), "updatedAt" FROM ai_provider_keys;` — `updatedAt` en ventana 2026-08-09 22:39 (d7dc40a) → row legacy; longitud ≈ 4/3 del esperado → base64-ASCII.

### B. Quick-fix
**No hay quick-fix de código seguro** (toca contrato de cifrado). Mitigación operativa inmediata, cero código, reversible (ADR D8):
- **(a)** `AI_KEYS_FROM_DB_ENABLED=false` en Railway → todo cae a env, banners desaparecen, el probe pasa a testear las keys de env reales; o
- **(b)** botón "Eliminar" en la UI para gemini y dr7 → warning pasa a `row_missing`, mismo efecto, conserva flag on.
Riesgo de regresión: nulo funcionalmente (extracción ya usa env); se pierde sólo una key de BD hoy inutilizable.

### C. Escalación L3 a INTEGRA
1. **Contrato BYTEA vs prisma-client-py 0.15.0:** definir y validar con test de integración contra BD real (escritura Y lectura). El PUT actual pasa bytes crudos (`admin_ai_keys.py:248-262`) contradiciendo la evidencia empírica de d7dc40a → la próxima rotación vía UI podría 500. Nunca se probó PUT real post-2942cb8 (el commit dice "Frank debe re-insertar… cuando esté listo").
2. **Protocolo de re-inserción/re-cifrado** de keys gemini/dr7 una vez confirmado el contrato.
3. **Semántica del probe ante decrypt_error** (SPEC §5.1 ambigua): ¿testear el fallback env o sólo reportar corrupción? Implementación actual = reportar.

### Hallazgos secundarios (cosméticos, no bloqueantes)
- `admin_ai_keys.py:106-112` `_source_for_provider` retorna `"env"` en ambas ramas → badge "Fuente activa" miente con flag on + row sana.
- `main.py:707-742` `_key_in_db_sync` siempre retorna False bajo FastAPI (loop corriendo) → `key_in_db` de `/api/v2/ai/status` no es confiable.

## Orden de aplicación recomendado
1. Frank/INTEGRA: obtener logs Railway (type name de la excepción) + SQL de longitudes → confirma H1/H2 vs H3.
2. Si urge limpiar la pantalla: mitigación (a) o (b).
3. Handoff L3 a INTEGRA con hipótesis confirmada → SPEC de contrato BYTEA + test integración + re-inserción validada vía UI.
4. L1 opcional: fix parseo 429 frontend + `_source_for_provider`.

**No se aplicó ningún cambio de código** (dictamen puro, per solicitud). Sin commit.
