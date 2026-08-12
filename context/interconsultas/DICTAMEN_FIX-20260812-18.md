# DICTAMEN TÉCNICO: Desconexión warmup ↔ probe en KeyResolver M3

- **ID:** FIX-20260812-18
- **Fecha:** 2026-08-12
- **Solicitante:** INTEGRA (vía ATLAS — diagnóstico previo)
- **Estado:** 🟡 EN ANÁLISIS (esperando logs de Railway con instrumentation FIX-20260812-18-debug)

## Contexto

Contradicción funcional en producción (Railway):

| Endpoint | Resultado |
|---|---|
| `POST /api/v2/admin/ai-keys/m3/probe` | HTTP 200, 702-811ms — descifra key M3 desde BD ✅ |
| `POST /api/v2/studies/upload-and-analyze` (ai_calibration_json válido, provider=m3) | HTTP 200 + `error_code=M3_CREDENTIALS_UNAVAILABLE` ❌ |

Mismo proceso Python (uvicorn 1 worker, `backend/Dockerfile:32`), mismo singleton
`key_resolver` (`keys.py:404`), mismo cliente Prisma (`prisma_client.py` singleton
inyectado en lifespan). FIX-20260812-14/15/16/17 deployados; el -17 (warmup específico
del provider del selector) NO resolvió el bug.

## Hechos verificados por lectura de código (pre-logs)

1. **Un solo proceso**: `uvicorn app.main:app` sin `--workers` → probe y upload corren
   en el mismo event loop, mismo `key_resolver`, mismo `_cache`.
2. **Probe usa el mismo singleton**: `probe.py:372` `get_key_resolver()` → mismo objeto
   que `main.py:988` importa para el warmup.
3. **Provider case-sensitive OK**: `EXTRACTION_PROVIDERS = frozenset({"gemini","m3"})`;
   el request llegó a `M3_CREDENTIALS_UNAVAILABLE` (no a `EXTRACTION_PROVIDER_UNKNOWN`),
   así que el provider es exactamente `"m3"` en el extractor. Descartada variante de case.
4. **El error_code `M3_CREDENTIALS_UNAVAILABLE` solo se emite en `v2_upload_and_analyze`**
   (main.py:~1167). Los endpoints v1/legacy no lo emiten → el request SÍ pasó por el
   handler con warmup.
5. **`_refresh_keys` (base.py)**: si la caché tiene resolución con `api_key=""`
   (fallback env con warning), `self.api_key` NO se actualiza → `call_m3` lanza
   `M3CredentialsUnavailableError`. Este es el mecanismo proximal del error.
6. **Hipótesis D descartada en principio**: si `AI_KEYS_FROM_DB_ENABLED` no se leyera
   en runtime, el probe también degradaría a env var (M3_API_KEY vacía) y retornaría
   "Sin API key configurada" — pero el probe SÍ funciona. Igual se instrumentó.

## Hipótesis pendientes de confirmación con logs

- **A — Ciclo de vida/visibilidad BD**: el `find_unique` del warmup no ve la fila
  (transacción/replicación) mientras el probe sí. Poco probable: misma conexión, fila commiteada hace tiempo.
- **B — Cliente Prisma distinto**: `_lookup_db` lazy importa `get_prisma_client()`;
  si retornara objeto distinto al del probe. Improbable ( singleton de módulo), se
  verifica con `prisma_id=` y `resolver_id=` en logs.
- **C — Caché TTL con estado malo**: una resolución fallida (row_missing/db_unavailable/
  decrypt_error) cacheada 60s es heredada por el pipeline. El warmup NO re-consulta BD
  si la caché está fresca (CACHE_HIT) — si algo pobló caché mala, el warmup la hereda.
- **D — Flag no leída en runtime**: instrumentada aunque improbable (ver hecho 6).
- **F (nueva) — Divergencia de provider objetivo**: FIX-17 calienta el provider según
  `extraction_provider_override` (form) o default AppConfig, NO según
  `ai_calibration_json.extraction.provider`. Si difieren, el warmup específico calienta
  otro provider (el genérico cubre m3 de todos modos — se verifica en logs).

## Instrumentation aplicado (commit 35b2eab, push 2026-08-12 17:39)

Logging exhaustivo `🔍 [FIX-20260812-18]` sin cambio de lógica y sin secretos
(sólo `api_key_len`, `source`, `warning`, `resolver_id`, `prisma_id`):

| Archivo | Punto |
|---|---|
| `keys.py:_lookup_db` | `row_found`, `row_enabled`, `prisma_id` |
| `keys.py:resolve` | flag_off / CACHE_HIT(age,source,warning,len) / lookup EXC / row=None / row_disabled / ENCRYPTION_KEY ausente / descifrado FAIL / descifrado OK |
| `keys.py:_resolve_sync_cold` | loop RUNNING → None |
| `main.py` warmup genérico | START resolver_id + resultado por provider + SKIP si flag off |
| `main.py` warmup FIX-17 | provider objetivo, origin (override/app_config/fallback), calibration_provider, resultado |
| `extractor.py:extract_by_type` | lectura `resolve_sync_cached` (len/source/warning o None) |
| `base.py:_refresh_keys` | flag_off / lectura caché / resolución NO-USABLE (api_key vacía) |
| `base.py:call_m3` | estado final al lanzar M3CredentialsUnavailableError |

## Matriz de interpretación de logs (para el análisis)

Secuencia esperada en un upload fallado, y qué revela cada línea:

1. `warmup genérico START resolver_id=X` → debe existir. Si NO está → flag off en runtime (D) o el handler no corrió.
2. `resolve provider=m3 → ...` dentro del warmup:
   - `descifrado OK source=db api_key_len>0` → warmup pobló caché buena; buscar dónde se pierde después.
   - `row=None → row_missing` → hipótesis A (visibilidad BD).
   - `lookup EXC <tipo>` → hipótesis B/infra Prisma.
   - `descifrado FAIL <tipo>` → ENCRYPTION_KEY/distinto master key.
   - `CACHE_HIT ... warning=<algo> api_key_len=0` → hipótesis C: caché mala preexistente heredada.
3. `warmup provider=m3 api_key_len=...` → confirmación a nivel handler.
4. `extract_by_type provider=m3 cache_resolution ...`:
   - `api_key_len=0` o `None` → la caché llegó mala/fría al pipeline sync.
   - `api_key_len>0` → la caché llegó buena; el problema está en `_refresh_keys`/instancia.
5. `M3VisionBase._refresh_keys ...`:
   - `resolve_sync_cached=None` + `_resolve_sync_cold loop RUNNING` → caché fría en el cliente (TTL vencido entre warmup y call, o resolver distinto → comparar `resolver_id`).
   - `resolución NO-USABLE: api_key vacía` → caché con fallback env; confirma mecanismo proximal.
6. `call_m3 → M3CredentialsUnavailableError; key_source=... key_resolution_warning=...` → firma final del fallo.

## Próximos pasos

1. Frank: reproducir el bug (subir PDF de prueba) tras el redeploy de Railway.
2. Frank: compartir logs de Railway filtrados por `FIX-20260812-18` (últimos 30 min).
3. DEBY: aplicar matriz de interpretación → identificar hipótesis correcta → fix definitivo
   (requiere OK de INTEGRA/Frank antes de commitear).

## Reglas respetadas

- Sin degradación a Gemini (FIX-20260812-12).
- FIX-20260812-14/15/16/17 intactos.
- Sin fix definitivo hasta tener logs (regla dura de la tarea).
- Logging sin secretos: nunca se imprime la key en claro (sólo longitudes).
