# QA-20260824-12 — FIX-20260824-01 STUDY_TYPE_MISMATCH

> `QA-VERDICT`: **PASS_WITH_WARNINGS**

| Campo | Detalle |
|---|---|
| ID tarea | FIX-20260824-01 |
| ID intervención auditada | IMPL-20260824-01-FIX-STUDY-MISMATCH |
| Auditor | GEMINI (V3, gate por incremento) |
| SPEC | `context/SPECs/SPEC-FIX-20260824-01-STUDY-MISMATCH.md` v1.0 |
| Discovery | `DEC-20260824-01`, `FND-20260824-02` |
| Incremento | Working tree (sin commit). 6 archivos modificados + 3 nuevos (ver §Delimitación) |
| Alcance | Reforzada (delta de contrato API + heurística nueva + privacidad + >5 archivos) |

---

## 1. Delimitación y fuentes

**Fuente de verdad auditada:** diff real del working tree (`git diff` + archivos no trackeados), no sólo el `IMPL-REPORT`. SPEC/DEC/FND leídos de `context/SPECs/` y `discovery/`.

**Archivos modificados (incremento):**
- `backend/app/main.py` — nueva rama `except StudyTypeMismatchError` en `/api/v2/studies/upload-and-analyze`.
- `backend/app/services/ai/extractor.py` — `_call_with_dispatch` acepta `selected_study_type`; clasifica `ValueError` de M3/Gemini; `extract_by_type` stashea `last_extraction_audit` y propaga.
- `backend/tests/test_ai_pipeline.py` — +20 tests (clase `TestFIX20260824_01StudyTypeMismatch`).
- `frontend/src/actions/ai-prediagnosis.actions.ts` — `StudyAIAnalysisResult` gana 4 campos opcionales; parsing de `STUDY_TYPE_MISMATCH` en rutas OK y no-OK.
- `frontend/src/actions/event-test.actions.ts` — rama `STUDY_TYPE_MISMATCH` en `uploadEventTestFile` y `regenerateStudyAI`.
- `frontend/src/components/clinical/PapeletaWorkspace.tsx` — `MismatchMessageBanner` + estados `uploadMismatch`/`regenMismatch`.

**Archivos nuevos (incremento):**
- `backend/app/services/ai/study_type_mismatch.py` — `StudyTypeMismatchError`, `StudyTypeMismatchAssessment`, `detect_study_type_mismatch`, `extract_raw_response_text_from_value_error`, `build_user_facing_message`.
- `frontend/src/lib/clinical/study-type-mismatch-note.ts` — `buildMismatchResultNote`.
- `frontend/src/actions/__tests__/study-type-mismatch.test.ts` — 12 tests vitest.

**Fuera del incremento (no auditado como cambio, observado como contexto):**
- Deletions de `*.pyc` (artefactos de build).
- `discovery/DECISIONS.md` y `discovery/FINDINGS.md` (ownership ATLAS; contienen las DEC/FND fuente de esta tarea).
- `context/Juntas/…` y untracked `context/datos AMI/**`, `context/compact-saves/**`, `.deby-scratch/`, `.tmp-vitest/` — preexistentes.

**Nota de higiene de árbol:** el working tree mezcla producto, artefactos y datos AMI sensibles (PDF de pacientes) sin commit. No corresponde a GEMINI limpiarlo; se reporta para que ATLAS decida el contenido exacto del commit cuando Frank lo autorice.

---

## 2. Trazabilidad (criterio → implementación → evidencia → resultado)

| Criterio | Implementación | Evidencia | Resultado |
|---|---|---|---|
| AC-1 Audio→Espiro → `STUDY_TYPE_MISMATCH` + mensaje accionable | `detect_study_type_mismatch` reglas a/b/c; `StudyTypeMismatchError`; `main.py` mapea `error_code` | `test_detect_mismatch_audio_to_espirometry` PASS; reproducción independiente devuelve `detected=Espirometria` | **PASS** |
| AC-2 Espiro→Audio mensaje inverso | Idem, `detected=Audiometria` + `build_user_facing_message` | `test_detect_mismatch_espirometry_to_audio_inverse` PASS **pero fixture semánticamente incorrecto** (ver F-1); reproducción de frase realista devuelve `Audiometria` correctamente | **PASS (con hallazgo F-1)** |
| AC-3 sin HTML/prompt/respuesta M3/stack/PII en UI ni `resultNotes` | Respuesta V2 sin `provider_text`; `buildMismatchResultNote` redacta por cuenta propia; banner renderiza children JSX | Lectura de `main.py` (dict: `error/error_code/selected/detected/file`, sin `provider_text`); tests `test_main_endpoint_response_shape_for_mismatch`, `buildMismatchResultNote`, garantías estáticas; grep `dangerouslySetInnerHTML` en `src` sólo en `QRScannerModal` (CSS estático, no `resultNotes`) | **PASS** |
| AC-4 error M3 no relacionado conserva categoría técnica | `except ValueError` → no mismatch → `raise` original (CB-03 sin fallback) | `test_m3_generic_json_error_still_propagates_as_value_error` PASS; `test_m3_json_no_parseable_no_es_fallback` PASS; reproducción | **PASS** |
| AC-5 extracción válida sin regresión | `_call_with_dispatch` sólo actúa ante `ValueError`; éxito retorna idéntico | `test_valid_audio_*`/`test_valid_espirometry_*` PASS; `FIX20260821_01` + shared focal 13 PASS | **PASS** |
| AC-6 typecheck/tests/lint/build | — | Ver §3 | **PASS** |

---

## 3. Validaciones independientes (reproducidas por GEMINI)

| Gate | Comando | Resultado |
|---|---|---|
| Backend focal FIX-20260824-01 | `python3 -m pytest tests/test_ai_pipeline.py -k "FIX20260824_01StudyTypeMismatch" -q` | **20 passed** |
| Backend suite completa | `python3 -m pytest tests/test_ai_pipeline.py -q` | **115 passed / 31 failed** — 31 fallos preexistentes `M3_CREDENTIALS_UNAVAILABLE` (sin `M3_API_KEY` en env), idénticos a baseline declarado |
| Backend shared focal (CB-03 + FIX-20260821-01) | `-k "FIX20260821_01GateTableawareEspirometria or m3_json_no_parseable" -q` | **13 passed** |
| Frontend vitest focal nuevo | `npx vitest run src/actions/__tests__/study-type-mismatch.test.ts` | **12 passed** |
| Frontend shared focal | `npx vitest run src/lib/clinical/__tests__/extraction-stage-label.test.ts` | **4 passed** |
| Typecheck | `npx tsc --noEmit` | **exit 0** |
| Lint focal | `npx eslint <5 archivos del incremento>` | **0 errors, 1 warning** preexistente (`react-hooks/set-state-in-effect` en PapeletaWorkspace:371, ajeno al cambio) |
| Build | `npx next build` | **SUCCESS (exit 0)** |
| Reproducción detector (defensa) | `detect_study_type_mismatch` con fixtures reales y adversativos | Ver F-1 |

No se ejecutó `git stash` antes/después (GEMINI no muta el árbol); la baseline de fallos se contrastó por el tipo de error (`M3_CREDENTIALS_UNAVAILABLE`) y por coincidencia exacta con lo declarado en IMPL-REPORT.

---

## 4. Hallazgos priorizados

### F-1 (P2, Media) — El detector no distingue menciones negadas vs afirmadas; AC-2 tiene fixture semánticamente incorrecto

- **Evidencia:** `study_type_mismatch.py` `_mentions_canonical_study_type` devuelve el primer tipo canónico ≠ seleccionado, sin discriminar si esa mención aparece bajo negación ("no es un audiograma") o afirmación ("es una espirometría"). Reproducción independiente (exit real):
  - `"This is not a radiografía de tórax; es una espirometría válida."` con `selected=Espirometria` → `is_mismatch=True, detected=Rayos_X` (falso positivo: el documento ES el tipo seleccionado).
  - Fixture del test AC-2 (`test_detect_mismatch_espirometry_to_audio_inverse`): el texto afirma que el documento "parece ser un estudio de función pulmonar (espirometría)" —igual al seleccionado— y sin embargo el test asevera `detected=Audiometria`; es decir, el test documenta/bloquea un falso positivo en lugar de validar el mismatch inverso real.
- **Impacto:** en respuestas verbosas o auto-contradictorias del modelo, un usuario que seleccionó y cargó el estudio CORRECTO puede recibir "el documento parece ser <tipo equivocado>", con bucle de confusión operativa. No hay corrupción de datos, fuga ni crash. Los casos principales (FND-20260824-02 y el inverso con frase natural "not a spirometry… it's an audiogram") sí clasifican bien.
- **Reproducción:** `backend && python3 -c` invocando `detect_study_type_mismatch` con los textos de arriba.
- **Owner recomendado:** SOFIA (defecto de implementación dentro de SPEC; `IMPLEMENTATION_DEFECT`, misma SPEC). ATLAS decide pivote.
- **Condición de cierre:** (a) el detector sólo reporta `detected` desde contexto afirmado, o exige que la mención negada coincida con el tipo seleccionado; y (b) reemplazar el fixture de AC-2 por uno realista ("no parece ser una espirometría… es un audiograma") y añadir un test de no-regresión para el caso "niega tipo distinto y afirma el seleccionado".

### F-2 (P3, Baja) — Contrato documentado vs implementación: el campo `message` no existe en el response V2

- **Evidencia:** `IMPL-REPORT §Contratos` y `SPEC §Alcance` listan `message` como campo propagado; `main.py` retorna `error`, `error_code`, `selected_study_type`, `detected_study_type`, `file` — sin `message`.
- **Impacto:** funcionalmente OK (frontend hace `result.message ?? result.error`), pero el contrato escrito diverge del runtime. Riesgo de confusión en consumidores futuros.
- **Owner:** ATLAS (corregir SPEC/IMPL o añadir `message` al response para coherencia).

### F-3 (P3, Baja) — `study_type` reflejado sin validación en mensaje y `resultNotes`

- **Evidencia:** `app/main.py` `study_type: Optional[str] = Form(default=None)` sin whitelist; cuando se provee, se convierte en `doc_type` y llega a `build_user_facing_message`/`selected_study_type`.
- **Impacto:** React escapa el texto (sin XSS confirmado; `resultNotes` se renderiza como children, grep sin `dangerouslySetInnerHTML` relevante). El flujo de UI envía valores canónicos (`published.canonicalStudyType`), por lo que el riesgo es sólo ante llamadas API directas con strings arbitrarios reflejados.
- **Owner:** SOFIA (validar `study_type` contra el conjunto canónico en el backend). No bloqueante.

### F-4 (P3, Baja) — `print(provider_text)` crudo en log de servidor

- **Evidencia:** `app/main.py:1276-1282` imprime `provider_text={mismatch_err.provider_text!r}` (≤300 chars), que puede contener PII/prompt si el modelo los repitió. El propio IMPL-REPORT lo marca como pendiente de decisión.
- **Impacto:** DEC-20260824-01 pide "auditoría/log seguro sin PII ni secretos"; el log actual puede violarlo (server-side, no persistido en Prisma, no expuesto al cliente).
- **Owner:** ATLAS/SOFIA (sin cambio de comportamiento visible): loguear sólo `selected/detected/provider` + `len(provider_text)` + `sha256(provider_text)[:16]`, o `repr(provider_text)[:80]`.

### F-5 (P3, Cosmético) — El copy pierde tildes frente al ejemplo de SPEC/DEC

- **Evidencia:** `build_user_facing_message` emite "Seleccionaste Audiometria… Espirometria" (sin tilde), mientras SPEC/DEC ejemplifican "Audiometría… Espirometría".
- **Impacto:** puramente estético; no cambia la semántica ni la acción.
- **Owner:** SOFIA/ATLAS (1 función, 1 lugar).

---

## 5. Riesgo operativo

- **Reversión:** 100 % código, sin migración/schema; el response V2 suma `error_code` + campos opcionales (delta no destructivo). Revertir restaura FND-20260824-02.
- **Falsa confianza:** el test AC-2 no valida el escenario inverso real (ver F-1) — riesgo de regresión no detectada.
- **Snapshots inmutables:** el fix sólo aplica a corridas nuevas; uploads incorrectos previos no se regeneran automáticamente (correcto, sin aprobación).
- **Sin P0/P1 abiertos.**

---

## 6. Preparación por entorno

| Entorno | Estado |
|---|---|
| Calidad (typecheck/lint/unit/build) | **LISTO** |
| Staging | **NO_EVALUADO** — no hay entorno de staging autorizado identificado en el handoff; sin `M3_API_KEY` no se puede reproducir el rechazo del proveedor. |
| Producción | **NO_LISTO** — requiere cerrar F-1 (P2) y obtener OK explícito de Frank para commit/push/deploy. |

**E2E Playwright real (V3):** **PENDIENTE hasta deploy/staging con `M3_API_KEY`.** No ejecutado aquí: (a) no hay `M3_API_KEY` en el entorno (los tests backend fallan con `M3_CREDENTIALS_UNAVAILABLE`, por lo que el path `STUDY_TYPE_MISMATCH` no se dispara), (b) no hay servidor corriendo ni entorno autorizado, y (c) FND-20260824-01 documenta que un E2E previo contaminó un expediente de producción con el PDF de otro paciente; no repetir sin expediente de prueba desechable y con documento cuyo paciente corresponda. Precondiciones para considerarlo PASS: M3_API_KEY real, V3 published, caso controlado `ESPIROMETRIA.pdf` sobre `Audiometria`, y verificación del banner accionable (nunca `Respuesta de M3 no es JSON válido`), con assertion + accessibility snapshot + consola + requests fallidos.

---

## 7. Handoff a ATLAS

- **Gate siguiente:** CRONISTA aplica transición según decisión de ATLAS. Veredicto GEMINI = `PASS_WITH_WARNINGS`; requiere aceptación explícita de ATLAS de los warnings, en particular el cierre de F-1 antes de producción.
- **Acción concreta para ATLAS:**
  1. Rutear **F-1** a SOFIA como `IMPLEMENTATION_DEFECT` (misma SPEC): hacer el detector negación-consciente y corregir el fixture de AC-2; re-ejecutar `pytest -k FIX20260824_01StudyTypeMismatch` + `vitest run study-type-mismatch.test.ts`.
  2. Resolver **F-2** (alinear contrato: incluir `message` en response o corregir SPEC/IMPL).
  3. Decidir **F-4** (sanitización del `print(provider_text)`) — sin cambio de comportamiento observable.
  4. Programar **E2E Playwright real** en staging autorizado al disponer de `M3_API_KEY`, con expediente desechable y documento del paciente correcto (no producción).
  5. Pedir **OK Frank** para commit/push/deploy únicamente tras cerrar F-1.

- **No requiere DEBY:** no hay bug reproducible de causa raíz desconocida; el gap de F-1 es de implementación dentro de SPEC (SOFIA), no diagnóstico.

---

## 8. Autoauditoría (GEMINI)

- Incremento delimitado por diff real del working tree (base=HEAD, cabeza=working tree); SPEC/DEC/FND vigentes leídos.
- Evidencia independiente ejecutada (§3), no sólo el reporte de SOFIA.
- No se editó código/tests/config/`discovery/`/SPEC/`PROYECTO.md`; no se imprimieron secretos ni PII.
- Cada hallazgo tiene evidencia, impacto y condición de cierre; severidad QA (P2/P3) separada de niveles L1/L2/L3.
- Separación QA/staging/producción explícita (§6).
- No se invocaron subagentes; no se declaró `DONE`; no se movió estado global.
- El handoff vuelve a ATLAS con acción concreta y gate siguiente.