# QA-20260824-13 — FIX-20260824-01 STUDY_TYPE_MISMATCH (addendum re-auditoría F-1 + P3)

> `QA-VERDICT`: **PASS_WITH_WARNINGS**

| Campo | Detalle |
|---|---|
| ID tarea | FIX-20260824-01 |
| ID intervención auditada | IMPL-20260824-01-FIX-STUDY-MISMATCH (delta F-1 + P3 alignment) |
| Auditor | GEMINI (V3, gate por incremento — re-auditoría del cierre F-1/P3) |
| SPEC | `context/SPECs/SPEC-FIX-20260824-01-STUDY-MISMATCH.md` v1.0 |
| Discovery | `DEC-20260824-01`, `FND-20260824-02` |
| QA anterior | `context/reviews/QA-20260824-12-FIX-STUDY-MISMATCH.md` (PASS_WITH_WARNINGS; F-1 P2, F-2..F-5 P3) |
| Incremento | Working tree (sin commit). Delta real sobre QA-20260824-12: detector negación-consciente + contrato `message` + validación canónica + log sanitizado + tests |
| Alcance | Reforzada (delta de contrato API + heurística de negación + privacidad F-4 + >5 archivos) |

---

## 1. Delimitación y fuentes

Re-auditoría del delta final que cierra F-1 (P2) y alinea F-2/F-3/F-4/F-5 (P3) de QA-20260824-12, dentro del mismo SPEC. No se amplía alcance.

**Fuente de verdad:** diff real del working tree (`git diff`) + archivos no trackeados, no sólo el `IMPL-REPORT_FIX-20260824-01.md`. SPEC/DEC/FND leídos de `context/SPECs/` y `discovery/`.

**Archivos del delta (modificados):**
- `backend/app/services/ai/extractor.py` — `_call_with_dispatch` acepta `selected_study_type`; clasifica `ValueError` de M3/Gemini como `StudyTypeMismatchError` (sin fallback); `extract_by_type` stash `last_extraction_audit` con `mismatch_provider_text`.
- `backend/app/main.py` — rama `except StudyTypeMismatchError`; response con `error`/`message`/`error_code`/`selected_study_type`/`detected_study_type`/`file`; validación canónica F-3; log sanitizado F-4.
- `backend/tests/test_ai_pipeline.py` — clase `TestFIX20260824_01StudyTypeMismatch` ampliada a +32 tests.
- `frontend/src/actions/ai-prediagnosis.actions.ts` — `StudyAIAnalysisResult` + 4 campos; parsing en rutas OK y no-OK.
- `frontend/src/actions/event-test.actions.ts` — rama `STUDY_TYPE_MISMATCH` en upload y regenerate.
- `frontend/src/components/clinical/PapeletaWorkspace.tsx` — `MismatchMessageBanner` + estados `uploadMismatch`/`regenMismatch`.

**Archivos del delta (nuevos):**
- `backend/app/services/ai/study_type_mismatch.py` — detector negación-consciente + `sanitize_provider_text_for_log` + `build_user_facing_message` con tildes.
- `frontend/src/lib/clinical/study-type-mismatch-note.ts` — `buildMismatchResultNote`.
- `frontend/src/actions/__tests__/study-type-mismatch.test.ts` — 13 tests vitest.

**Fuera del incremento (contexto, no auditado como cambio):** deletions `*.pyc`, `discovery/DECISIONS.md`/`FINDINGS.md`, `context/Juntas/**`, untracked `context/datos AMI/**`, `context/compact-saves/**`, `.deby-scratch/`, `.tmp-vitest/`.

---

## 2. Trazabilidad de los hallazgos previos (cierre)

| Hallazgo QA-20260824-12 | Verificación independiente | Resultado |
|---|---|---|
| **F-1 (P2)** detector no distinguía negación; fixture AC-2 semánticamente incorrecto | `detect_study_type_mismatch` ahora clasifica menciones `affirmed`/`negated` contra `_NEGATION_PHRASES` ES+EN (~50 frases, ventana 5 tokens + manejo de artículo). Reproducción exacta del QA devuelve `is_mismatch=False`. Fixture AC-2 corregido a contenido naturalmente Audio ("no parece ser una espirometría… es un audiograma…"). 10 casos independientes ES/EN → todos correctos. | **CERRADO (con hallazgo residual G-1)** |
| **F-2 (P3)** `message` ausente del response | `main.py` retorna `"message": _user_message` (además de `error` retrocompat). Test `test_main_endpoint_response_shape_for_mismatch` + lectura del diff confirman los 5 campos. Frontend propaga `message`. | **CERRADO** |
| **F-3 (P3)** `study_type` reflejado sin validación | `main.py` valida `_detected` y `_selected` contra `CANONICAL_STUDY_TYPES` (`if X is not None and X not in _CANON: X = None`) antes de serializar. | **CERRADO** |
| **F-4 (P3)** `print(provider_text)` crudo en log | Log emite sólo `provider_len` + `provider_sha256_16` vía `sanitize_provider_text_for_log` (sin contenido). Grep confirma ausencia de `provider_text` en el dict de respuesta y en el log. | **CERRADO** |
| **F-5 (P3, cosmético)** copy sin tildes | `build_user_facing_message` usa `_DISPLAY_NAME` con tildes (`Audiometría`, `Espirometría`, `Campimetría`, `Rayos X`, `Riesgo Cardiovascular`). Test `test_build_user_facing_message_tildes_all_types` PASS. | **CERRADO** |

---

## 3. Validaciones independientes (reproducidas por GEMINI)

| Gate | Comando | Resultado |
|---|---|---|
| Backend focal FIX-20260824-01 | `python3 -m pytest tests/test_ai_pipeline.py -k "FIX20260824_01StudyTypeMismatch" -q` | **32 passed** |
| Backend shared focal (CB-03 + FIX-20260821-01) | `python3 -m pytest tests/test_ai_pipeline.py -k "FIX20260821_01GateTableawareEspirometria or m3_json_no_parseable" -q` | **13 passed** |
| Backend suite completa | `python3 -m pytest tests/test_ai_pipeline.py -q` | **127 passed / 31 failed** — los 31 son `M3_CREDENTIALS_UNAVAILABLE`/`ExtractionAuthError` (credenciales M3 ausentes en test env), idénticos a baseline declarado. Sin regresiones del delta. |
| Frontend vitest focal | `npx vitest run src/actions/__tests__/study-type-mismatch.test.ts` | **13 passed** |
| Typecheck | `npx tsc --noEmit` | **exit 0** |
| Build | `npx next build` | **exit 0** (Compiled successfully) |
| Reproducción independiente detector | `python3 -` invocando `detect_study_type_mismatch` con 10 fixtures ES/EN + inverso corregido | **10/10 correctos** (ver §4 G-1 para 2 casos adversativos que fallan) |

No se ejecutó `git stash` antes/después (GEMINI no muta el árbol); baseline contrastada por tipo de error de credenciales, coincidente con lo declarado.

---

## 4. Hallazgos priorizados

### G-1 (P2, Media) — La ventana de negación trunca frases modales EN no contraídas y tolerancia a adverbios/adjetivos: falso negativo (re-surge el error crudo) y falso positivo residual

- **Evidencia (reproducción independiente real):**
  - `"This does not appear to be an audiogram. It's a spirometry report."` con `selected=Audiometria` → `is_mismatch=False` (falso negativo). Esperado: `True, detected=Espirometria`. Causa: la frase `("does","not","appear","to","be")` mide 5 tokens, pero la ventana `last_tokens[-5:]` descarta `"does"` (queda `["not","appear","to","be","an"]`) y el fallback de artículo (`without_article`) sólo alcanza 4 tokens → la mención queda **afirmada**.
  - `"This is not a valid radiograph. It is a valid spirometry report."` con `selected=Espirometria` → `is_mismatch=True, detected=Rayos_X` (falso positivo). Causa: el adjetivo `"valid"` se interpone entre `"not a"` y `"radiograph"`; `_is_negated_context` no lo reconoce como modificador → `Rayos_X` queda **afirmado** y gana el `detected`.
- **Impacto:**
  - Falso negativo → el rechazo del proveedor no se clasifica como mismatch → `extractor.py` re-lanza el `ValueError` original → `main.py:1490-1492` (`except Exception`) devuelve `{"error": str(e)}` con el texto `"Respuesta de M3 no es JSON válido: <raw>…"`. Es el vector de disclosure de FND-20260824-02 (el `raw` puede contener prompt/PII) re-surgiendo para rechazos en inglés con verbo modal no contraído.
  - Falso positivo → operador que cargó el estudio correcto recibe "el documento parece ser <tipo equivocado>".
- **Frecuencia/contexto:** el sistema es hispanohablante (prompts clínicos ES, caso reportado FND en ES) y todos los patrones ES reportados pasan. Los casos que fallan son inglés (`does not appear to be`, adverbios/adjetivos interpuestos). Riesgo acotado pero real (M3 es multilingüe y puede responder en inglés).
- **Owner recomendado:** SOFIA (`IMPLEMENTATION_DEFECT`, misma SPEC). ATLAS decide pivote.
- **Condición de cierre:** ampliar la ventana de `_is_negated_context` (≥6 tokens) y/o saltar modificadores (adverbios/adjetivos: `actually`, `really`, `valid`, `mere`, `simple`) entre la frase de negación y el sustantivo; añadir tests de no-regresión para `"does not appear to be an X"`, `"This is not actually an X"` y `"not a valid X"`. Re-ejecutar `pytest -k FIX20260824_01StudyTypeMismatch` + vitest focal.

### G-2 (P3, Baja/Cosmética) — `resultNotes` persistido usa canónicos sin tilde/espacio, divergente del `message` user-facing

- **Evidencia:** `buildMismatchResultNote` compone `resultNotes` desde `selectedStudyType`/`detectedStudyType` canónicos (`Audiometria`, `Espirometria`, `Rayos_X`, `RiesgoCardiovascular`), mientras el `message`/banner usa tíldes/espacios (F-5). No hay fuga de `provider_text` (el builder ignora `message` y no recibe texto crudo).
- **Impacto:** puramente presentacional en el histórico persistido; no afecta seguridad ni al banner. No bloquea.
- **Owner:** SOFIA/ATLAS (opcional, 1 función).

---

## 5. Verificación específica solicitada

| Ítem solicitado | Resultado |
|---|---|
| Negaciones ES/EN correctas | **PASS** para los patrones reportados y 10 casos independientes ES/EN; **G-1** documenta el residuo de ventana/tolerancia (EN no contraído + interposición). |
| Fixture inverso AC-2 correcto | **PASS** — `"Lo siento… no parece ser una espirometría. Es un audiograma con umbrales 500/1000/2000 Hz."` con `selected=Espirometria` → `detected=Audiometria`. |
| `message` en response | **PASS** — presente como contrato explícito, poblado con mensaje redactado. |
| Canónicos validados | **PASS** — `selected`/`detected` validados contra `CANONICAL_STUDY_TYPES` antes de serializar; no-canónico → `null`. |
| Ausencia absoluta de `provider_text` crudo en logs/UI/resultNotes | **PASS (con nota)** — log emite `provider_len`+`provider_sha256_16`; response no lo incluye; UI sin referencia; `buildMismatchResultNote` no recibe texto crudo. **Nota no bloqueante:** `extractor.last_extraction_audit["mismatch_provider_text"]` retiene el raw en memoria del servicio (atributo, no serializado ni logueado; se sobrescribe en la siguiente extracción). Fuera del alcance de F-4 (logs/UI/resultNotes), sin exposición verificada. |
| Regresiones | **PASS** — 127 passed / 31 fallos preexistentes por credenciales M3; shared focal 13 passed; extracción válida Audio/Espiro intacta (AC-5.1/5.2). |
| Build | **PASS** — `tsc` exit 0, `next build` exit 0. |

**E2E Playwright real (V3):** **NO EJECUTADO** — sin `M3_API_KEY` en entorno, sin servidor autorizado, y FND-20260824-01 documenta que E2E previo contaminó expediente de producción. Precondiciones para considerarlo PASS: `M3_API_KEY` real, V3 published, expediente desechable, `ESPIROMETRIA.pdf` sobre `Audiometria`, y verificación del banner accionable (nunca `Respuesta de M3 no es JSON válido`), con assertion + accessibility snapshot + consola + requests fallidos.

---

## 6. Riesgo operativo

- **Reversión:** 100 % código, sin migración/schema; response V2 suma `error_code` + campos opcionales (delta no destructivo). Revertir restaura FND-20260824-02.
- **G-1 falso negativo:** re-surge el disclosure del texto crudo del proveedor por la vía `main.py:1490-1492` para rechazos EN modales no contraídos. Es la principal razón de producción NO_LISTO.
- **Snapshots inmutables:** el fix sólo aplica a corridas nuevas; uploads previos no se regeneran sin autorización.
- **Sin P0/P1 abiertos.**

---

## 7. Preparación por entorno

| Entorno | Estado |
|---|---|
| Calidad (typecheck/lint/unit/build) | **LISTO** |
| Staging | **NO_EVALUADO** — sin entorno autorizado ni `M3_API_KEY`; no se puede disparar el path `STUDY_TYPE_MISMATCH`. |
| Producción | **NO_LISTO** — requiere cerrar G-1 (P2), E2E Playwright real con `M3_API_KEY` + expediente desechable, y OK explícito de Frank para commit/push/deploy. |

---

## 8. Handoff a ATLAS

- **Veredicto GEMINI:** `PASS_WITH_WARNINGS`. El cierre de F-1/P2 y F-2..F-5 (P3) está verificado. Queda **G-1 (P2)** como residuo de la heurística de negación.

- **Acción concreta:**
  1. Rutear **G-1** a SOFIA como `IMPLEMENTATION_DEFECT` (misma SPEC): ampliar ventana/tolerancia de negación (frases modales EN no contraídas + modificadores interpuestos) y añadir los tests de no-regresión indicados. Re-ejecutar `pytest -k FIX20260824_01StudyTypeMismatch` + `vitest run study-type-mismatch.test.ts`.
  2. **Producción** queda condicionada al cierre de G-1 y al E2E Playwright real (no ejecutado aquí).
  3. Pedir **OK Frank** para commit/push/deploy sólo tras G-1 y E2E.
  4. G-2 (P3) es opcional; puede aceptarse tal cual.

- **No requiere DEBY:** G-1 es defecto de implementación dentro del SPEC (SOFIA), no bug de causa raíz desconocida.

---

## 9. Autoauditoría (GEMINI)

- Incremento delimitado por diff real del working tree (base=HEAD, cabeza=working tree); SPEC/DEC/FND vigentes leídos.
- Evidencia independiente ejecutada (§3 + §4 reproducción), no sólo el reporte de SOFIA.
- No se editó código/tests/config/`discovery/`/SPEC/`PROYECTO.md`; no se imprimieron secretos ni PII.
- Cada hallazgo tiene evidencia, impacto y condición de cierre; severidad QA (P2/P3) separada de niveles L1/L2/L3.
- Separación QA/staging/producción explícita (§7).
- No se invocaron subagentes; no se declaró `DONE`; no se movió estado global.
- No se ejecutó E2E productivo (conforme a instrucción).
- El handoff vuelve a ATLAS con acción concreta y gate siguiente.