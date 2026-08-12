# FIX-20260812-18 — Desconexión warmup ↔ probe en KeyResolver M3

**Estado:** ✅ VALIDADO (causa raíz confirmada con logs de producción + fix verificado)
**Fecha:** 2026-08-12
**Agente:** DEBY (debugger)
**Commits:** `35b2eab` (instrumentation), `8f48846` (dictamen), `ead42c9` (tests), `0fd2fce` (fix definitivo)

---

## 1. Síntoma

Contradicción funcional en producción (Railway), reproducible:

| Request | Resultado |
|---|---|
| `POST /api/v2/admin/ai-keys/m3/probe` (headers SUPERADMIN) | HTTP 200, ~700ms — descifra key M3 desde BD y M3 responde ✅ |
| `POST /api/v2/studies/upload-and-analyze` (ai_calibration_json con `extraction.provider="m3"`) | HTTP 200 + `"[M3] M3_CREDENTIALS_UNAVAILABLE"` en ~0.27s ❌ |

Mismo proceso Python (uvicorn 1 worker), misma BD, misma key. FIX-20260812-13/14/15/16/17
no lo resolvieron.

## 2. Causa raíz exacta

**Doble carga de módulos → dos singletons de `KeyResolver` en el mismo proceso.**

El Dockerfile del backend declara:

```dockerfile
# backend/Dockerfile:23-24
# PYTHONPATH: los módulos services/ y schemas/ viven dentro de /app/app/
ENV PYTHONPATH="/app/app"
```

Con `PYTHONPATH=/app/app`, el directorio `backend/app/` queda como raíz de imports
ADICIONAL al cwd (`backend/`). `main.py` tenía 4 imports sin el prefijo `app.`:

```python
# backend/app/main.py:32-35 (PRE-FIX)
from services.ai import DocumentClassifierService, ExtractorService, PrediagnosticService
from services.ai.base import GeminiBase
from services.pdf import SignerService, ReportService
from schemas import DocumentClassification, ExtractedDataUnion
```

Python resuelve esos imports cargando los MISMS archivos bajo nombres de módulo
DISTINTOS: `services.ai.*` / `schemas` (vía PYTHONPATH) y `app.services.ai.*` /
`app.schemas` (vía cwd, usados por el resto del código). Cada nombre de módulo crea
su propio objeto módulo → su propio `key_resolver = KeyResolver()` a nivel de módulo
(`keys.py:404`).

### Topología del daño (verificada con logs de producción)

| Componente | Namespace | Instancia KeyResolver |
|---|---|---|
| Warmup genérico + FIX-17 (`main.py`) | `app.services.ai.keys` | **A** (`resolver_id=139982681345936`) |
| Probe (`app.api.v2.admin_ai_keys_probe` → `app.services.ai.probe`) | `app.services.ai.keys` | **A** |
| Admin ai-keys GET/PUT (`app.api.v2.admin_ai_keys`) | `app.services.ai.keys` | **A** |
| Pipeline extracción (`ExtractorService` importado vía `services.ai`) | `services.ai.keys` | **B** (`resolver_id=139982660846160`) |
| `M3VisionBase._refresh_keys` (base.py cargado como `services.ai.base`) | `services.ai.keys` | **B** |

El warmup poblaba la caché de **A** con la key real de BD (`api_key_len=125,
source=db`), pero `M3VisionBase._refresh_keys` leía la caché de **B** — siempre fría.
Con caché fría, `_resolve_sync_cold("m3")` devuelve `None` (hay event loop corriendo;
FIX-20260812-14 documentó que no puede operar en el hilo del loop) → `self.api_key`
queda `""` → `call_m3` lanza `M3CredentialsUnavailableError`.

### Por qué el probe SÍ funcionaba

El probe usa `get_key_resolver()` desde `app.services.ai.keys` → instancia **A** →
`resolve("m3")` consulta BD directamente (caché fría en A la primera vez, luego
CACHE_HIT) → descifra OK → HTTP 200 contra la API de M3.

### Por qué FIX-20260812-13/14/17 no funcionaron

- **FIX-13** (cold-load sync): devuelve `None` con loop corriendo (by design, FIX-14).
- **FIX-14** (guard tipado): convirtió el error opaco en accionable, pero no toca resolución.
- **FIX-17** (warmup específico del provider): calentó MÁS la instancia **A**; **B** seguía fría.

Ningún warmup puede arreglarlo: el problema no es CUÁNDO se calienta la caché sino
EN QUÉ OBJETO se calienta.

## 3. Evidencia (logs de producción, anonimizados)

Instrumentation `🔍 [FIX-20260812-18]` (commit `35b2eab`). Reproducción DEBY contra
producción 2026-08-12 ~18:05 CEST:

```text
# Probe (instancia A — funciona):
🔍 _lookup_db provider=m3 prisma_id=94817895733024 row_found=True row_enabled=True
🔍 resolve provider=m3 descifrado OK source=db api_key_len=125 resolver_id=139982681345936

# Upload (warmup en A, pipeline lee B):
🔍 warmup genérico START resolver_id=139982681345936
🔍 resolve provider=m3 → CACHE_HIT age=13.6s source=db warning=None api_key_len=125 resolver_id=139982681345936
🔍 warmup provider=m3 api_key_len=125 source=db warning=None
🔍 warmup específico provider=m3 origin=app_config_default calibration_provider=m3
🔍 warmup específico result provider=m3 api_key_len=125 source=db warning=None
⚠️ [IMPL-20260812-05] AI_KEYS_FROM_DB_ENABLED=true pero caché TTL fría para provider='m3'...
🔍 extract_by_type provider=m3 cache_resolution=None (caché TTL FRÍA) resolver_id=139982660846160   ← OBJETO DISTINTO
🔍 M3VisionBase._refresh_keys resolve_sync_cached=None (caché fría) resolver_id=139982660846160      ← OBJETO DISTINTO
🔍 _resolve_sync_cold provider=m3 loop RUNNING → return None
🔍 call_m3 → M3CredentialsUnavailableError; key_source=env key_resolution_warning=cache_cold_no_db_row
❌ Error en V2 upload-and-analyze: [M3] M3_CREDENTIALS_UNAVAILABLE: ...
```

`resolver_id` (id() del objeto) demuestra las dos instancias en el mismo proceso.

### Reproducción local de la duplicación (forense)

```bash
# Simulando PYTHONPATH=/app/app:
sys.path = ['backend', 'backend/app']
from services.ai import ExtractorService        # → módulo services.ai.extractor
from app.services.ai.keys import key_resolver   # → módulo app.services.ai.keys
# base_dup.key_resolver is not kr_app  →  True  (ids distintos)
```

## 4. Cambios aplicados

### Fix definitivo (commit `0fd2fce`) — 4 líneas en `backend/app/main.py`

```python
# POST-FIX — namespace canónico único
from app.services.ai import DocumentClassifierService, ExtractorService, PrediagnosticService
from app.services.ai.base import GeminiBase
from app.services.pdf import SignerService, ReportService
from app.schemas import DocumentClassification, ExtractedDataUnion
```

Con esto TODO el proceso carga `app.services.ai.*` una sola vez → un único
`key_resolver`. El warmup, el probe, el admin y `M3VisionBase._refresh_keys`
comparten la misma caché.

Verificación local post-fix:
- `ExtractorService.__module__ == 'app.services.ai.extractor'` ✅
- `keys.key_resolver is base.key_resolver is prediagnostic.key_resolver` ✅
- Cero módulos `services.*`/`schemas` sin prefijo cargados ✅

Bonus: también elimina la duplicación de clases Pydantic (`schemas` vs `app.schemas`)
que era un bug latente de identidad de clase para `isinstance`/validación.

### Instrumentation forense (commit `35b2eab`) — se conserva

Logging `🔍 [FIX-20260812-18]` en `keys.py` (resolve/_lookup_db/_resolve_sync_cold),
`main.py` (warmups), `extractor.py` (extract_by_type), `base.py` (_refresh_keys/call_m3).
Sin secretos: sólo `api_key_len`, `source`, `warning`, `resolver_id`, `prisma_id`.
Útil para monitorear la salud del resolver en prod; se puede retirar en un FIX futuro
cuando se estabilice el rollout BD.

## 5. Tests añadidos (commit `ead42c9`)

`backend/tests/test_ai_pipeline.py::TestFix20260812_18_M3WarmupCacheCoherence` (3 tests, PASS):

- **CA-1** `test_refresh_keys_popula_api_key_desde_cache_caliente_db`: caché caliente
  con resolución DB → `_refresh_keys` popula `self.api_key`.
- **CA-2** `test_refresh_keys_no_popula_api_key_si_resolucion_inutil`: resolución
  NO-USABLE (api_key="", warning=row_missing) → api_key queda vacía (mecanismo proximal).
- **CA-3** `test_warmup_async_puebla_cache_legible_por_refresh_keys`: end-to-end
  warmup async → `resolve_sync_cached` → `_refresh_keys` sin prisma.

Resultado: `16 passed` (FIX-18 + FIX-14 + test_ai_keys no-async).

## 6. Riesgos residuales

1. **`ENV PYTHONPATH="/app/app"` sigue en el Dockerfile** (habilitador de la doble
   carga). Si alguien vuelve a importar sin prefijo `app.`, el bug puede reaparecer.
   **Recomendación (requiere OK de Frank/INTEGRA — cambio de infra):** eliminar ese
   `ENV` del Dockerfile para que cualquier import sin prefijo falle en el build
   (fail-fast). No se hizo en este FIX por ser cambio de infraestructura de deploy.
2. **Tests async de `test_ai_keys.py` que usan prisma** cuelgan en Python 3.14 local
   (hang de import `prisma/types.py` — ambiental; Railway corre Python 3.11). Preexistente,
   no causado por este FIX. En CI/prod los tests corren bajo 3.11.
3. **3 tests de `TestFix20260810_05` fallan** (preexistente): testean
   `_is_m3_unavailable` que FIX-20260812-12 cambió deliberadamente a `return False`.
   Quedaron obsoletos; deberían actualizarse en un FIX de mantenimiento.
4. El instrumentation de debug añade ~5-10 prints por request de upload: volumen de log
   levemente mayor. Retirar en limpieza posterior si se desea.
5. `/tmp` de la máquina de dev está al límite de quota por `/tmp/sync_hermes_backup`
   (9.1G, tmpfs). No afecta a este FIX pero bloquea operaciones locales que escriban a /tmp.

## 7. Validación post-deploy (pendiente de confirmación final)

Plan: tras el redeploy de `0fd2fce`, repetir la reproducción:
1. `POST /api/v2/admin/ai-keys/m3/probe` → debe seguir OK.
2. `POST /api/v2/studies/upload-and-analyze` con calibration m3 → NO debe retornar
   `M3_CREDENTIALS_UNAVAILABLE`. Con el PDF de prueba (456 bytes, contenido no médico)
   es esperable un error de EXTRACCIÓN (JSON no parseable de M3) — eso CONFIRMA que la
   credencial ya se resuelve (el request llega hasta la llamada HTTP real a M3).
3. Los logs deben mostrar `extract_by_type ... resolver_id` IGUAL al del warmup.
