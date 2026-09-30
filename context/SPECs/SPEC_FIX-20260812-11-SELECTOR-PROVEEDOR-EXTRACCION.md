# SPEC — FIX-20260812-11 · Selector de proveedor de extracción end-to-end

- **ID:** FIX-20260812-11
- **Tipo:** FIX (arquitectura de orquestación)
- **Prioridad:** P1
- **Estado (IDL):** READY
- **Antecesores relevantes:** ARCH-20260809-02 (selector multi-proveedor), ARCH-20260809-05 (default persistido), FIX-20260810-05 (keys desde BD), FIX-20260812-05 (`_refresh_keys` respeta model del selector), FIX-20260812-09 (DELETE fila `gemini` leaked), FIX-20260812-10 (fallback hardcoded `m3`)
- **Autor:** INTEGRA
- **Fecha:** 2026-08-12
- **DoR:** ID ✓, prioridad ✓, resultado ✓, SPEC (este doc) ✓, criterios verificables §4 ✓, dependencias disponibles ✓, validación detectable §4 ✓, sin decisiones bloqueantes ✓.

---

## 1. Diagnóstico definitivo (1 página)

Frank ve `Clasificando documento (Gemini/gemini-flash-latest)` en el log al subir un PDF en `/events/<id>?view=IN_PROGRESS`, seguido de un 403 PERMISSION_DENIED (key Gemini leaked y bloqueada por Google). El selector de proveedor **no gobierna este flujo**. La causa NO es el selector en sí — es **el alcance del selector**: solo controla la fase de EXTRACCIÓN, no la de CLASIFICACIÓN, y además el FormData del flujo inicial no siempre lleva `study_type`.

### 1.1 Cadena causal (5 eslabones, verificados en código)

| # | Eslabón | Evidencia (archivo:líneas) | Estado |
|---|---|---|---|
| 1 | El flujo inicial `uploadEventTestFile` solo inyecta `study_type` al FormData cuando `getCanonicalAIStudyType(eventTest)` retorna **no-null**. Si el test del EventTest no está mapeado en `study-ai.ts`, el FormData viaja **sin `study_type`**. | `frontend/src/actions/event-test.actions.ts:620-628` | Confirmado |
| 2 | `triggerStudyAIAnalysis` reenvía `study_type` al backend **solo si** llegó en el FormData original. No hace resolución canónica propia. | `frontend/src/actions/ai-prediagnosis.actions.ts:129, 156-158` | Confirmado |
| 3 | Backend: si `study_type` es None/empty, entra al `else` e invoca `classifier.classify(local_path)`. | `backend/app/main.py:1003-1010` | Confirmado |
| 4 | `DocumentClassifierService(GeminiBase)` es **Gemini hardcoded**. No existe `M3ClassifierService` ni consulta al selector `_resolve_provider`. Imprime exactamente el log que Frank reporta: `🔍 Clasificando documento (Gemini/{self.model})`. | `backend/app/services/ai/classifier.py:14, 18, 51, 65` | Confirmado |
| 5 | Cuando Gemini classification revienta con 403 (key leaked), la excepción **no es** `ExtractionAuthError` (esa envoltura solo existe en `extractor.py:500` para la fase de extracción). Se propaga como error genérico al caller HTTP → 500 opaco o mensaje críptico. **No hay fallback a M3.** El selector es irrelevante: nunca se llega a invocar el extractor porque el classifier revienta antes. | `backend/app/services/ai/extractor.py:483-507` (contrato solo cubre fase extracción) | Confirmado |

### 1.2 Bug secundario: `/api/v2/ai/status` miente sobre `key_in_db.m3`

`_key_in_db_sync` retorna `False` cuando `loop.is_running()` es True (`main.py:460`). Bajo FastAPI runtime, el loop **siempre** está corriendo → el endpoint reporta `key_in_db: {m3: False, gemini: False, dr7: False}` aunque la BD tenga las filas. Frank diagnostica mal el sistema por esto. No bloquea la operación, pero impide depurar.

### 1.3 Aclaración de errores comunes (lo que NO es la causa)

- **No es** caché stale de `_resolve_provider`: el AppConfigStore TTL 60s es correcto; el problema es que el selector **nunca se invoca** en el path que revienta.
- **No es** `_default_model_for` returning `gemini-flash-latest`: ese string solo lo imprime `classifier.py:65` porque hereda `GeminiBase` y `self.model` viene de la inicialización del classifier, NO del selector.
- **No es** falta de fallback Gemini→M3 en `extractor.py:483`: ese contrato protege la fase de EXTRACCIÓN (cuando sí se invoca); la fase que falla es la CLASIFICACIÓN, que es upstream.
- **No es** el AppConfig default: `EXTRACTION_DEFAULT_PROVIDER_FALLBACK = "m3"` ya está deployado, pero no aplica porque el classifier no lo consulta.

### 1.4 Causa raíz consolidada (1 frase)

> El selector de proveedor (ARCH-20260809-02) gobierna la extracción, pero **no la clasificación**; cuando el frontend no envía `study_type`, el backend cae a un clasificador Gemini hardcoded que revienta con 403 sin fallback, **antes** de que el selector tenga oportunidad de actuar.

---

## 2. Cambios mínimos necesarios (1 página, diffs conceptuales)

### Evaluación de propuestas de Frank

| Propuesta | Veredicto | Razón |
|---|---|---|
| **A** — Frontend siempre pasa `study_type`; no tocar contrato "sin fallback" | ✅ Aceptar **parcialmente**. Necesario pero **insuficiente**: cualquier evento no mapeado en `study-ai.ts` seguirá cayendo al clasificador. Hay que añadir defensa en backend. |
| **B** — Cambiar contrato `extractor.py:483` para fallback Gemini→M3 en auth_error | ❌ **Desestimar** (mal enfocado). El contrato de extractor **no es** la causa raíz. Modificarlo no resuelve el classifier. Solo se tocará si tras Fase 1+2 sigue habiendo un caso donde la EXTRACCIÓN Gemini revienta sin study_type — escenario marginal. |
| **C** — Refactor `_key_in_db_sync` | ✅ Aceptar como **Fase 3** (no bloqueante para el flujo). Mejora diagnóstico pero no operación. |
| **D** — Persistir `provider_priority` en AppConfig | ❌ **Desestimar** para este FIX. El selector ya tiene precedencia; añadir prioridad es feature nueva, no fix. Anotar en BACKLOG como `TKT-20260812-11-01`. |

### 2.1 Cambio #1 — Backend: cuando falte `study_type`, evitar el classifier Gemini hardcoded

**Archivo:** `backend/app/main.py`
**Líneas:** `1003-1010` (rama `else` actual)
**Comportamiento actual:** invoca `classifier.classify(local_path)` → Gemini hardcoded.
**Comportamiento esperado:** La rama `else` debe ejecutar una **resolución defensiva** antes de invocar al classifier:

1. Si `AI_KEYS_FROM_DB_ENABLED=true` y la BD tiene una fila válida para el provider resuelto por `get_extraction_default_provider_sync()` (típicamente `m3` tras FIX-20260812-10), entonces:
   - Marcar `detected_type = "unknown"`, `classification_dict = {"detected_type": "unknown", "confidence": 0.0, "reason": "skipped_classifier_no_study_type"}`.
   - Saltar la llamada a `classifier.classify`.
   - Imprimir log: `ℹ️ [FIX-20260812-11] study_type ausente; saltando clasificador Gemini (default provider=<m3>)`.
2. Si el provider default es `gemini` (configuración futura tras rotar key), mantener el comportamiento legacy (invocar classifier). Esto evita regresión cuando Gemini vuelva a estar sano.
3. Si no hay provider default determinable, propagar `EXTRACTION_PROMPT_NOT_CONFIGURED` (400 explícito, mejor UX que 403 opaco de Gemini).

**Nota:** No se crea `M3ClassifierService`. Es un **skip del classifier**, no una migración del classifier a M3. M3 no tiene prompt de clasificación definido; reusarlo para clasificar introduciría un contrato nuevo. El extractor ya sabe manejar `detected_type="unknown"` — basta con que la resolución del prompt de extracción (`calibration.py` / `_resolve_extraction_prompt`) falle explícitamente con 400 si el `aiCalibration` no tiene prompt para `"unknown"`. **Restricción:** validar que `extract_by_type` no caiga a un default silencioso; debe propagar 400 `EXTRACTION_PROMPT_NOT_CONFIGURED` (ese error_code ya existe en el codebase).

### 2.2 Cambio #2 — Backend: fallback de classifier cuando revienta con auth_error

**Archivo:** `backend/app/main.py`
**Líneas:** `1003-1010` + nuevo bloque `try/except` alrededor de `classifier.classify(local_path)`
**Comportamiento esperado:** Envolver la llamada `classifier.classify(local_path)` en un `try/except`. En el `except`:

- Si el error indica HTTP 401/403 (inspeccionando `getattr(err, "status_code", None)` o `getattr(err, "response", None)` como ya hace `extractor.py:491-495`), entonces:
  - Log explícito: `⚠️ [FIX-20260812-11] Classifier Gemini falló (HTTP 403) → saltando a detected_type='unknown' para que el extractor use el selector`.
  - Marcar `detected_type = "unknown"`, `classification_dict` como en Cambio #1.
  - **No reintentar** con M3 en classifier (no hay contrato).
- Si el error es otro (timeout, JSON no parseable, 5xx), propagar como antes (no inventar fallback).

Esto convierte el 403 opaco actual en un flujo controlado: el classifier falla, el backend lo detecta, salta al extractor con `study_type="unknown"`, y el extractor decide según el selector (M3 si es el default).

### 2.3 Cambio #3 (Fase 2) — Contrato extractor: aceptar `detected_type="unknown"` sin fail-fast

**Archivo:** `backend/app/services/ai/extractor.py` (función `extract_by_type`, al inicio)
**Líneas a localizar:** inicio de `extract_by_type` (alrededor de línea 405-430, donde se inicializa el stash).
**Comportamiento esperado:** Si `detected_type == "unknown"` y `aiCalibration` no trae un prompt explícito para `"unknown"`, lanzar `ExtractionProviderUnknownError`-style 400 con `error_code="EXTRACTION_PROMPT_NOT_CONFIGURED"` y mensaje accionable: `"El estudio subido no trae study_type y la calibración del test no define prompt de extracción. Sube el archivo desde el flujo del test mapeado o configura la calibración."`. Esto es lo que Frank ya considera "mejor UX".

**No tocar** el contrato `extractor.py:483-507` (sin fallback Gemini→M3 en extracción) — Propuesta B desestimada.

### 2.4 Cambio #4 (Fase 3, opcional) — `_key_in_db_sync` veraz

**Archivo:** `backend/app/main.py`
**Líneas:** `432-467`
**Comportamiento esperado:** Reemplazar la lógica `if loop.is_running(): return False` por una consulta real a la BD. Dos opciones (SOFIA elige la menos invasiva):
- (a) Convertir el endpoint `/api/v2/ai/status` a `async def` y awaitear `prisma.aiproviderkey.find_unique(...)` directamente. Simple y correcto. Requiere verificar que no rompa el contrato del endpoint (sigue retornando JSON con los mismos campos).
- (b) Mantener sync y usar `asyncio.run_coroutine_threadsafe(coro, loop).result(timeout=2)` contra el loop dedicado de FastAPI. Más frágil.
**Recomendación:** opción (a). Si el endpoint ya es `async` (lo es, FastAPI), basta con cambiar la firma interna.

### 2.5 Cambio #5 (Fase 1, frontend) — Asegurar `study_type` en el flujo inicial

**Archivo:** `frontend/src/actions/event-test.actions.ts`
**Líneas:** `620-628`
**Comportamiento actual:** `if (isAIEligible) { const canonicalType = getCanonicalAIStudyType(eventTest); if (canonicalType) formData.set('study_type', canonicalType) }`.
**Comportamiento esperado:** Añadir log explícito cuando `isAIEligible === true` pero `canonicalType === null`: `console.warn('[FIX-20260812-11] EventTest AI-eligible pero sin mapping canónico; el backend caerá a classifier o a detected_type=unknown', { eventTestId, testCode })`. **No** forzar un `study_type` inventado. El backend (Cambios #1 + #2) ya cubre este caso defensivamente.

**Opcional (Fase 2):** Ampliar `frontend/src/lib/study-ai.ts` para que más tests tengan mapping canónico. **No es bloqueante** — el backend ya no revienta. Defer a BACKLOG.

---

## 3. Plan de implementación por fases (resumen)

### Fase 1 — Desbloqueo mínimo (5 min, sin deploy de schema)

Objetivo: que el flujo `/events/...` ya no reviente con 403 opaco.

- Implementar **Cambio #1** (skip classifier cuando falta `study_type` y default provider es M3).
- Implementar **Cambio #2** (try/except alrededor de `classifier.classify` para auth_error).
- Implementar **Cambio #5** (log frontend cuando mapping canónico falta).

**Resultado Fase 1:** Subir un PDF en `/events/<id>?view=IN_PROGRESS` con AppConfig default=m3 → no aparece `Clasificando documento (Gemini/...)` en el log; en su lugar `saltando clasificador Gemini` y el extractor se invoca con `detected_type=unknown` y provider=m3 (selector). Si la calibración del test define prompt para `unknown` o el test está mapeado, extrae con M3. Si no, 400 `EXTRACTION_PROMPT_NOT_CONFIGURED` accionable.

### Fase 2 — Robustez (15 min)

- Implementar **Cambio #3** (extractor acepta `detected_type=unknown` y falla con 400 explícito si no hay prompt).
- **No** implementar Propuesta B (fallback en `extractor.py:483`); desestimada.

### Fase 3 — Diagnóstico veraz (opcional, 15 min)

- Implementar **Cambio #4** (`_key_in_db_sync` veraz).
- **No** implementar Propuesta D (prioridad persistida); anotar en BACKLOG como `TKT-20260812-11-01`.

---

## 4. Criterios de aceptación verificables (1 página)

### 4.1 Tests de comportamiento end-to-end

| ID | Escenario | Comando / acción | Resultado esperado |
|---|---|---|---|
| AC-1 | Upload PDF sin `study_type`, AppConfig default=m3, fila `m3` en BD, sin override | `curl -X POST $BACKEND/api/v2/studies/upload-and-analyze -F "file=@audiometria.pdf" -F "triggered_by_user_id=system"` (no pasar `study_type`) | HTTP 200 con `status=success` O HTTP 400 con `error_code=EXTRACTION_PROMPT_NOT_CONFIGURED`. **No** HTTP 403. **No** HTTP 500. Log backend contiene `saltando clasificador Gemini` (no `Clasificando documento (Gemini/...)`). |
| AC-2 | Upload PDF con `study_type=Audiometria`, default=m3 | `curl ... -F "study_type=Audiometria" ...` | HTTP 200, `provider_used=m3` en la respuesta, snapshot persistido con `modelName=MiniMax-M3` (o lo que determine la BD). |
| AC-3 | Upload PDF con `study_type=Audiometria`, aiCalibration.extraction.provider=gemini (configurado en el test) | curl con `ai_calibration_json={"extraction":{"provider":"gemini","model":"gemini-2.5-flash"}}` | HTTP 200 si Gemini sano, **o** HTTP 503 `GEMINI_API_KEY_REVOKED` si Gemini 403 (envuelto en `ExtractionAuthError`, no 500 opaco). **No** fallback silencioso a M3 en extracción (contrato preservado). |
| AC-4 | Upload PDF sin `study_type`, default=gemini (simular rotación futura de key), Gemini sano | curl sin `study_type` | HTTP 200, classifier se invoca normalmente (legacy path preservado, no regresión). |
| AC-5 | `/api/v2/ai/status` | `curl $BACKEND/api/v2/ai/status` | `key_in_db.m3 == true` si la fila existe en BD (no `false`). `key_in_db.gemini == false` si la fila fue borrada (consistente con FIX-20260812-09). |
| AC-6 | Log trazabilidad | Tras AC-1, grep logs backend por `provider_used` | Aparece `provider_used=m3` (no `gemini`). |
| AC-7 | Snapshot modelName | Tras AC-1, consultar `StudyExtractionSnapshot` por el último creado para ese eventTest | `modelName` coincide con `M3_DEFAULT_MODEL` o el model de la fila `ai_provider_keys` para `m3`, **no** `gemini-flash-latest`. |

### 4.2 Tests de no-regresión

- **NR-1:** Flujo Calvin (`calibration.py`) **no se modifica**. Validar que `pnpm test` (suite existente) sigue verde. Restrict: SOFIA no toca `calibration.py`.
- **NR-2:** Endpoint `/api/v2/ai/status` campos previos (`api_key_present`, `m3_status`, `pipeline_version`, etc.) siguen presentes. Solo `key_in_db.*` cambia de valor (de false a true).
- **NR-3:** Flujo de regeneración IA (`event-test.actions.ts:866-877`) que **ya envía `study_type`** sigue funcionando sin cambio observable.
- **NR-4:** Rama XML audiometría (`event-test.actions.ts:638-712`) no se altera.

### 4.3 Validaciones automáticas obligatorias (handoff SOFIA → GEMINI)

1. `pnpm typecheck` (frontend).
2. `pnpm test` (suite existente; foco en tests de `event-test.actions` y `ai-prediagnosis.actions` si existen).
3. `pnpm lint` si script existe.
4. Backend: cualquier comando de test existente (pytest si hay). Si no hay, validar con curl manual AC-1 a AC-7.
5. Self-review manual antes de reportar listo: ¿el código refleja esta SPEC? ¿edge cases §4.2 cubiertos? ¿riesgo de regresión en flujo Calvin?

### 4.4 Edge cases obligatorios a cubrir con tests (si SOFIA los puede generar sin nueva dep)

- EC-1: `study_type=""` (string vacío, no None) — debe tratarse como ausente.
- EC-2: `study_type="Otro"` (tipo canónico no mapeado) — debe invocar extractor con `detected_type="Otro"`; el extractor decide.
- EC-3: `ai_calibration_json` malformado — ya cubierto por `main.py:951-956`, no regresión.
- EC-4: AppConfig default=m3 pero fila `m3` en BD borrada — el extractor falla con `M3_AUTH_ERROR` envuelto (no 500 opaco); AC-1 no debe sostenerse en este caso (es una condición de error real, no de fallback).

---

## 5. Asignación de subagentes y comandos curl (1 página)

### 5.1 Asignación

| Fase | Subagente | Subagent_type | Tarea |
|---|---|---|---|
| Fase 1 (Cambios #1, #2, #5) | **SOFIA** | `sofia` | Implementar los 3 cambios. ≤3 archivos. Validar con curl AC-1, AC-4. Self-review. Reportar IMPL-20260812-11-01. |
| Fase 2 (Cambio #3) | **SOFIA** | `sofia` | Implementar extractor fallback explícito a 400. Validar AC-1 con calibración sin prompt. Reportar IMPL-20260812-11-02. |
| Fase 3 (Cambio #4) | **SOFIA** (o **DEBY** si hay dudas) | `sofia` o `debugger` | Convertir endpoint a async o usar `run_coroutine_threadsafe`. Validar AC-5. Reportar IMPL-20260812-11-03. |
| Auditoría final | **GEMINI** | `gemini` | Segunda mano de validación tras Fase 1+2. Verificar: SPEC cumplida, no-regresión Calvin, edge cases cubiertos. Reportar QA-20260812-11-01. |
| Forense (si Fase 1 no converge tras 2 intentos) | **DEBY** | `debugger` | Trace runtime: ¿`get_extraction_default_provider_sync` retorna `m3` cuando se invoca desde main.py? ¿el try/except del Cambio #2 captura el error correcto? Dictamen FIX-20260812-11-forense. |

### 5.2 Comandos curl de validación (entregar a SOFIA en el handoff)

```bash
# AC-1: upload sin study_type, default=m3
curl -sS -X POST "$BACKEND/api/v2/studies/upload-and-analyze" \
  -F "file=@/tmp/audiometria.pdf" \
  -F "triggered_by_user_id=system" | jq '.status, .error_code, .provider_used'

# Esperado: "success" o "EXTRACTION_PROMPT_NOT_CONFIGURED". NO "M3_AUTH_ERROR", NO HTTP 403/500.

# AC-2: upload con study_type, default=m3
curl -sS -X POST "$BACKEND/api/v2/studies/upload-and-analyze" \
  -F "file=@/tmp/audiometria.pdf" \
  -F "study_type=Audiometria" \
  -F "triggered_by_user_id=system" | jq '.status, .provider_used, .extraction_snapshot.model_name'

# AC-5: status veraz
curl -sS "$BACKEND/api/v2/ai/status" | jq '.key_in_db'

# AC-6: log trazabilidad (tras AC-1)
docker logs $BACKEND_CONTAINER 2>&1 | grep -E "(provider_used|saltando clasificador|Clasificando documento)" | tail -20

# AC-3: aiCalibration.extraction.provider=gemini (regresión contrato)
curl -sS -X POST "$BACKEND/api/v2/studies/upload-and-analyze" \
  -F "file=@/tmp/audiometria.pdf" \
  -F "study_type=Audiometria" \
  -F 'ai_calibration_json={"extraction":{"provider":"gemini","model":"gemini-2.5-flash"}}' \
  -F "triggered_by_user_id=system" | jq '.status, .error_code'
# Esperado: "success" (si Gemini sano) o "GEMINI_API_KEY_REVOKED" (si leaked). NO fallback a M3.
```

### 5.3 Handoff textual a SOFIA (Fase 1)

> **SOFIA — IMPL-20260812-11-01 (Fase 1):** Implementa los Cambios #1, #2, #5 de `context/SPECs/SPEC_FIX-20260812-11-SELECTOR-PROVEEDOR-EXTRACCION.md` §2.1, §2.2, §2.5. **Restricciones:** NO modificar `backend/app/services/ai/calibration.py` (flujo Calvin intocable). NO modificar el contrato `extractor.py:483-507` (Propuesta B desestimada). NO agregar dependencias. NO tocar `schema.prisma`. **Validaciones obligatorias antes de reportar listo:** `pnpm typecheck`, `pnpm test`, `pnpm lint` si existe. Ejecutar curl AC-1, AC-4, AC-6 y pegar output en el reporte. Self-review: ¿el código refleja la SPEC §2? ¿edge cases §4.4 cubiertos? ¿riesgo de regresión en flujo Calvin? Antes de marcar como listo, NO pidas `qodo` (sunset); incluye self-review manual + solicita revisión a GEMINI (`subagent_type='gemini'`) como segunda mano de validación. Reporta con ID `IMPL-20260812-11-01` listando archivos tocados, output de validaciones y capturas de los curl.

### 5.4 Riesgos identificados

| ID | Riesgo | Mitigación |
|---|---|---|
| R-1 | Cambiar la rama `else` de `main.py:1003` puede romper callers que dependían del classifier aún con Gemini sano | Cambio #1 solo aplica cuando default provider != gemini. Si default=gemini, path legacy preservado. AC-4 valida. |
| R-2 | `detected_type="unknown"` puede hacer que el extractor use un prompt equivocado o silencioso | Cambio #3 exige 400 explícito `EXTRACTION_PROMPT_NOT_CONFIGURED`. EC-2 valida con `study_type="Otro"`. |
| R-3 | Convertir `/api/v2/ai/status` a async (Cambio #4) puede alterar contrato | Solo se cambia `key_in_db.*`. NR-2 valida campos previos. |
| R-4 | AppConfigStore caché TTL 60s puede servir default obsoleto tras cambiar AppConfig | `app_config_store.invalidate(EXTRACTION_DEFAULT_PROVIDER_KEY)` ya existe; no es nuevo en este FIX. Documentar en handoff. |
| R-5 | El caller del flujo inicial (`uploadEventTestFile`) puede no tener el EventTest mapeado en `study-ai.ts` → `study_type` None → backend depende del Cambio #1 | Cambio #5 solo añade log; no fuerza `study_type`. Backend cubre. BACKLOG `TKT-20260812-11-01`: ampliar mappings. |

---

## 6. Definición de Done (DoD) para FIX-20260812-11

- [ ] Fase 1 implementada (Cambios #1, #2, #5).
- [ ] AC-1, AC-4, AC-6 verdes con evidencia (output curl pegado en reporte SOFIA).
- [ ] GEMINI auditoría `QA-20260812-11-01` sin bloqueos críticos.
- [ ] No-regresión: `pnpm test` verde, flujo Calvin intacto (diff no toca `calibration.py`).
- [ ] `PROYECTO.md` actualizado vía CRONISTA: mover `FIX-20260812-11` de `IN_PROGRESS` a `VERIFYING` tras Fase 1, a `DONE` tras GEMINI.
- [ ] Fase 2 y Fase 3 pueden quedar en `READY` separado si Frank quiere merge incremental.
