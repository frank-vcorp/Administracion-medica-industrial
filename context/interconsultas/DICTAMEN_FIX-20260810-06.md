# DICTAMEN TÉCNICO: `POST /api/v1/calibration/upload` sigue en 500 tras FIX-20260810-05 — deadlock sync-over-async en el resolver de keys
- **ID:** FIX-20260810-06
- **Fecha:** 2026-08-10
- **Solicitante:** Frank (interconsulta directa DEBY forense; contexto FIX-20260810-05 deployado en `ae3b9ea`)
- **Estado:** ✅ VALIDADO (causa raíz confirmada con reproducción forense; fix aplicado en working tree, SIN commit — espera OK Frank)

---

## Nivel

**L2** (dictamen + fix aplicado). Por naturaleza es L2 clásico (lógica acotada, sin contrato público, sin arquitectura, sin infra): el fix es **un solo patrón mecánico** aplicado en los sitios donde el FIX-05 copió el patrón defectuoso. Excede el umbral L1 de líneas por la replicación del bug (5 sitios + 2 fronteras async + tests). Se aplicó directo por instrucción explícita de la tarea ("Si encuentras la causa, aplica el fix mínimo"), urgencia P0 (producción caída para calibración) y por no requerir decisión arquitectónica. Reversible con `git checkout -- .` si INTEGRA/Frank prefieren re-hacerlo vía SOFIA.

---

## A. Análisis de Causa Raíz

### Síntoma
Post-deploy de FIX-20260810-05 (`ae3b9ea`, container `78821b2…`, app start 18:44:52 UTC), `POST /api/v1/calibration/upload` retorna **exactamente el mismo error** que antes del fix:

```
⚠️ M3 no configurado → fallback a Gemini
❌ Gemini Error: 403 Client Error: Forbidden ...
POST /api/v1/calibration/upload HTTP/1.1" 500 Internal Server Error
```

### Hallazgo forense
El FIX-05 cambió `_is_m3_unavailable` para consultar la key vía `key_resolver.resolve("m3")` cuando `AI_KEYS_FROM_DB_ENABLED=true`, usando este patrón (extractor.py:389-396 pre-fix):

```python
try:
    loop = asyncio.get_running_loop()
    resolution = asyncio.run_coroutine_threadsafe(
        resolver.resolve("m3"), loop
    ).result(timeout=5)
except RuntimeError:
    resolution = asyncio.run(resolver.resolve("m3"))
```

**Ese patrón DEADLOCKea cuando se ejecuta en el hilo del event loop** — que es exactamente el contexto de producción:

1. `upload_calibration_test` es `async def` (calibration.py:144) → corre en el hilo del event loop de uvicorn.
2. Llama `extractor.extract_by_type(...)` **directamente** (calibration.py:335, código sync sobre el hilo del loop).
3. `extract_by_type` → `_call_with_dispatch` → `_is_m3_unavailable("m3")`.
4. `asyncio.get_running_loop()` retorna el loop corriente (no lanza RuntimeError).
5. `run_coroutine_threadsafe(resolve("m3"), loop)` agenda la corrutina en **ese mismo loop**.
6. `.result(timeout=5)` **bloquea el hilo del loop** → el loop no puede ejecutar la corrutina agendada mientras el hilo está bloqueado esperándola.
7. Tras 5s: `concurrent.futures.TimeoutError` — que NO es `RuntimeError`, por lo que el `except RuntimeError` no lo captura; lo traga el `except Exception` (extractor.py:402 pre-fix) → `return True`.
8. `True` → "⚠️ M3 no configurado → fallback a Gemini" → Gemini (key de env revocada) → 403 → 500.

**Efecto colateral:** cada request bloqueaba el event loop entero 5s aquí, +5s en `GeminiBase._refresh_keys` (mismo patrón, base.py:163-168 pre-fix) al caer el fallback, +5s en `_resolve_dr7_config` durante el prediagnóstico — ~15s de congelamiento del servidor por request.

### Reproducción forense (aislada, sin el codebase)
```
== Caso 1: desde hilo del event loop (handler async FastAPI) ==
   SWALLOWED -> retorna True (fallback): TimeoutError   [2.00s loop bloqueado]
== Caso 2: desde hilo sin loop (worker sync) ==
   OK: RESOLVED   [0.01s]
```
El Caso 1 es el path de producción; el Caso 2 es el path que ejercitan los unit tests — por eso el FIX-05 pasó sus 7 tests nuevos (95 passed) y el bug llegó a producción.

### Causa raíz (cita exacta)
- `backend/app/services/ai/extractor.py:389-393` (pre-fix): `asyncio.run_coroutine_threadsafe(resolver.resolve("m3"), loop).result(timeout=5)` invocado **desde el hilo del loop** (vía `calibration.py:144 async def` → `calibration.py:335 extract_by_type` sync) → deadlock → `TimeoutError` tragado en `extractor.py:402` → `return True` → fallback erróneo.
- Mismo patrón replicado en: `base.py:163-165` (GeminiBase), `base.py:543-545` (M3VisionBase), `prediagnostic.py:97-99` (DR7), `base.py:349-351` (Featherless — dead code post rollback ARCH-20260519-15, no tocado).
- Agravante de diseño: el patrón fue asumido "thread-safe/asyncio-safe ya probado" (docstring FIX-05 citaba base.py:540-547) — pero nunca fue válido **dentro** del hilo del loop; DICTAMEN_FIX-20260810-01 §Hallazgos ya había advertido la misma clase de bug en `main.py:707-742 _key_in_db_sync`.

---

## Hipótesis descartadas

1. **H1 — flag `AI_KEYS_FROM_DB_ENABLED` ausente en Railway:** ❌ Descartada. DICTAMEN_FIX-20260810-01 §2 demuestra flag **ON** en producción (el `decrypt_error` observado en Gemini/DR7 sólo es posible con flag on; con flag off sería `flag_off`).
2. **H2 — flag on pero `resolve("m3")` retorna `api_key=""` por bug en `_lookup_db`:** ❌ Descartada como causa primaria. El resolver **nunca llegó a ejecutar** `resolve()`: la corrutina quedó agendada en un loop bloqueado. Además `_lookup_db` está sano post FIX-03/04 (wrappers `Base64.decode()`/`Json`; tests de resolución pasan cuando el entorno permite importar prisma).
3. **H3 — excepción del resolver tragada por `except Exception`:** ✅ **CONFIRMADA — es la causa raíz**, con el mecanismo preciso: no es una excepción del resolver sino `TimeoutError` del propio `.result(timeout=5)` por deadlock.
4. **H4 — modelo `Minimax-M3` (casing) → 404 → `m3_4xx_persistent` → fallback:** ❌ Descartada como causa de ESTE 500 (M3 jamás fue invocado: el fallback disparó en el gate `_is_m3_unavailable`, antes de la llamada). **Pero es un riesgo secundario real** — ver §Recomendación R3: si `ai_provider_keys."defaultModel"` del m3 es NULL, la llamada usaría el `Minimax-M3` de aiCalibration. Si la row tiene `defaultModel='MiniMax-M3'` (default del UI), `_refresh_keys` corrige el casing automáticamente (validado E2E).
5. **H5 — path paralelo de papers (main.py:857/918/1289) que bypasea el ExtractorService:** ❌ Descartada para este incidente. El log prueba la ruta `POST /api/v1/calibration/upload` → `upload_calibration_test` (calibration.py) — los endpoints de main.py son rutas distintas; main.py:857/918 ni pasan aiCalibration (fallarían antes con `EXTRACTION_PROMPT_NOT_CONFIGURED`). Ojo: `v2_upload_and_analyze` (main.py:1203, async def, usa extract_by_type con aiCalibration en :1289) **sí tenía el mismo deadlock latente** — se le aplicó el mismo warmup. La discrepancia espirometría/audiometría del screenshot es irrelevante: el dispatch es type-agnostic y el log dice "para Audiometria" (tipo del test_id usado).

---

## B. Justificación de la Solución

### Por qué este diseño
No se puede `await` desde código sync, y bloquear el hilo del loop para esperar una corrutina del mismo loop es un deadlock por construcción. Las alternativas evaluadas y descartadas:

- **`asyncio.to_thread` / correr `asyncio.run` en worker thread:** descartado — el cliente Prisma 0.15 usa engine HTTP vía httpx (`prisma/engine/_http.py` → `AsyncHTTP`); el pool de conexiones tiene afinidad al loop donde se creó (`connect()` en el lifespan). Queries cross-loop = fallos intermitentes inaceptables.
- **Fire-and-forget `create_task` + respuesta optimista:** descartado — la tarea sólo corre cuando el loop recupera control, y el pipeline sync bloquea el loop hasta terminar; dentro del mismo request la caché nunca se llena a tiempo.
- **Elegido — warmup en frontera async + lectura sync de caché TTL:** el handler (que ES async) hace `await key_resolver.resolve(...)` nativamente (llenando la caché TTL 60s), y el lado sync lee la caché sin bloquear (`resolve_sync_cached`). Cero cross-loop, cero bloqueo, degrada a env var (comportamiento legacy) si la caché está fría. Respeta el diseño existente del resolver (caché TTL + invalidación, SPEC §5).

### Fix aplicado (FIX REFERENCE: FIX-20260810-06 en cada parche)

| Archivo | Cambio |
|---|---|
| `backend/app/services/ai/keys.py` | Nuevo `KeyResolver.resolve_sync_cached(provider)` — lectura sync no bloqueante de la caché TTL; retorna `None` si fría/stale (el caller degrada a env). |
| `backend/app/services/ai/extractor.py` | `_is_m3_unavailable`: reemplaza el patrón deadlock por `resolve_sync_cached("m3")`. Caché caliente → `not bool(api_key)`; fría → stash `m3_cache_cold` + env check (legacy). Quita `import asyncio` huérfano. |
| `backend/app/services/ai/base.py` | `GeminiBase._refresh_keys` y `M3VisionBase._refresh_keys`: mismo reemplazo (`resolve_sync_cached("gemini"/"m3")`; fría → env + warning `cache_cold`). Semánticas de aplicación de key/url/model idénticas a antes. |
| `backend/app/services/ai/prediagnostic.py` | `_resolve_dr7_config`: mismo reemplazo (elimina el bloqueo de 5s por prediagnóstico). Docstring corregido (decía "corre vía threadpool" — falso para handlers async). Quita `import asyncio` huérfano. |
| `backend/app/api/v1/calibration.py` | `upload_calibration_test`: warmup `await resolve("m3"/"gemini"/"dr7")` antes de `_build_services()` cuando flag on (fallo suave: try/except pass). |
| `backend/app/main.py` | `v2_upload_and_analyze`: mismo warmup (la otra entrada async al dispatcher). |
| `backend/tests/test_ai_pipeline.py` | Tests FIX-05 actualizados al nuevo contrato + **regresión forense** `test_m3_unavailable_en_contexto_async_no_deadlock` (llama `_is_m3_unavailable` DENTRO de un loop corriendo, con `wait_for` 2s — pre-fix habría deadlocked). |
| `backend/tests/test_ai_keys.py` | `test_geminibase_refresh_keys_with_flag_on_fetches_db` actualizado: pre-calienta caché antes de `_refresh_keys()`. |

**No tocado (follow-ups documentados):** `FeatherlessVisionBase._refresh_keys` (base.py:~349, mismo patrón — dead code post rollback ARCH-20260519-15); `main.py:_key_in_db_sync` (misma clase de bug, ya reportada en FIX-20260810-01 §Hallazgos); casing `Minimax-M3` en datos de BD (ver R3).

---

## Validaciones

### pytest (sandbox local)
```
tests/test_ai_pipeline.py          96 passed  (95 baseline FIX-05 + 1 regresión nueva; 2 tests reescritos)
tests/test_admin_ai_keys_probe.py  13 passed
tests/test_cutover.py               3 passed
tests/test_ai_keys.py              14 passed, 9 deselected  ← hang ambiental de prisma (ver nota)
Resto suites (lab_*, pdf_*, reports, mobile_units, migration…): passed
```
- Pre-existentes e idénticos en árbol prístino (verificado con `git stash`): 2 failed en `test_pdf_services.py` (ReportService, no relacionado) y hangs de `test_admin_app_config.py` / `test_pending_orders.py`.
- **Nota ambiental:** en este sandbox `from prisma._fields import Base64` cuelga (import de prisma hace I/O bloqueante; `~/.prisma/binaries` ausente). Es pre-existente (reproducido en árbol prístino y en python puro sin código del proyecto). Los 9 tests deselected de test_ai_keys.py y las suites colgadas SÍ deben correr en CI/contenedor donde prisma importa normal.

### Simulación E2E del mecanismo (KeyResolver real + prisma mockeado, sin red)
```
_is_m3_unavailable('m3') = False  (esperado: False)
M3 api_key resuelta     = sk-M3-...   (key de BD aplicada)
M3 model tras refresh   = MiniMax-M3  (defaultModel de BD corrige casing 'Minimax-M3' de aiCalibration)
M3 key_source           = db
✅ E2E OK: caché caliente en frontera async → pipeline sync resuelve M3 sin deadlock
Caché fría: unavailable=True en 0.000s — sin bloqueo
✅ Degradación legacy OK
```

### Smoke test post-deploy (para Frank)
```bash
curl -sS -X POST "$RAILWAY_URL/api/v1/calibration/upload" \
  -F "file=@ESPIROMETRIA.pdf" -F "test_id=<id>" -F "test_type=Espirometria" | jq .
```
Logs esperados: **YA NO** aparece "⚠️ M3 no configurado → fallback a Gemini"; aparece extracción con `provider_used='m3'`, `key_source='db'`. Si M3 respondiera 404 InvalidModel → aplicar R3.

---

## C. Instrucciones de Handoff / Recomendación (para Frank)

1. **Revisar el diff y deployar** (`git diff`; sin commit — espera tu OK). El fix es reversible (`git checkout -- .`) y con flag off el comportamiento es idéntico al legacy (cero regresión por diseño).
2. **Re-probar el calibrador** con el PDF. Pronóstico: extracción resuelta por M3 con key de BD; el request además deja de congelar el loop ~15s.
3. **R3 — verificar casing del modelo (riesgo secundario).** Si tras el deploy M3 responde 404 InvalidModel, revisar:
   ```sql
   SELECT provider, "defaultModel", enabled FROM ai_provider_keys WHERE provider='m3';
   ```
   Si `"defaultModel"` es NULL o vacío, `call_m3` usaría el `Minimax-M3` (casing erróneo) guardado en `MedicalTest.options.aiCalibration.extraction.model`. Corrección: `UPDATE ai_provider_keys SET "defaultModel"='MiniMax-M3' WHERE provider='m3';` y/o editar el modelo en el panel de calibración (el UI ya ofrece `MiniMax-M3` correcto).
4. **Gemini sigue revocado (403).** Con este fix el fallback M3→Gemini deja de dispararse en el caso feliz, pero si M3 falla transitoriamente el fallback caerá en la key Gemini de env revocada → ahora responde **503 `GEMINI_API_KEY_EXPIRED`** accionable (FIX-05) en vez de 500 opaco. Pendiente rotar la key Gemini o limpiar su row de BD (ver DICTAMEN_FIX-20260810-01 §2 mitigación b).
5. **Follow-ups no bloqueantes** (documentados arriba): mismo patrón en Featherless (dead code) y `main.py:_key_in_db_sync`; considerar spec de "frontera async calienta caché" como patrón canónico para futuros consumidores sync del resolver.

---

**DEBY terminó dictamen** — Causa raíz: deadlock sync-over-async del patrón `run_coroutine_threadsafe(...).result()` del FIX-05 cuando corre en el hilo del event loop (TimeoutError tragado → `_is_m3_unavailable` retornaba siempre True → fallback erróneo a Gemini → 403 → 500). Fix L2 aplicado en working tree (patrón: warmup async de caché TTL + lectura sync no bloqueante), 96+ tests pasando, SIN commit. Dictamen en: `context/interconsultas/DICTAMEN_FIX-20260810-06.md`. Estado: ✅ VALIDADO. Acción sugerida: Frank revisa `git diff`, da OK de commit+deploy, re-prueba calibrador y verifica R3 (defaultModel) si hubiera 404.
