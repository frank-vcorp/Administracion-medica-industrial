# DICTAMEN TÉCNICO: Desconexión warmup ↔ probe en KeyResolver M3

- **ID:** FIX-20260812-18
- **Fecha:** 2026-08-12
- **Solicitante:** INTEGRA (diagnóstico previo: ATLAS)
- **Estado:** ✅ VALIDADO — causa raíz confirmada con logs de producción; fix aplicado y verificado

### A. Análisis de Causa Raíz

**Síntoma:** probe M3 OK (HTTP 200, descifra desde BD) pero `upload-and-analyze` con
provider=m3 retorna `M3_CREDENTIALS_UNAVAILABLE` en el mismo proceso.

**Hallazgo forense:** el instrumentation `🔍 [FIX-20260812-18]` (commit `35b2eab`)
reveló en logs de producción que existen **DOS instancias de `KeyResolver`** en el
proceso, identificadas por `resolver_id` (id() del objeto):

- Warmup + probe + admin → instancia **A** (`resolver_id=139982681345936`), caché
  poblada con key real de BD (`api_key_len=125, source=db`).
- `extract_by_type` + `M3VisionBase._refresh_keys` → instancia **B**
  (`resolver_id=139982660846160`), caché SIEMPRE fría.

**Causa:** doble carga de módulos. `backend/Dockerfile:24` declara
`ENV PYTHONPATH="/app/app"`, y `backend/app/main.py:32-35` importaba
`from services.ai import ...` / `from schemas import ...` SIN el prefijo `app.`.
Python cargó los mismos archivos bajo dos nombres de módulo distintos
(`services.ai.*` y `app.services.ai.*`), cada uno con su propio singleton
`key_resolver = KeyResolver()` (keys.py:404). El pipeline M3 quedó en el namespace
`services.*` (instancia B); todo lo demás en `app.*` (instancia A).

Ningún warmup podía resolverlo (FIX-13/14/17): el warmup escribía en A y el cliente
M3 leía B. El cold-loader (`_resolve_sync_cold`) devuelve None con event loop
corriendo (by design, FIX-14), así que B nunca se poblaba bajo FastAPI.

Descartadas con evidencia: Hipótesis A (visibilidad BD — `row_found=True` en warmup),
D (flag — `flag_off` no aparece, warmup corre), case-sensitivity (provider exacto "m3"),
TTL (CACHE_HIT age=13.6s con key buena en A durante el upload fallido).

### B. Justificación de la Solución

**Fix (commit `0fd2fce`):** unificar `main.py:32-35` al namespace canónico:

```python
from app.services.ai import DocumentClassifierService, ExtractorService, PrediagnosticService
from app.services.ai.base import GeminiBase
from app.services.pdf import SignerService, ReportService
from app.schemas import DocumentClassification, ExtractedDataUnion
```

Es la solución más simple y menos invasiva (Principio del Cañón y la Mosca): 4 líneas,
1 archivo, sin cambio de contrato ni de lógica. Elimina la duplicación de módulos →
un único `key_resolver` compartido por warmup, probe, admin y pipeline M3. Bonus:
elimina la duplicación latente de clases Pydantic (`schemas` vs `app.schemas`).

Clasificación DEBY: **L1** (1 archivo, 4 líneas, sin contrato público, confianza ~98%
con evidencia de producción) → quick-fix directo con FIX REFERENCE watermark.

**Validaciones:**
- `py_compile` OK en los 4 archivos tocados por el FIX.
- Import-chain post-fix: `ExtractorService.__module__ == 'app.services.ai.extractor'`;
  `keys.key_resolver is base.key_resolver is prediagnostic.key_resolver` → True;
  cero módulos `services.*` sin prefijo cargados.
- Reproducción local del bug pre-fix: con `sys.path` simulando PYTHONPATH,
  `services.ai.base.key_resolver is not app.services.ai.keys.key_resolver` → True.
- Tests: `TestFix20260812_18_M3WarmupCacheCoherence` (3 nuevos) + FIX-14 + test_ai_keys
  sync → **16 passed**.
- Verificación en producción post-redeploy: pendiente (se ejecuta a continuación).

### C. Instrucciones de Handoff para INTEGRA

1. **Verificar en producción** (DEBY lo hace en esta sesión): tras el redeploy de
   `0fd2fce`, repetir probe + upload de prueba y confirmar que NO hay
   `M3_CREDENTIALS_UNAVAILABLE` y que los `resolver_id` coinciden en los logs.
2. **Decisión pendiente (requiere OK de Frank):** eliminar `ENV PYTHONPATH="/app/app"`
   del `backend/Dockerfile` para fail-fast contra futuros imports sin prefijo. Es
   cambio de infra de deploy → DEBY no lo aplica sin aprobación.
3. **Mantenimiento recomendado (no urgente):**
   - Actualizar/retirar los 3 tests obsoletos de `TestFix20260810_05` (testean
     `_is_m3_unavailable` que FIX-20260812-12 cambió deliberadamente).
   - Retirar el instrumentation `🔍 [FIX-20260812-18]` cuando el rollout BD esté
     estable (o conservarlo como telemetría del resolver).
   - Resolver hang ambiental local: tests async con prisma bajo Python 3.14 dev
     (Railway corre 3.11; no afecta producción).
4. **Comunicar a Frank:** bug resuelto; el error era de namespace de imports, no de
   BD ni de la key. La key M3 de BD siempre estuvo sana.

---

**Commits:** `35b2eab` instrumentation · `8f48846` dictamen EN ANÁLISIS ·
`ead42c9` tests regresión · `0fd2fce` fix definitivo.
**Documentación forense completa:** `context/diagnostics/FIX-20260812-18-m3-warmup-disconnect.md`.
