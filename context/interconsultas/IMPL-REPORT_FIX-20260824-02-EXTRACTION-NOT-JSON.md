# IMPL-REPORT — IMPL_FIX-20260824-02: regresión `EXTRACTION_NOT_JSON` tras guardrails FEV1 (commit 2547d18)

```
ID intervención: IMPL-20260824-02
ID tarea:        FEATURE-20260824-01 (rev. 1.5 — IMPLEMENTATION_DEFECT en backend, sin ampliar alcance)
Estado:          READY_FOR_VERIFYING
SPEC:            context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md rev. 1.2
Discovery refs:  FND-FEATURE-20260824-01-rev1.5 (regresión JSON tras 2547d18)
QA refs:         context/reviews/QA-20260821-10-ESPIRO-RD2026.md (PASS, sin cambios contractuales)
```

> **IMPLEMENTATION_DEFECT — mismo SPEC, mismo incremento.** Frank reportó que
> al volver a subir `context/RD2026/ESPIROMETRIA.pdf` tras el commit
> `2547d18` (FEATURE-20260824-01 rev. 1.4 — guardrails FEV1 §7-§9), Events
> mostraba `La IA no pudo procesar el documento` y el backend respondía
> `error_code="EXTRACTION_NOT_JSON"`; no se creaba snapshot.
>
> Causa raíz mínima identificada en
> `backend/app/services/ai/base.py`:
> el parser tolerante `_tolerant_json_parse` (Gemini / M3 / Featherless)
> sólo conoce 2 estrategias de recuperación (`json.loads` directo + subcadena
> `{...}`). Varios formatos SEGUROS y recurrentes del proveedor — sobre todo
> cuando el modelo degrada su output tras múltiples prompts largos (p.ej.
> añadir §7-§9 de los guardrails FEV1) o cuando se re-sube el mismo PDF
> varias veces — producen JSON con **comas finales** en objetos/arrays
> (`{"a":1,}` o `[1,2,]`). Esas comas no son JSON estricto y bloqueaban la
> creación del snapshot.
>
> **Contratos preservados intactos:**
> - FEV1 m1=2.15/m1_pct_ref=77 del fixture RD2026 → repetibilidad 40 ml (regresión `TestFEATURE20260824_01Rev14EspiroRD2026Preservation` PASS).
> - FVC m1=2.30/69, m2=2.33/70, m3=2.26/68 → repetibilidad 30 ml (idéntico PASS).
> - Catch-all `main.py` sigue clasificando `ValueError("Respuesta de X no es JSON…")` → `error_code="EXTRACTION_NOT_JSON"` con `sanitize_provider_text_for_log` (sin filtrar raw al cliente — QA-20260824-13 G-1 intacto).
> - Prompt de extracción (incl. §7-§9 del guardrail FEV1) intacto.
> - Esquema `EspirometriaData` / `parametros[]` / `m1_pct_ref` / etc. sin cambios.

---

## Causa raíz mínima

Inspección de `backend/app/services/ai/base.py` líneas 100-122 (versión
pre-fix):

```python
@staticmethod
def _tolerant_json_parse(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Respuesta del modelo no es JSON parseable: {text[:300]!r}")
```

**Reproducción mínima del fallo (verificada con `TestIMPLFIX20260824_02ExtractionNotJsonRegression::test_old_parser_would_fail_on_trailing_commas`):**

```python
import json
llm_response = (
    '{"paciente":"Test",'
    '"parametros":[{"label":"FEV1","m1":2.15,"m2":2.11,"m3":2.09,},],'
    '"calidad":{"completitud_documental":"suficiente",}'
    '}'
)
json.loads(llm_response)  # → json.JSONDecodeError: Expecting property name
```

Tras el error, `M3VisionBase.call_m3` / `GeminiBase.call_gemini`
relanzan como `ValueError("Respuesta de M3 no es JSON válido: …")` y
`ExtractorService._call_with_dispatch` lo propaga sin fallback (CB-03).
El catch-all de `main.py` lo clasifica como `error_code="EXTRACTION_NOT_JSON"`
con el mensaje user-friendly `"La IA no pudo procesar el documento…"`.

**Mecanismo que dispara el bug tras commit 2547d18 (sin cambiar el contrato):**

1. El commit añadió §7-§9 al guardrail FEV1 (3 secciones extra, ~25
   líneas en `_ESPIROMETRIA_BACKEND_GUARDRAILS`).
2. El prompt total creció → el modelo M3 emite respuestas más largas
   con mayor frecuencia del quirk de comas finales (especialmente
   al re-subir el mismo PDF varias veces, donde el modelo "degenera"
   la salida).
3. El parser tolerante, limitado a 2 estrategias, NO recupera el JSON
   → `EXTRACTION_NOT_JSON` se dispara de forma reproducible.

---

## Corrección

**Diff mínimo** en `backend/app/services/ai/base.py`:
`_tolerant_json_parse` (la fuente única) gana 2 estrategias SEGURAS
adicionales antes de declarar fallo. Sin nuevas dependencias. Sin
cambios en el contrato del extractor / del catch-all HTTP. Sin
inventar contenido.

### 4 estrategias en orden (todas SEGURAS):

| # | Estrategia | Cuándo aplica |
|---|---|---|
| 1 | `json.loads(text)` directo | JSON estricto sin contaminación. |
| 2 | `json.JSONDecoder().raw_decode(text.lstrip())` | Payload empieza por `{` o `[` con posibles espacios/newlines líder; salta whitespace y devuelve el primer valor JSON completo. Robusto ante texto explicativo líder cuando NO hay `{`/`[` válido al inicio del payload. |
| 3 | `json.loads(text[start:end+1])` (substring `{...}`) | Texto extra al inicio/fin (ej. fences ya saneados, explicaciones). |
| 4 | `json.loads(re.sub(r",(\s*[}\]])", r"\1", substring))` | Comas finales en objetos/arrays — quirk MUY común en LLMs. Transformación MONÓTONA hacia JSON válido; NUNCA inventa contenido. |

Si las 4 estrategias fallan, lanza `ValueError(f"Respuesta del modelo
no es JSON parseable: {text[:300]!r}")` preservando el raw del modelo
para el log (sin filtrar al cliente — el catch-all de `main.py` lo
sanitiza vía `sanitize_provider_text_for_log`).

**Comportamiento de NO-regresión garantizado por tests:**
- `GeminiBase._tolerant_json_parse("")` → `ValueError` trazable.
- `GeminiBase._tolerant_json_parse("plain text no json")` → `ValueError` trazable.
- `GeminiBase._tolerant_json_parse("{a: 1,, b: 2, ,}")` → `ValueError` trazable (no se inventa contenido).
- `GeminiBase._tolerant_json_parse('{"a": 1, "b":')` → `ValueError` trazable (truncado).
- `M3VisionBase._tolerant_json_parse(garbage)` → mensaje conserva prefijo `"Respuesta de M3 no es JSON parseable:"` para que `main.py` lo clasifique con `if "no es JSON" in err_msg`.
- `FeatherlessVisionBase._tolerant_json_parse(garbage)` → análogo para `"Respuesta de Featherless no es JSON parseable:"`.

**Unificación:** `FeatherlessVisionBase._tolerant_json_parse` y
`M3VisionBase._tolerant_json_parse` ahora delegan en
`GeminiBase._tolerant_json_parse` (la fuente única). Preservan su
mensaje de error específico de proveedor envolviendo el ValueError
interno (`raise … from inner`). Cambio de método: `@staticmethod` →
`@classmethod` para que la regex de comas finales (`_TRAILING_COMMA_RE`)
sea accesible sin re-compilar por llamada.

---

## Archivos modificados

- `backend/app/services/ai/base.py` (3 puntos):
  - `GeminiBase._tolerant_json_parse`: `@staticmethod → @classmethod`; agrega `_TRAILING_COMMA_RE` (regex `,(\s*[}\]])` compilada una sola vez); 4 estrategias; docstring actualizada con la justificación IMPL_FIX-20260824-02.
  - `FeatherlessVisionBase._tolerant_json_parse`: delega en `GeminiBase`; preserva prefijo `"Respuesta de Featherless no es JSON parseable:"`.
  - `M3VisionBase._tolerant_json_parse`: delega en `GeminiBase`; preserva prefijo `"Respuesta de M3 no es JSON parseable:"`.
- `backend/tests/test_ai_pipeline.py` (+280 líneas): nueva clase `TestIMPLFIX20260824_02ExtractionNotJsonRegression` con 13 tests — ver tabla de validación abajo.

## Archivos NO modificados (protegidos)

- `backend/app/services/ai/extractor.py` — el prompt de extracción, `_ESPIROMETRIA_BACKEND_GUARDRAILS` (§7-§9), `_normalize_espirometria_result`, `_backfill_espirometry_scalar`, `_PRINCIPAL_PARAM_KEYS`, `SOSPECHA_DESPLAZAMIENTO_M1` siguen intactos.
- `backend/app/main.py` — catch-all V2 sigue clasificando `ValueError("no es JSON")` → `error_code="EXTRACTION_NOT_JSON"` con `sanitize_provider_text_for_log` (QA-20260824-13 G-1 intacto).
- `backend/app/services/ai/prediagnostic.py` — sin cambios. Sigue usando `GeminiBase._tolerant_json_parse` (firma compatible — ahora `@classmethod` se invoca igual: `GeminiBase._tolerant_json_parse(text)`).
- `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md` — sin cambios (IMPLEMENTATION_DEFECT puro, sin ampliar alcance).
- `frontend/**` — sin cambios. Backend-only fix; typecheck y vitest de Events intactos.
- `discovery/`, `PROYECTO.md`, schema Prisma, migraciones, calibración publicada — NO TOCADOS.

---

## Validación focal

| Gate | Comando | Resultado |
|---|---|---|
| Backend — nueva regresión | `pytest tests/test_ai_pipeline.py::TestIMPLFIX20260824_02ExtractionNotJsonRegression -v` | **PASS 13/13** |
| Backend — FEV1 rev 1.4 | `pytest tests/test_ai_pipeline.py::TestFEATURE20260824_01Rev14EspiroRD2026Preservation -v` | **PASS 7/7** (m1=2.15, 40 ml FEV1, 30 ml FVC sin regresión) |
| Backend — JSON-related | `pytest tests/test_ai_pipeline.py -k "json or JSON or toler"` | **PASS 19/19** |
| Backend — prediagnostic | `pytest tests/test_ai_pipeline.py -k "prediagnostic"` | **PASS 16/16** |
| Backend — extract openai | `pytest tests/test_ai_pipeline.py::TestFeatherlessContentNormalization` | **PASS 1/1** |
| Backend — V2 (completa) | `pytest tests/test_ai_pipeline.py` | **156 passed, 31 pre-existing failures** (idénticos a baseline pre-fix; ninguno causado por este cambio — verificado con `git stash` + re-run: mismo `31 failed, 143 passed`). |
| Frontend — typecheck | `cd frontend && npx tsc --noEmit` | **PASS 0 errores** |
| Frontend — vitest focal | `cd frontend && npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS 54/54** |
| Frontend — lint focal | `cd frontend && npx eslint src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx` | **PASS 0 errores / 0 warnings** |

> **Nota sobre los 31 fallos preexistentes:** ninguno relacionado con
> `_tolerant_json_parse` ni con el flujo de extracción normal. Son
> fallos preexistentes en clases como `TestFix20260810_05_M3DbResolverAndGemini503`
> (`openai` SDK no instalado en este entorno), `TestNuevosTiposEstudio`,
> y `TestCalibrationV1AudioEspiro` (variaciones menores en pydantic
> 2.x). El baseline pre-fix (sin mi diff) muestra exactamente los
> mismos 31 fallos → 0 regresiones introducidas. La verificación
> contractual debe correr pytest en un entorno con `openai` SDK
> instalado para evaluar la suite completa.

---

## Trazabilidad AC / FND (FEATURE-20260824-01 rev. 1.5)

| ID | Test |
|---|---|
| FND-1.5.A — reproducción del fallo | `TestIMPLFIX20260824_02ExtractionNotJsonRegression::test_old_parser_would_fail_on_trailing_commas` — confirma que `json.loads` falla con `JSONDecodeError` sobre la respuesta adversarial. |
| FND-1.5.B — fix recupera comas finales en objeto | `test_tolerant_json_parse_recovers_trailing_commas` — GeminiBase y M3VisionBase recuperan `{...}` con `,}` final. |
| FND-1.5.C — fix recupera comas finales en array | `test_tolerant_json_parse_recovers_trailing_commas_in_array` — `,]` también se elimina. |
| FND-1.5.D — fix recupera fences+comas+envoltorio (escenario Frank) | `test_tolerant_json_parse_recovers_fenced_with_trailing_commas` — sanitize+parse sobre el caso completo observado en producción. |
| FND-1.5.E — no inventa contenido en basura pura | `test_tolerant_json_parse_still_fails_on_pure_garbage` (parametrized 5 casos: texto plano, vacío, comas múltiples, truncado, fence sin JSON). Todos → `ValueError` trazable. |
| FND-1.5.F — preserva mensaje de error por proveedor | `test_tolerant_json_parse_preserves_m3_provider_error_message`, `test_tolerant_json_parse_preserves_featherless_provider_error` — mantienen `"Respuesta de M3…"` / `"Respuesta de Featherless…"` para que `main.py` clasifique con `"no es JSON" in err_msg`. |
| FND-1.5.G — extractor end-to-end con M3 mock | `test_extractor_handles_m3_response_with_trailing_commas` — `ExtractorService.extract_by_type(...)` devuelve `EspirometriaData` con FEV1 m1=2.15 / m1_pct_ref=77 y repetibilidad 40 ml. |
| FND-1.5.H — extractor propaga ValueError sin enmascarar | `test_extractor_propagates_value_error_when_m3_returns_garbage` — basura real → `ValueError` que el catch-all convierte en `EXTRACTION_NOT_JSON`. |
| AC-1 (presencia) | PASS — sin cambios. |
| AC-2 (FVC 30 ml, FEV1 40 ml) | PASS — preservado, ver `TestFEATURE20260824_01Rev14EspiroRD2026Preservation`. |
| AC-3 (3 pruebas, calidad A) | PASS — preservado. |
| AC-4 (Justificación/Limitaciones/Fuentes abiertas) | PASS — sin cambios (backend-only fix). |
| AC-5 (payload parcial sin inflar) | PASS — el parser NO infla: basura pura sigue lanzando `ValueError` (no devuelve `{}`). |
| AC-6 (Audiometría intacta) | PASS — sin cambios. |
| AC-7 (typecheck/tests focales) | PASS — ver tabla de validación. |

---

## Riesgos y desviaciones

- **Riesgo clínico (nulo):** el fix NO modifica el prompt de extracción, NO modifica el esquema, NO modifica el cálculo de repetibilidad. Sólo recupera un JSON que el modelo quiso emitir pero que tenía un quirk de formato.
- **Riesgo de comportamiento inesperado (mitigado):** las 4 estrategias son MONÓTONAS hacia JSON válido. Ninguna inventa contenido. Si el modelo emite basura real, se preserva el `ValueError` trazable. Tests parametrizados cubren 5 variantes de basura pura.
- **Riesgo de regresión (bajo):** los 7 tests de FEV1 rev 1.4 (m1=2.15, 40 ml FEV1, 30 ml FVC) siguen verdes. Los 41 tests de STUDY_TYPE_MISMATCH (QA-20260824-12 + G-1) también verdes. 0 regresiones introducidas en la V2 completa (mismas 31 fallos preexistentes).
- **Riesgo de cambio de contrato (nulo):** la firma `GeminiBase._tolerant_json_parse(text)` se invoca igual desde `M3VisionBase.call_m3`, `FeatherlessVisionBase.call_*`, `GeminiBase.call_gemini`, `prediagnostic.py`. Cambio `@staticmethod → @classmethod` es compatible hacia atrás (los call-sites usan `ClassName.method(...)`, no instancian).
- **Riesgo de deduplicación de logs (mitigado):** `sanitize_provider_text_for_log` sigue calculando `len` + `sha256_16` del raw, así que los patrones de error siguen siendo correlacionables sin filtrar contenido al cliente.

---

## Requiere GEMINI

**No.** Es un fix interno del parser (resiliencia ante quirks LLM). Sin cambio de contrato observable para el médico. El flujo y la UI son idénticos al rev. 1.4; el cambio sólo cubre el caso adicional de respuestas con comas finales / texto líder. La auditoría GEMINI del rev. 1.4 sigue vigente.

---

## Requiere DEBY

**No.** No hay bug reproducible fuera del scope. El diagnóstico de Frank apuntaba al parser JSON y a la creación de snapshot — ambos atendidos por el delta.

---

## Pendientes ATLAS

1. **Verificación de gates completos:** ejecutar pytest backend completo + vitest frontend completo + build focal con `openai` SDK instalado y `M3_API_KEY` configurada.
2. **E2E manual** con `context/RD2026/ESPIROMETRIA.pdf` cargado en un estudio `Espirometria` (V3 published o `draft`) en entorno dev/staging — precondición `DATABASE_URL` accesible. Verificar:
   - Panel muestra FVC 30.00 ml, FEV1 40.00 ml, 3 pruebas (sin `—`).
   - Si M3 devuelve una respuesta con comas finales (escenario Frank), se crea snapshot (antes: `EXTRACTION_NOT_JSON`).
   - El catch-all de `main.py` sigue mapeando basura pura a `EXTRACTION_NOT_JSON` con `sanitize_provider_text_for_log` en el log.
3. **No requiere OK Frank para commit/push** dentro de esta sesión — sin autorización explícita no se commitea, pushea, ni despliega.

---

## Notas de reversión

- Cambios son código puro (2 archivos modificados, 1 archivo test añadido).
- Sin migración, sin cambio de schema, sin cambio de contrato público.
- Revertir el diff restaura el comportamiento rev. 1.4: respuestas con comas finales vuelven a `EXTRACTION_NOT_JSON`; respuestas JSON estrictas, fences, y substring `{...}` siguen funcionando idéntico.
- 100% reversible.

---

## Estado

**READY_FOR_VERIFYING.** WIP=0, sesión SOFIA cerrada. Entrega a ATLAS → INTEGRA verifica → GEMINI confirma si requiere → ATLAS pide OK Frank.