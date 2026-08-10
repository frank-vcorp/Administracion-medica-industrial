# SPEC FIX-20260810-05 — M3 DB-resolver en dispatcher + 503 accionable por key Gemini revocada

**ID:** FIX-20260810-05
**Tipo:** FIX crítico de producción
**Origen:** Handoff ATLAS → INTEGRA (2026-08-10)
**Prioridad:** P0 (bloquea calibración y procesamiento de eventos en prod)
**Estado IDL:** READY → (delegar a SOFIA) → IN_PROGRESS → VERIFYING → DONE
**Decisor arquitectónico:** INTEGRA (confianza ≥85%, interno, reversible, sin contrato público nuevo)

---

## 1. Problema

En producción (Railway), con `extraction_default_provider = "m3"` persistido en BD (Frank lo subió vía `/admin/ai-keys`; log confirma `Extracción solicitada con provider='m3' model='Minimax-M3'`), los endpoints `POST /api/v1/calibration/upload` y el flujo de papers `/api/v2/studies/upload-and-analyze` retornan **HTTP 500**.

Traza Railway 2026-08-10 17:44:47:
```
Extracción solicitada con provider='m3' model='Minimax-M3' para tipo: Audiometria
⚠️ M3 no configurado → fallback a Gemini
❌ Gemini Error: 403 Client Error: Forbidden for url: .../gemini-flash-latest:generateContent?key=AIzaSy...
❌ [IMPL-20260715-04] Error en upload_calibration_test: HTTPError: 403 ...
POST /api/v1/calibration/upload HTTP/1.1" 500 Internal Server Error
```

### Causa raíz
`backend/app/services/ai/extractor.py:322-330` — `_is_m3_unavailable(provider)` solo chequea `os.environ.get("M3_API_KEY")` para decidir si M3 está "no configurado". Cuando `AI_KEYS_FROM_DB_ENABLED=true` y la key vive en BD (tabla `ai_provider_keys`), la env var `M3_API_KEY` no existe, pero el resolver `key_resolver` SÍ la recuperaría. Como `_is_m3_unavailable` retorna `True`, el dispatcher (`_call_with_dispatch`, línea 364) hace fallback a Gemini → la key de Gemini del `.env` de Railway está revocada → 403 → 500 opaco.

**Mismo bug afecta** a los extractores de papers en `backend/app/main.py` (líneas 857, 918, 1289) porque todos instancian `ExtractorService` que pasa por el mismo `_is_m3_unavailable`. **El fix #1 arregla ambos flujos a la vez** (calibración + papers), sin tocar `main.py`.

---

## 2. Decisión arquitectónica INTEGRA (gap resuelto)

### 2.1 sync vs async para `_is_m3_unavailable`
**Decisión: mantener la firma sync** (`_is_m3_unavailable(self, provider) -> bool`), cero impacto en callers. Reutilizar el patrón thread-safe/asyncio-safe **ya probado** en `backend/app/services/ai/base.py:540-547` (`_refresh_keys` de `M3VisionBase`): `asyncio.run_coroutine_threadsafe(key_resolver.resolve("m3"), loop).result(timeout=5)` cuando hay loop corriendo, con fallback `asyncio.run(...)` si `RuntimeError` (no hay loop).

**No introducir capa nueva de caché TTL.** `key_resolver` ya tiene caché TTL 60s + invalidación en escritura (ver `backend/app/services/ai/keys.py:1-18` y PROYECTO.md entrada 2026-08-09 ARCH-20260809-03). Replicar el patrón existente es suficiente y KISS.

### 2.2 Clasificación del 403 de Gemini
**Decisión: factorizar `ExtractionAuthError`** (no crear `GeminiAuthError` paralela) para mantener coherencia de dominio (excepción de auth de proveedor de extracción). La factorización debe ser **retrocompatible** con el caller existente en `extractor.py:392-395` (`raise ExtractionAuthError(f"M3_AUTH_ERROR: ...")`).

Firma factorizada (descripción, no código a pegar literal): constructor acepta `message` como primer argumento posicional (preserva callers actuales) + `provider` como kwarg opcional con default `"m3"`. El `__str__` incluye el provider para trazabilidad. Atributos expuestos: `.provider`, `.message`.

Lanzamiento desde el path de Gemini en `_call_with_dispatch` (líneas 407-413): cuando `call_gemini` levante un `requests.HTTPError` (o compatible) con `response.status_code in (401, 403)`, envolver en `ExtractionAuthError(message="Gemini API key revoked/expired (HTTP {status})", provider="gemini")`. Cualquier otra excepción de Gemini se propaga como hoy (sin fallback por contrato).

### 2.3 Boundary HTTP en calibration.py
En `backend/app/api/v1/calibration.py:436-444`, agregar un `except ExtractionAuthError as e:` **antes** del `except Exception`. Responder **HTTP 503** (no 500) con `detail` estructurado que incluya `error_code` accionable derivado de `e.provider`:
- `provider == "gemini"` → `error_code: "GEMINI_API_KEY_EXPIRED"`
- `provider == "m3"` → `error_code: "M3_API_KEY_EXPIRED"`

El `detail` debe ser accionable para el frontend/operator: indicar que la key del proveedor está revocada y qué acción tomar (rotar key en `/admin/ai-keys` o cambiar default de extracción). **No loguear ni exponer la key ni el stack crudo ni el HTTPError completo sin filtrar.**

El `except HTTPException: raise` (línea 436-437) ya está correcto: **no tocar**. El `except Exception` final (línea 438-444) se mantiene como catch-all → 500, pero ahora solo atrapa lo que no sea `HTTPException` ni `ExtractionAuthError`.

---

## 3. Archivos a tocar (3, con sub-puntos)

Todos los paths relativos a la raíz del repo.

### 3.1 `backend/app/services/ai/extractor.py`
- **3.1.a** Líneas 42-44 — factorizar `ExtractionAuthError` con `message` posicional + `provider` kwarg default `"m3"`. Retrocompat total con `raise ExtractionAuthError("...")` existente (línea 392).
- **3.1.b** Líneas 322-330 — `_is_m3_unavailable`: si `provider != "m3"` → `False` (igual). Si `AI_KEYS_FROM_DB_ENABLED=true` → resolver M3 con patrón thread-safe de `base.py:540-547`; si `resolution.api_key` presente → `False` (M3 disponible); si no → `True`. En excepción del resolver → `True` (preserva fallback Gemini) y stash warning `m3_resolve_error:{type(e).__name__}` para trazabilidad (espejo de `base.py:556-558`). Si flag off → mantener `return not bool(os.environ.get("M3_API_KEY"))` (retrocompat exacta).
- **3.1.c** Líneas 407-413 — path `provider == "gemini"`: envolver `call_gemini` para que `HTTPError` 401/403 levante `ExtractionAuthError(provider="gemini")`. Resto se propaga igual.

### 3.2 `backend/app/api/v1/calibration.py`
- **3.2.a** Líneas 436-444 — insertar `except ExtractionAuthError as e:` antes del `except Exception`, respondiendo 503 con `error_code` accionable según `e.provider`. Mantener `except HTTPException: raise` intacto y `except Exception` final como 500. Importar `ExtractionAuthError` desde `app.services.ai.extractor` al bloque de imports del archivo (verificar si ya está importado; si no, agregar).

### 3.3 Tests: `backend/tests/test_ai_pipeline.py`
- **3.3.a** Nuevo test: `AI_KEYS_FROM_DB_ENABLED=true`, M3 key en BD (mock `key_resolver.resolve("m3")` retorna `KeyResolution(api_key="fake-m3-key", source="db", ...)`), `M3_API_KEY` NO en env → `_is_m3_unavailable("m3")` retorna `False`, y `extract_by_type` con `provider=m3` pide key al resolver (no cae a Gemini).
- **3.3.b** Nuevo test: Gemini lanza `HTTPError` con `response.status_code=403` → `_call_with_dispatch(provider="gemini", ...)` levanta `ExtractionAuthError` con `provider="gemini"`.
- **3.3.c** Nuevo test: `upload_calibration_test` (endpoint) con extractor que levanta `ExtractionAuthError(provider="gemini")` → respuesta **HTTP 503** con `detail` conteniendo `GEMINI_API_KEY_EXPIRED` (no 500). Verificar que el `detail` NO contiene la key ni el stack crudo.

---

## 4. Criterios de aceptación (verificables)

1. Con `AI_KEYS_FROM_DB_ENABLED=true` y M3 en BD (env var ausente): `_is_m3_unavailable("m3") == False`.
2. Con `AI_KEYS_FROM_DB_ENABLED=false` (default): `_is_m3_unavailable` se comporta exactamente como antes (`return not bool(os.environ.get("M3_API_KEY"))`). **Cero regresión.**
3. Con `AI_KEYS_FROM_DB_ENABLED=true` y resolver que lanza excepción: `_is_m3_unavailable("m3") == True` (preserva fallback Gemini) y se stash warning `m3_resolve_error:*`.
4. `_call_with_dispatch(provider="gemini")` ante HTTP 401/403 de Gemini levanta `ExtractionAuthError` con `provider == "gemini"`.
5. `ExtractionAuthError("msg")` (caller legacy, línea 392) sigue funcionando con `provider == "m3"` default. **Cero regresión.**
6. `POST /api/v1/calibration/upload` ante `ExtractionAuthError(provider="gemini")` responde **503** con `error_code: "GEMINI_API_KEY_EXPIRED"` (no 500).
7. La respuesta 503 NO contiene la key de Gemini ni el stack crudo ni el HTTPError completo sin filtrar.
8. `POST /api/v1/calibration/upload` ante `HTTPException` propio lo propaga sin tocarlo (línea 436-437 intacta).
9. Tests `test_ai_pipeline.py` y `test_admin_app_config.py` en verde.
10. Sanity import: `cd backend && python3 -c "from app.api.v1.calibration import router; print('OK')"` imprime `OK`.

---

## 5. Casos borde

- **B1** `AI_KEYS_FROM_DB_ENABLED=true` pero BD caída / row M3 inexistente / descifrado falla → resolver retorna `KeyResolution(api_key=None, source="env", warning="...")` o lanza. `_is_m3_unavailable` debe tratar `api_key` ausente como `True` (fallback Gemini) y `excepción` como `True` + warning. **No propagar excepción del resolver al dispatcher** (rompería el contrato de `_is_m3_unavailable -> bool`).
- **B2** `AI_KEYS_FROM_DB_ENABLED=true`, M3 en BD válido, PERO `M3_API_KEY` también en env (caso rollout parcial) → resolver debería dar precedencia a BD (según `keys.py:12`); `_is_m3_unavailable` retorna `False` (M3 disponible). Comportamiento correcto.
- **B3** Loop asyncio NO corriendo al llamar a `_is_m3_unavailable` (caso test sync puro) → patrón `base.py:546-547` (`except RuntimeError: asyncio.run(...)`) lo cubre.
- **B4** `call_gemini` lanza excepción distinta de HTTPError 401/403 (timeout, 5xx, JSON no parseable) → **propagar sin envolver** (preserva contrato "gemini sin fallback").
- **B5** `ExtractionAuthError(provider="gemini")` llega al `except Exception` de calibration.py por error de ordering → no debe pasar; el `except ExtractionAuthError` debe ir **antes**. Test 3.3.c lo cubre.
- **B6** El `detail` del 503 no debe incluir el path de la URL de Gemini (que contiene la key como query param `?key=AIzaSy...`). Sanitizar o no propagar el `str(e)` crudo.

---

## 6. Restricciones

- **Retrocompat estricta** con `AI_KEYS_FROM_DB_ENABLED=false`: comportamiento idéntico al actual (env var).
- **No loguear ni exponer keys** ni el HTTPError completo sin filtrar (la URL de Gemini incluye `?key=AIzaSy...`).
- **No tocar** `main.py` (los extractores de papers se arreglan solos vía el fix #1 en `extractor.py`).
- **No crear** `GeminiAuthError` nueva clase (decisión §2.2: factorizar).
- **No introducir** capa nueva de caché TTL (decisión §2.1).
- **No cambiar** contrato público de endpoints excepto agregar 503 donde antes era 500 opaco (mejora, no ruptura).
- **No commitear ni pushear** sin OK explícito de Frank.

---

## 7. Validaciones obligatorias antes de cerrar

1. `cd backend && python3 -m pytest tests/test_ai_pipeline.py -x -q` (verde; tests de `_call_with_dispatch` y `extract_by_type` con M3 + los 3 tests nuevos).
2. `cd backend && python3 -m pytest tests/test_admin_app_config.py -x -q` (verde).
3. `cd backend && python3 -c "from app.api.v1.calibration import router; print('OK')"` (sanity import).
4. Verificar manualmente (con mock) que la traza del 403 de Gemini ya NO produce "M3 no configurado → fallback a Gemini" cuando M3 está en BD.

---

## 8. Handoff a SOFIA

**Alcance:** exactamente los 3 archivos de §3 (extractor.py con 3 sub-puntos, calibration.py con 1 punto + import, test_ai_pipeline.py con 3 tests nuevos).

**Lo que SOFIA NO debe hacer:**
- Redefinir arquitectura ni contratos.
- Tocar `main.py`, `base.py`, `keys.py`, ni schema Prisma.
- Crear `GeminiAuthError` nueva clase.
- Commitear/pushear.

**Self-review manual antes de reportar (responder Sí/No + 1 línea cada una):**
1. ¿El cambio preserva el path de fallback M3→Gemini cuando M3 sí está en env (`AI_KEYS_FROM_DB_ENABLED=false`)?
2. ¿El nuevo 503 incluye `error_code` accionable y NO expone la key ni el stack crudo?
3. ¿Los tests cubren el caso DB-only (3.3.a) y el caso 403 de Gemini (3.3.b, 3.3.c)?
4. ¿La factorización de `ExtractionAuthError` es retrocompatible con `raise ExtractionAuthError("msg")` existente?

**Segunda mano de validación:** Solicitar revisión final a **GEMINI** (`subagent_type='gemini'`) antes de marcar la implementación como lista para commit. NO usar qodo (está sunset).

**Reporte de cierre esperado:**
- Archivos modificados: lista exacta con líneas.
- Validaciones: output de pytest (verde) + sanity import.
- Self-review: 4 respuestas.
- GEMINI QA: dictamen APPROVED/CHANGES_REQUESTED.
- NO commitear ni pushear sin OK explícito de Frank.

---

## 9. Trazabilidad

- Handoff origen: ATLAS → INTEGRA (2026-08-10, FIX-20260810-05).
- ADR relacionados: ARCH-20260809-03 (gestión runtime API Keys), ARCH-20260809-02 (selector multi-proveedor M3+Gemini), IMPL-20260809-04 (commit `99dc46c`), IMPL-20260809-06 (`_refresh_keys` patrón base.py:531-549).
- Decisión INTEGRA §2: confianza ≥85%, interna, reversible, sin contrato público nuevo → no requiere OK Frank previo a delegar (§2). Commit/push sí requiere OK.
