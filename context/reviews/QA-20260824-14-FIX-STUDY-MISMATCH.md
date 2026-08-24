# QA-20260824-14 — FIX-20260824-01 STUDY_TYPE_MISMATCH (addendum cierre G-1)

> `QA-VERDICT`: **PASS_WITH_WARNINGS**

| Campo | Detalle |
|---|---|
| ID tarea | FIX-20260824-01 |
| ID intervención auditada | IMPL-20260824-01-FIX-STUDY-MISMATCH (delta G-1 + catch-all sanitización, sin ampliar alcance) |
| Auditor | GEMINI (V3, gate por incremento — re-auditoría del cierre G-1 de QA-20260824-13) |
| SPEC | `context/SPECs/SPEC-FIX-20260824-01-STUDY-MISMATCH.md` v1.0 |
| Discovery | `DEC-20260824-01`, `FND-20260824-02` |
| QA anterior | QA-20260824-12 (PASS_WITH_WARNINGS; F-1 P2 + F-2..F-5 P3) → QA-20260824-13 (PASS_WITH_WARNINGS; G-1 P2 + G-2 P3) |
| Incremento | Working tree (sin commit). Delta real sobre QA-20260824-13: ventana de negación 6 tokens + stripping de modificadores + catch-all `except Exception` sanitizado en `main.py` |
| Alcance | Reforzada (heurística de negación + boundary HTTP + privacidad + >5 archivos) |

---

## 1. Delimitación y fuentes

Re-auditoría del delta que cierra **G-1 (P2)** de QA-20260824-13 y su extensión al catch-all de `main.py`. Verificado contra el diff real del working tree, no sólo el `IMPL-REPORT_FIX-20260824-01.md`.

**Archivos del delta (modificados):**
- `backend/app/services/ai/study_type_mismatch.py` (nuevo) — detector negación-consciente + `_is_negated_context` (ventana 6 tokens + stripping iterativo) + `sanitize_provider_text_for_log`.
- `backend/app/main.py` — rama `except StudyTypeMismatchError` (F-2/F-3/F-4) + **catch-all `except Exception` G-1** (retorna `error_code` estructurado, NUNCA `str(e)`).
- `backend/app/services/ai/extractor.py` — `_call_with_dispatch` clasifica `ValueError` de M3/Gemini como `StudyTypeMismatchError` sin fallback.
- `backend/tests/test_ai_pipeline.py` — clase `TestFIX20260824_01StudyTypeMismatch` (+41 tests, incl. 7 G-1 detector + 2 G-1 catch-all).
- `frontend/src/actions/ai-prediagnosis.actions.ts` / `event-test.actions.ts` / `components/clinical/PapeletaWorkspace.tsx` / `lib/clinical/study-type-mismatch-note.ts` (nuevo) / `__tests__/study-type-mismatch.test.ts` (nuevo, 13 tests).

**Fuera del incremento (no auditado como cambio):** `*.pyc` deletions, `discovery/DECISIONS.md`/`FINDINGS.md`, `context/Juntas/**`, `context/datos AMI/**`.

---

## 2. Trazabilidad del hallazgo previo (cierre G-1)

| Hallazgo QA-20260824-13 | Verificación independiente | Resultado |
|---|---|---|
| **G-1.A (falso negativo)** — `"This does not appear to be an audiogram. It's a spirometry report."` + `selected=Audiometria` devolvía `is_mismatch=False` (ventana 5 tokens truncaba `"does"`) | Repro ejecutado por GEMINI: `is_mismatch=True, detected=Espirometria`. `_is_negated_context` ahora usa ventana 6 tokens + stripping del artículo `"an"` → match de la frase 5-token `("does","not","appear","to","be")`. Test `test_g1_long_modal_en_does_not_appear_to_be` PASS. | **CERRADO** |
| **G-1.B (falso positivo)** — `"This is not a valid radiograph. It is a valid spirometry report."` + `selected=Espirometria` devolvía `is_mismatch=True, detected=Rayos_X` (el adjetivo `"valid"` rompía la negación) | Repro ejecutado por GEMINI: `is_mismatch=False, detected=None`. Stripping iterativo de `_NEGATION_MODIFIERS` (`valid`) + artículo `a` antes del match. Test `test_g1_modifier_between_article_and_noun` PASS. | **CERRADO** |
| **G-1 catch-all sanitización** — `main.py` (previo line 1490-1492) devolvía `{"error": str(e)}` y podía filtrar el texto crudo del proveedor | Lectura de `main.py:1490-1549`: el catch-all NO retorna `str(e)` ni `provider_text`; `ValueError` con `"no es JSON"`/`"not JSON"` → `EXTRACTION_NOT_JSON`; resto → `EXTRACTION_FAILED`. Ambos con `message` user-friendly y `sanitize_provider_text_for_log` en el log (sólo `len` + `sha256_16`). Tests `test_main_catchall_does_not_leak_raw_str_e` y `test_main_catchall_detects_value_error_no_json` PASS. | **CERRADO** |

**No-regresión de afirmaciones válidas (verificada por GEMINI):**

| Caso | Resultado | Estado |
|---|---|---|
| F-1: `"This is not a radiografía de tórax; es una espirometría válida."` + `Espirometria` | `is_mismatch=False, detected=None` | PASS |
| Inverso: `"…no parece ser una espirometría. Es un audiograma…"` + `Espirometria` | `is_mismatch=True, detected=Audiometria` | PASS |
| Sin refusal: `"This is a valid radiograph."` + `Audiometria` | `is_mismatch=False` | PASS |

---

## 3. Validaciones independientes (reproducidas por GEMINI)

| Gate | Comando | Resultado |
|---|---|---|
| Backend focal FIX-20260824-01 | `python3 -m pytest tests/test_ai_pipeline.py -k "FIX20260824_01StudyTypeMismatch" -q` | **41 passed** |
| Backend shared focal (CB-03 + FIX-20260821-01) | `python3 -m pytest tests/test_ai_pipeline.py -k "FIX20260821_01GateTableawareEspirometria or m3_json_no_parseable" -q` | **13 passed** |
| Backend suite completa | `python3 -m pytest tests/test_ai_pipeline.py -q` | **136 passed / 31 failed** — los 31 son `M3CredentialsUnavailableError`/`ExtractionAuthError(reason="credentials_unavailable")` (sin `M3_API_KEY` en test env), idénticos a baseline declarado y confirmado por inspección del traceback. Sin regresiones del delta. |
| Reproducción independiente detector | `python3 -` invocando `detect_study_type_mismatch` con los 2 repros exactos de QA-13 + 3 casos de no-regresión | **5/5 correctos** (ver §2) |
| Frontend vitest focal | `npx vitest run src/actions/__tests__/study-type-mismatch.test.ts` | **13 passed** |
| Typecheck | `npx tsc --noEmit` | **exit 0** |
| Build | `npx next build` | **exit 0** (Compiled successfully) |

No se ejecutó `git stash` ni mutación del árbol. E2E Playwright productivo NO ejecutado (conforme a instrucción; sin `M3_API_KEY`).

---

## 4. Hallazgos priorizados

### P3-1 (Baja) — `triggerStudyAIAnalysis` re-lee el body ya consumido en la ruta no-OK no-mismatch

- **Evidencia:** `frontend/src/actions/ai-prediagnosis.actions.ts` (bloque `if (!response.ok)`). El nuevo try consume el body con `await response.text()` para detectar `STUDY_TYPE_MISMATCH`; si NO es mismatch, la línea siguiente (`const errText = await response.text().catch(() => 'Sin detalle')`) vuelve a leer un body ya consumido, obteniendo cadena vacía (o el fallback `'Sin detalle'`).
- **Impacto:** en errores HTTP no-OK no-mismatch (400/500 del backend), el detalle de `Backend V2 respondió <status>: <texto>` pierde el cuerpo del error. Degradación diagnóstica, sin fuga de datos (no expone más, expone menos detalle). No rompe el flujo de mismatch.
- **Reproducción:** respuesta `response.ok === false` con body JSON `{status:'error', error:'...'}` cuyo `error_code` no es mismatch → el campo `error` del result queda sin el detalle real.
- **Owner:** SOFIA (`IMPLEMENTATION_DEFECT`, misma SPEC) — opcional.
- **Condición de cierre:** cachear `errText` en una variable fuera del try y reutilizarla (o leer `errBody` ya parseado), evitando la segunda lectura del body.

### P3-2 (Baja, persistente) — `resultNotes` usa canónicos sin tilde/espacio (G-2 de QA-13)

- **Evidencia:** `buildMismatchResultNote` compone el texto desde `selectedStudyType`/`detectedStudyType` canónicos (`Audiometria`, `Espirometria`, `Rayos_X`), divergiendo del `message`/banner con tildes (F-5). El builder ignora `message` y no recibe texto crudo del proveedor.
- **Impacto:** presentacional en el histórico persistido; sin fuga de PII/prompt. No bloquea.
- **Owner:** SOFIA/ATLAS (opcional, 1 función).

### P3-3 (Baja, rigor de evidencia) — Los tests del catch-all de `main.py` son estáticos (regex sobre source), no de runtime

- **Evidencia:** `test_main_catchall_does_not_leak_raw_str_e` y `test_main_catchall_detects_value_error_no_json` validan por `re` sobre el texto de `main.py`, no invocando el endpoint ni simulando la excepción.
- **Impacto:** la sanitización del catch-all está correctamente implementada (verificada por lectura directa de `main.py:1490-1549`), pero su evidencia es de tipo "guarda estática", más débil que un test de comportamiento. No hay defecto funcional detectado.
- **Owner:** SOFIA (opcional, mejora de test).
- **Condición de cierre:** levantar el handler sin servidor (extraer la lógica a un helper testeable) o un test que ejercite el `except Exception` con `ValueError("…no es JSON…")` verificando el dict retornado.

---

## 5. Riesgo operativo

- **Reversión:** 100 % código, sin migración/schema; cambios son delta no destructivo (suma `error_code`/`message` opcionales). Revertir restaura el FND-20260824-02.
- **Sin P0/P1 abiertos.** G-1 (P2) cerrado.
- **Snapshots inmutables:** el fix sólo aplica a corridas nuevas; uploads previos no se regeneran sin autorización.
- **Riesgo residual de falso negativo/positivo (heurística):** acotado. La lista `_NEGATION_PHRASES`/`_NEGATION_MODIFIERS` es conservadora y extensible; frases no cubiertas (p.ej. cadenas de ≥3 modificadores) caen a comportamiento conservador con cap de 3 iteraciones (`test_g1_max_three_iterations_protect_false_negatives`). Monitoreado, no bloqueante.

---

## 6. Preparación por entorno

| Entorno | Estado |
|---|---|
| Calidad (typecheck/lint/unit/build) | **LISTO** — tsc exit 0, build exit 0, focales verde, suite sin regresiones nuevas. |
| Staging | **NO_EVALUADO** — sin entorno autorizado ni `M3_API_KEY`; el path `STUDY_TYPE_MISMATCH` no puede dispararse contra build real. |
| Producción | **NO_LISTO (condicionado)** — G-1 cerrado, pero el gate V3 exige E2E Playwright real (`M3_API_KEY` + expediente desechable + `ESPIROMETRIA.pdf` sobre `Audiometria` verificando el banner accionable) y OK explícito de Frank para commit/push/deploy. No ejecutado aquí. |

---

## 7. Handoff a ATLAS

- **Veredicto GEMINI:** `PASS_WITH_WARNINGS`. G-1 (P2, falso negativo + falso positivo residual) y la sanitización del catch-all quedan **CERRADOS** con evidencia independiente. No quedan hallazgos bloqueantes; sólo P3 (P3-1 degradación diagnóstica menor, P3-2 cosmético persistente, P3-3 rigor de test opcional).

- **Acción concreta:**
  1. Rutear opcionalmente **P3-1** a SOFIA como `IMPLEMENTATION_DEFECT` (misma SPEC): cachear el body en la ruta no-OK no-mismatch de `triggerStudyAIAnalysis`. No bloquea el cierre.
  2. **Producción** queda condicionada únicamente al E2E Playwright real (V3 gate) y al **OK explícito de Frank** para commit/push/deploy — no al cierre de los P3.
  3. P3-2 y P3-3 pueden aceptarse tal cual o postergarse.

- **No requiere DEBY:** G-1 fue `IMPLEMENTATION_DEFECT` dentro del SPEC; la causa raíz funcional ya está diagnosticada (FND-20260824-02 / DEC-20260824-01).

---

## 8. Autoauditoría (GEMINI)

- Incremento delimitado por diff real del working tree (base=HEAD, cabeza=working tree); SPEC/DEC/FND vigentes leídos.
- Evidencia independiente ejecutada (§2 + §3), no sólo el reporte de SOFIA.
- No se editó código/tests/config/`discovery/`/SPEC/`PROYECTO.md`; no se imprimieron secretos ni PII.
- Cada hallazgo con evidencia/impacto/condición de cierre; severidad QA (P3) separada de niveles L1/L2/L3.
- Separación QA/staging/producción explícita (§6).
- No se invocaron subagentes; no se declaró `DONE`; no se movió estado global.
- No se ejecutó E2E productivo ni se subieron datos (conforme a instrucción).
- El handoff vuelve a ATLAS con acción concreta y gate siguiente.