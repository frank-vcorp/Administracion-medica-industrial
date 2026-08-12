# FIX-20260812-14 — "Missing credentials" del SDK OpenAI en `M3VisionBase.call_m3()`

- **FIX-ID:** FIX-20260812-14
- **Tipo:** FIX (bug de credenciales / error opaco al usuario)
- **Severidad:** Alta (bloquea el flujo "Subir resultado" del módulo Estudios con estado IN_PROGRESS)
- **Modelo de ejecución:** glm-5.2 (plan Alibaba) — FIX DIRECTO autorizado por Frank sin dictamen DEBUGGER previo
- **Estado:** LISTO PARA COMMIT (esperando OK de Frank)
- **Fecha:** 2026-08-12

---

## 1. Resumen ejecutivo

Al subir un archivo en el flujo "Subir resultado" del módulo de Estudios, el usuario
recibía del SDK `openai` el mensaje crudo:

> Missing credentials. Please pass an `api_key`, `workload_identity`,
> `admin_api_key`, or set the `OPENAI_API_KEY` or `OPENAI_ADMIN_KEY`
> environment variable.

**Causa raíz:** `M3VisionBase.call_m3()` instanciaba
`OpenAI(api_key="", base_url=...)` cuando `self.api_key` quedaba vacío tras
`_refresh_keys()`. La key se degradaba a `""` por DOS rutas convergentes:

1. **Ruta legacy (`__init__`):** `api_key or env("M3_API_KEY") or ""` → vacío si no
   hay env var (caso de producción con key sólo en BD).
2. **Ruta cold-load (`_refresh_keys` con `AI_KEYS_FROM_DB_ENABLED=true`):** la caché
   TTL estaba fría y `_resolve_sync_cold()` intentaba un lookup sincrónico contra
   la BD vía `asyncio.run_coroutine_threadsafe(...).result(timeout=3.0)` contra el
   **mismo event loop** que estaba corriendo el handler async → **deadlock 3s →
   TimeoutError tragado → return None** → key vacía. (Anti-patrón ya documentado en
   FIX-20260810-06 pero no resuelto para el cold path.)

Cuando M3 fallaba, **FIX-20260812-12 prohibió el fallback a Gemini**, así que el
mensaje del SDK se propagaba crudo hasta el frontend.

**Fix aplicado (defensa en profundidad, sin redefinir arquitectura):**

1. Guard en `call_m3`: si `self.api_key` está vacío tras `_refresh_keys()`, lanzar
   `M3CredentialsUnavailableError` (excepción tipada con mensaje accionable)
   **antes** de instanciar el cliente OpenAI — evita el mensaje opaco del SDK.
2. Eliminación del código muerto (`pass` literal) en el bloque cold de
   `_refresh_keys`.
3. Fix del deadlock de `_resolve_sync_cold`: cuando `loop.is_running()`, devolver
   `None` inmediatamente en vez de bloquear 3s (el blocking call nunca funcionó
   bajo FastAPI; sólo añadía hang silencioso).
4. El dispatcher (`ExtractorService._call_with_dispatch`) convierte
   `M3CredentialsUnavailableError` en
   `ExtractionAuthError(provider="m3", reason="credentials_unavailable")` —
   **sin fallback a Gemini** (respeta FIX-20260812-12).
5. Mensaje user-friendly en la capa HTTP (main.py + calibration.py): el frontend
   recibe `error: "M3_CREDENTIALS_UNAVAILABLE: El servicio de análisis IA (M3)
   no está configurado..."` en lugar del mensaje del SDK.
6. Warmup robusto: el pre-calentamiento de la caché TTL ahora loguea si falla
   (antes `try/except: pass` tragaba el error → caché fría silenciosa).

---

## 2. Análisis de causa raíz

### 2.1 Los dos paths que degradan `self.api_key` a `""`

#### Path A — Legacy (`__init__`)

```python
# base.py M3VisionBase.__init__  (IMPL-20260809-06, patrón legacy conservado)
self.api_key = api_key or _read_env_var("M3_API_KEY") or ""
```

Sin `M3_API_KEY` en env (producción con key sólo en BD), `self.api_key = ""`.
`_refresh_keys()` con `AI_KEYS_FROM_DB_ENABLED=false` (default) es **no-op**
(setea `key_source="env"`, `warning="flag_off"`) — no cambia la key. → `""`.

#### Path B — Cold-load bajo FastAPI (flag on)

`_refresh_keys()` con flag on llama a `resolve_sync_cached("m3")`. Si la caché
está fría (la frontera async no pre-calentó), cae al cold-loader
`_resolve_sync_cold("m3")` (FIX-20260812-13). Este helper hacía:

```python
future = asyncio.run_coroutine_threadsafe(_cold_resolve(), loop)
resolution = future.result(timeout=3.0)   # ← DEADLOCK
```

El handler `async def v2_upload_and_analyze` corre en el hilo del event loop.
`extract_by_type`/`call_m3` se invocan de forma **síncrona** dentro de ese hilo.
`run_coroutine_threadsafe(coro, loop)` agenda la corrutina en `loop`, pero el
hilo está bloqueado en `.result()` esperándola — el loop no puede ejecutarla →
3s de hang → `TimeoutError` → `except Exception: return None` → `self.api_key`
sigue `""`.

Es el mismo anti-patrón de FIX-20260810-06, pero FIX-13 lo reintrodujo para el
cold path sin resolverlo.

### 2.2 Por qué el mensaje llegaba crudo al usuario

`M3VisionBase.call_m3()` no tenía guard de api_key vacía → instanciaba
`OpenAI(api_key="", base_url=...)`. El SDK `openai` (versión moderna) levanta
`openai.OpenAIError("Missing credentials. Please pass an `api_key`...")` al
construir el cliente o al hacer la primera petición.

El dispatcher `_call_with_dispatch` atrapa `Exception` y la pasa a
`_classify_m3_failure(error)`. Esa función busca `status_code`/`status` HTTP y
nombres de tipo conocidos (`APITimeoutError`, `APIConnectionError`, etc.) — el
error "Missing credentials" **no tiene status HTTP** y su tipo no está en la
lista → retorna `None` → `raise` (propaga la excepción cruda).

En `main.py::v2_upload_and_analyze`, la excepción cae al `except Exception as e:`
genérico (L1235) → `return {"status": "error", "error": str(e), "file": ...}` →
el `str(e)` es el mensaje del SDK → llega al frontend.

FIX-20260812-12 prohibió el fallback a Gemini en este punto, así que no había
plan B: el error crudo era lo único que veía el usuario.

---

## 3. Cambios aplicados

### 3.1 `backend/app/services/ai/base.py`

**(a) Nueva excepción tipada** (antes de `class M3VisionBase`):

```python
class M3CredentialsUnavailableError(RuntimeError):
    """M3 API key no disponible tras `_refresh_keys()` ..."""
    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or (
            "M3_CREDENTIALS_UNAVAILABLE: El servicio de análisis IA (M3) no está "
            "configurado. Define M3_API_KEY o configura la fila en /admin/ai-keys."
        ))
```

Definida en `base.py` (no en `extractor.py`) para evitar import circular:
`extractor.py` ya importa de `.base`, así que puede importar la excepción sin
ciclo.

**(b) Eliminación de código muerto** en `_refresh_keys` (bloque `try/except` con
`pass` literal dentro de `if loop.is_running()` — herencia de un intento de
"sync lookup vía thread pool" que nunca se materializó). Reemplazado por un
comentario explicativo. El cold-load real (vía `_resolve_sync_cold`) queda
intacto.

**(c) Guard en `call_m3`** antes de `from openai import OpenAI`:

```python
self._refresh_keys()
if not self.api_key:
    raise M3CredentialsUnavailableError()
try:
    from openai import OpenAI
    ...
```

Cubre ambos paths (A y B) que degradaban a `""`. El guard corre **antes** del
import de openai, así que el test no requiere openai instalado.

### 3.2 `backend/app/services/ai/keys.py`

**Fix del deadlock de `_resolve_sync_cold`:** cuando `loop.is_running()`, devolver
`None` inmediatamente en vez de `run_coroutine_threadsafe(...).result(timeout=3.0)`
(que deadloqueaba bajo FastAPI). Comportamiento equivalente (antes retornaba None
tras 3s de hang; ahora retorna None al instante), sin hang. La caché se pre-calienta
en la frontera async (warmup); si el warmup falla, ahora se loguea. Si la key sigue
sin quedar disponible, el guard de `call_m3` lanza la excepción tipada.

### 3.3 `backend/app/services/ai/extractor.py`

**(a) Import:** `from .base import GeminiBase, M3VisionBase, M3CredentialsUnavailableError`

**(b) `reason` en `ExtractionAuthError`:** nuevo kwarg `reason: str = "auth_error"`
para distinguir "auth_error" (HTTP 401/403, key inválida) de
"credentials_unavailable" (key ausente). Retrocompatible (default "auth_error").

**(c) `except M3CredentialsUnavailableError`** en `_call_with_dispatch` (rama M3),
**antes** del `except Exception`:

```python
except M3CredentialsUnavailableError as creds_err:
    raise ExtractionAuthError(
        message=("M3_CREDENTIALS_UNAVAILABLE: El servicio de análisis IA (M3) "
                 "no está configurado. Define M3_API_KEY o configura la fila "
                 "en /admin/ai-keys."),
        provider="m3",
        reason="credentials_unavailable",
    ) from creds_err
```

**Sin fallback a Gemini** (respeta FIX-20260812-12). El `except Exception`
existente (que aún maneja 5xx/timeout con fallback a Gemini) queda intacto y
debajo — no se ve afectado porque `M3CredentialsUnavailableError` se atrapa
antes.

### 3.4 `backend/app/main.py`

**(a) Warmup con log explícito** (L977): el `try/except: pass` que tragaba errores
de warmup ahora imprime el tipo de fallo. No cambia el comportamiento (sigue
degradando a env var) pero hace visible la caché fría.

**(b) `error_code` específico** en el handler de `ExtractionAuthError` de
`v2_upload_and_analyze`: si `reason == "credentials_unavailable"` →
`"M3_CREDENTIALS_UNAVAILABLE"`; si no, `"M3_AUTH_ERROR"` (pre-existing). El
mensaje (`str(auth_err)`) ya es user-friendly y llega limpio al frontend vía
`result.error` (el frontend maneja `status !== 'success'` mostrando `error`).

### 3.5 `backend/app/api/v1/calibration.py`

**Branch por `reason`** en el handler de `ExtractionAuthError` (L524):

- `reason == "credentials_unavailable"` → HTTP 503 con
  `detail = "M3_CREDENTIALS_UNAVAILABLE: M3 no está configurado. Define la env
  var o configura la key en /admin/ai-keys."`
- `reason == "auth_error"` (default) → HTTP 503 con el mensaje pre-existing
  (`"{error_code}: {provider} key inválida o revocada. Rota la key..."`).

El caso gemini 403 (reason="auth_error") queda **inalterado** → el test
`test_upload_calibration_test_returns_503_on_gemini_auth_error` sigue verde.

---

## 4. Tests añadidos / ajustados

**Añadidos** en `backend/tests/test_ai_pipeline.py` (nueva clase
`TestFix20260812_14_M3MissingCredentials`):

| ID | Test | Valida |
|----|------|--------|
| CA-1 | `test_call_m3_levanta_m3credentials_unavailable_si_api_key_vacia` | `M3VisionBase()` sin `M3_API_KEY` → `call_m3` levanta `M3CredentialsUnavailableError` (NO el "Missing credentials" del SDK). No requiere openai instalado (guard corre antes del import). |
| CA-3 | `test_dispatcher_convierte_credentials_unavailable_sin_fallback_a_gemini` | `call_m3` mockeado levanta `M3CredentialsUnavailableError` → `_call_with_dispatch` la convierte en `ExtractionAuthError(provider="m3", reason="credentials_unavailable")`; `call_gemini` **jamás se invoca** (FIX-20260812-12). |
| CA-4 | `test_calibration_returns_503_with_credentials_unavailable_for_m3` | `upload_calibration_test` ante `ExtractionAuthError(reason="credentials_unavailable")` → HTTP 503 con detail conteniendo `M3_CREDENTIALS_UNAVAILABLE` y `no está configurado` (NO `inválida o revocada`). |

CA-2 (guard no dispara con api_key presente) queda cubierto por el test
existente `test_m3_vision_base_levanta_si_openai_no_instalado`: si el guard
disparara con key presente, ese test esperaría `RuntimeError` pero obtendría
`M3CredentialsUnavailableError` y fallaría. Ese test sigue verde → el guard es
específico del caso vacío.

**No se ajustaron tests pre-existing** (por scope: los tests stale relativos al
régimen m3-default se documentan en §5; su reparación corresponde a otro FIX).

---

## 5. Riesgos residuales

1. **Tests stale (pre-existing red, no introducidos por este fix).** El baseline
   de los 3 archivos relevantes tenía **32 failed / 94 passed**, y post-cambio
   **32 failed / 97 passed** (los +3 son los tests nuevos). El set de 32 failures
   es **idéntico** pre/post → **0 regresiones, 0 failures nuevos**. Las causas
   pre-existing son ajenas a este bug:
   - `openai` SDK no instalado en el env local (sí en prod vía `requirements.txt`).
   - `EXTRACTION_DEFAULT_PROVIDER_FALLBACK = "m3"` (app_config.py L37, cambiado
     por un FIX previo) hace que tests que asumen default=gemini
     (`test_no_fallback_para_gemini_si_gemini_falla`,
     `test_legacy_calibration_sin_provider_tratada_como_gemini`,
     `test_resolve_provider_*_es_gemini`) sean stale.
   - FIX-20260812-12 gutteó `_is_m3_unavailable` para retornar siempre `False`
     sin actualizar los tests de FIX-20260810-05 que asertan `True`
     (`test_m3_unavailable_flag_off_solo_env_var`,
     `test_m3_unavailable_cache_cold_degrada_a_env_var`,
     `test_m3_unavailable_uses_db_key_when_ai_keys_from_db_enabled`).
   - Poisoning de AppConfig compartido entre tests (test-isolation pre-existing).
   - `Json` mock contract en `test_put_writes_audit_log_with_masked_suffix_no_full_key`.

   **Reparar estos tests stale corresponde a un FIX separado** (alineación de
   tests con el régimen m3-default + FIX-12), NO a este fix. Este fix no los
   empeora: `test_no_fallback_para_gemini_si_gemini_falla` cambió de modo de
   fallo (RuntimeError → M3CredentialsUnavailableError) pero era rojo en baseline.

2. **Cold-load bajo FastAPI ya no carga desde BD.** Con el fix del deadlock
   (`return None` cuando `loop.is_running()`), `_resolve_sync_cold` bajo FastAPI
   siempre retorna None → el cold path nunca carga la key desde BD. Esto es
   **equivalente al comportamiento pre-fix** (que retornaba None tras 3s de hang)
   pero sin el hang. La carga desde BD depende del **warmup** en la frontera async;
   si el warmup falla (ahora logueado) y la env var está ausente, el usuario recibe
   el error tipado en vez del mensaje del SDK. Una solución más profunda (lookup
   en `ThreadPoolExecutor` separado) sería arquitectónica y queda fuera de scope.

3. **HTTP 200 + `status:error` vs 503.** El flujo "Subir resultado" (main.py
   `v2_upload_and_analyze`) retorna 200 con `status:"error"` + `error_code` (patrón
   pre-existing consistente con el handler de `ExtractionAuthError`). Un HTTP 503
   real se consideró y se **descartó**: el frontend (`ai-prediagnosis.actions.ts`
   L168-183) muestra "Backend V2 respondió 503: <body crudo>" para `!response.ok`,
   lo cual empeoraría el UX (JSON raw en el mensaje). Con 200 + `status:error`, el
   frontend muestra `result.error` limpio. El endpoint `calibration.py` sí usa 503
   (patrón pre-existing allí, testado). **No se tocó el frontend** (regla dura: fuera
   de scope).

4. **`_resolve_sync_cold` fuera de FastAPI** (ej. CLI, scripts): el path
   `asyncio.run(...)` (cuando no hay loop) queda intacto y sigue funcional.

---

## 6. FIX-IDs previos respetados

| FIX-ID | Cómo se respeta |
|--------|-----------------|
| FIX-20260812-13 | No se elimina `_resolve_sync_cold` ni su lógica de cold-load. Solo se (a) elimina el bloque `pass` muerto adyacente y (b) arregla el deadlock interno (return None inmediato vs hang 3s). |
| FIX-20260810-06 | No se toca `resolve_sync_cached`. El patrón "lectura sync de caché caliente, no bloquear el loop" se preserva. |
| FIX-20260812-12 | **NO fallback a Gemini.** Cuando M3 no tiene credenciales, se levanta `ExtractionAuthError` (no se degrade a Gemini). El test CA-3 verifica que `call_gemini` jamás se invoca. |
| IMPL-20260809-06 | Se conserva el patrón legacy `api_key or env var` en `__init__` de `M3VisionBase` (la rotación runtime sigue en `_refresh_keys`). |
| IMPL-20260809-02 | No se cambia el selector multi-proveedor ni la precedencia override > aiCalibration > AppConfig > default. |

---

## 7. Validaciones ejecutadas

| Validación | Comando | Resultado |
|------------|---------|-----------|
| Sintaxis + imports | `python3 -c "import ast; ..."` + `importlib.import_module` | OK en los 5 archivos editados |
| Tests relevantes (pre-existing + nuevos) | `python3 -m pytest tests/test_ai_pipeline.py tests/test_admin_ai_keys.py tests/test_admin_ai_keys_probe.py` | **32 failed / 97 passed** (baseline: 32 failed / 94 passed; +3 = tests nuevos; 0 regresiones) |
| Mis 3 tests nuevos en aislamiento | `pytest TestFix20260812_14_M3MissingCredentials` | 3/3 PASSED |
| Tests M3/calibration verdes en aislamiento | `pytest test_m3_client_success_retorna_dict_parseado test_m3_auth_error_sin_fallback test_m3_client_fallback_to_gemini_on_5xx test_m3_timeout_dispara_fallback_a_gemini test_override_payload_toma_precedencia test_m3_json_no_parseable_no_es_fallback test_m3_vision_base_* test_upload_calibration_test_returns_503_on_* test_extraction_auth_error_legacy_caller_retrocompat test_gemini_403_returns_extraction_auth_error_gemini` | 17/17 PASSED (sin regresión en verdes) |
| Lint / typecheck | (ver §8) | N/A — backend es Python (no `pnpm typecheck`/`pnpm lint`); no hay `pyproject.toml`/`pytest.ini`/`package.json` en `backend/`. Validación = `pytest` + `ast.parse`. |

---

## 8. Notas operativas

- **`pnpm typecheck` / `pnpm lint`**: el enunciado sugiere `cd backend && pnpm ...`,
  pero `backend/` no contiene `package.json` ni `pyproject.toml` (es un proyecto
  Python puro gestionado con `pip` + `requirements.txt` y `Dockerfile`). Las
  validaciones equivalentes en Python son `ast.parse` (sintaxis) + `pytest`
  (tests) + `pyflakes`/`ruff` (lint, no configurados en este repo). Se ejecutó
  `ast.parse` sobre los 5 archivos editados (OK) y `pytest` (resultado en §7).
- **`openai` ausente en env local**: el SDK `openai` no está instalado en esta
  máquina (sí en Railway vía `requirements.txt`). Esto causa que los tests que no
  mockean `call_m3` y caen al path real (por poisoning de AppConfig o default=m3)
  fallen con `RuntimeError: openai SDK no instalado`. Son failures pre-existing
  del env, no del fix. En producción (con openai instalado), el guard intercepta
  el caso de api_key vacía **antes** de tocar el SDK.
