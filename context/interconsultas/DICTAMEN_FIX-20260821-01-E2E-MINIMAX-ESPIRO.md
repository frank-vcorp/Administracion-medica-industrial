# DICTAMEN FIX-20260821-01 — E2E MiniMax Espirometría: extracción OK pero prediagnóstico `AI_NON_CONCLUSIVE` por gate de parámetros mínimos

- **ID:** FIX-20260821-01 (sufijo de rastreo: E2E-MINIMAX-ESPIRO)
- **Fecha:** 2026-08-21
- **Solicitante:** Frank (hallazgo FND-20260821-03, reproducido en producción vía Playwright con sesión admin)
- **Tarea/SPEC relacionadas:** ARCH-20260516-12 (extracción exhaustiva 6 bloques), FIX-20260812-20 (guardrails backend extracción espirometría), ARCH-20260820-01 Fase 3/4 (resolver V3 / gates Events), SPEC_ARCH-20260326-16 (separación capa extractiva/interpretativa)
- **Agente:** DEBY (diagnóstico forense; sin implementación de fix por instrucción explícita del solicitante)
- **Nivel:** **L2** (lógica acotada multi-archivo dentro de contrato existente; requiere implementación no trivial + tests; ejecutor SOFIA vía ATLAS)
- **Estado:** **CAUSA_CONFIRMADA** → `DIAGNOSED`
- **Parche L1 aplicado:** No (instrucción explícita: no implementar, no tocar producción, no commit/push)

---

## A. Síntoma y alcance

Expediente `8af728bf-f572-47c3-94b7-31aa9916a4b8` (MedicalEvent `IN_PROGRESS`, creado 2026-08-08). EventTest de Espirometría `4d6879f0-42da-4a5a-866b-630e5d0e9e5e` (MedicalTest `273bb1ef-0973-4f92-b762-e6a54cd98852`, código `GEN-013`). Se subió el fixture `context/RD2026/ESPIROMETRIA.pdf`.

Síntomas observados (FND-20260821-03):

1. La extracción terminó y la UI mostró datos reales: tabla `parametros[]` con 10 filas (M1/M2/M3/%REF/REF/LLN).
2. El progreso de la UI dijo **"Extrayendo datos con Gemini"** aunque el proveedor efectivo fue **M3 / MiniMax-M3**.
3. El prediagnóstico quedó `AI_NON_CONCLUSIVE` con `non_conclusive_reason = "Parámetros mínimos faltantes: fev1, fvc"` **a pesar de que la tabla extraída contiene filas FEV1 y FVC con valores**.

Alcance: afecta a toda espirometría procesada por el pipeline V2 (`/api/v2/studies/upload-and-analyze`) con formato exhaustivo (bloques + `parametros[]`). Audiometría del mismo expediente NO está afectada (sus campos mínimos sí existen en raíz: `oido_derecho`/`oido_izquierdo`).

## B. Reproducción

- **Determinista:** sí. La corrida de producción del 2026-08-21 ~11:00 (ExtractionSnapshot `8fad6571-ccc1-4d12-9569-49b23037bd33`) es la reproducción Playwright del hallazgo.
- **Input:** `context/RD2026/ESPIROMETRIA.pdf`. Verificación de identidad: `sha256` local = `6a94384df2fe…de541` == `source_file_hash` del snapshot de producción (`sha256:6a94384df2fe66b8a187a5009bc47ad92d87f4f93d8942e1b181de12325de541`). Es el mismo archivo byte a byte.
- **Comando mínimo de reproducción (backend, sin UI):**
  ```bash
  curl -X POST "$API/api/v2/studies/upload-and-analyze" \
    -F "file=@context/RD2026/ESPIROMETRIA.pdf" \
    -F "study_type=Espirometria" \
    -F "ai_calibration_json=<options.aiCalibration del MedicalTest GEN-013>"
  ```
  Esperado (bug): `prediagnosis_snapshot.clinical_state = AI_NON_CONCLUSIVE`, `non_conclusive_reason = "Parámetros mínimos faltantes: fev1, fvc"`, con `extraction_snapshot.extracted_data.parametros[]` poblada (10 filas).

## C. Evidencia (producción, redactada — sin credenciales ni PII)

### C.1 Snapshot de extracción vigente (v1, no superseded)

| Campo | Valor |
|---|---|
| `studyType` / `clinicalState` | `Espirometria` / `DRAFT_EXTRACTED` |
| `modelName` / `promptVersion` | `Minimax-M3` / `V1` |
| audit.`extraction_provider_requested` / `_used` | `m3` / `m3` (sin fallback) |
| audit.`extraction_model_used` | `Minimax-M3` |
| audit.`calibration_source` (frontend) | `legacy_heuristic` |
| audit.`calibration_version_id` | `null` (no corrió resolver V3) |
| `extracted_data` keys raíz | `centro, calidad, estudio, graficas, parametros, condiciones, notas_calidad, realizo_nombre, es_interpretable, paciente_detalle, impresion_diagnostica, completitud_documental, realizo_cedula_profesional` |
| `extracted_data.fev1` / `.fvc` (flat raíz) | **ausentes** (no existen como keys) |
| `extracted_data.es_interpretable` (raíz, derivado) | `false` |
| `extracted_data.completitud_documental` (raíz, derivado) | `no_concluyente` |
| `extracted_data.calidad.es_interpretable` / `.completitud_documental` (LLM) | `true` / `suficiente` |

Filas `parametros[]` (10, valores reales del PDF; keys emitidas por el LLM):

| label | key | unidad | m1 | m2 | m3 | ref | lln | m1_pct_ref |
|---|---|---|---|---|---|---|---|---|
| Mejor FVC | `mejor_fvc` | l | 2.33 | 2.33 | 2.33 | 3.32 | 2.69 | 70 |
| Mejor FEV1 | `mejor_fev1` | l | 2.15 | 2.15 | 2.15 | 2.77 | 2.23 | 77 |
| MEFv1/MFvc | `mefv1_mfvc` | % | 92.13 | 92.13 | 92.13 | 83.67 | 76.27 | 110 |
| FVC | `fvc` | l | 2.30 | 2.33 | 2.26 | 3.32 | 2.69 | 69 |
| FEV1 | `fev1` | l | 2.15 | 2.11 | 2.09 | 2.77 | 2.23 | 77 |
| FEV1/FVC | `fev1_fvc` | % | 93.31 | 90.59 | 92.29 | 83.67 | 76.27 | 112 |
| FEF25%-75% | `fef25_75` | l/s | 3.29 | 2.92 | 3.03 | 3.61 | 2.22 | 91 |
| FET100% | `fet100` | s | 3.74 | 4.26 | 3.80 | – | – | – |
| Vext. | `vext` | l | 0.06 | 0.08 | 0.08 | – | – | – |
| Edad del pulmón | `edad_pulmon` | – | 47.15 | 48.58 | 49.51 | – | – | – |

`notas_calidad` raíz: `SOSPECHA_MAPEO: parámetros con key no canónico: ['Mejor FVC', 'Mejor FEV1', …]. Verifique mapeo label→key.`

### C.2 Snapshot de prediagnóstico vigente (v1, no superseded)

| Campo | Valor |
|---|---|
| `clinicalState` | `AI_NON_CONCLUSIVE` |
| `summary` | "No es posible generar una sugerencia clínica con la información disponible." |
| `non_conclusive_reason` | **"Parámetros mínimos faltantes: fev1, fvc"** |
| `calibration_source` / `prompt_source` | `legacy_hardcoded` / `backend_fallback` (`prompt_version=backend_v2`) |
| `clinical_provider` / `clinical_model_used` | `dr7` / `medgemma-27b-it` (config resuelta; **DR7 nunca fue invocado** — el gate cortó antes) |
| `confidence` | 0 |

### C.3 Configuración efectiva en producción

- `AppConfig.extraction_default_provider = {"provider":"m3"}` (updatedAt 2026-08-11). `aiCalibration.extraction` del test GEN-013: `provider=m3`, `model=Minimax-M3`, `version=V1` (prompt 3550 chars). → El provider extractivo efectivo **m3/MiniMax-M3 es intencional** por doble fuente (calibración V1/V2 + default global). FIX-20260812-12: sin fallback a Gemini por decisión de Frank.
- `options.aiCalibration` de GEN-013: `schemaVersion=null` (V1/V2), `enabled=false`, `canonicalStudyType=null`, sin `diagnosis.prompt` (0 chars), sin `clinicalCriteria`, `publishedVersions=null`, `draft=null` → **no hay versión V3 publicada**.
- Control (mismo expediente): AUDIOMETRIA (GEN-003, también V1/V2 `enabled=false`) produjo `AI_PENDING_REVIEW` con `calibration_source=general_fallback` — confirma que la asimetría es del contrato de datos de Espirometría, no del proveedor ni de DR7.
- Tercer hallazgo incidental (fuera de alcance): EXAMEN MEDICO (GEN-015) con error `422 missing query study_type` en su `resultNotes`.

## D. Hipótesis evaluadas

| # | Hipótesis | Evidencia a favor | Evidencia en contra | Estado |
|---|---|---|---|---|
| H1 | DR7/MedGemma indisponible → non-conclusive | – | El reason es `Parámetros mínimos faltantes`, generado por el gate local ANTES de cualquier llamada HTTP; `clinical_model_used` se resolvió correctamente | **Descartada** |
| H2 | La extracción no capturó FEV1/FVC | El reason dice "faltantes" | `parametros[]` contiene filas FEV1/FVC con M1/M2/M3/REF/LLN reales; UI las mostró | **Descartada** |
| H3 | Gate de parámetros mínimos exige campos flat raíz (`fev1`,`fvc`) que el formato exhaustivo ya no puebla | Código `_check_minimum_params` + `REQUIRED_PARAMS`; `extracted_data` de producción sin keys flat; normalizador no hace backfill | – | **CONFIRMADA (causa raíz)** |
| H4 | Una V3 publicada con `requiredParams` incorrectos causa el fallo | – | No hay V3 publicada en producción (`publishedVersions=null`); el requiredParams efectivo es el legacy hardcodeado | **Descartada** (pero ver §E.3: una V3 con los `requiredParams` del draft actual fallaría igual) |
| H5 | Proveedor equivocado (Gemini vs MiniMax) causa el fallo | UI dijo "Gemini" | El provider m3 fue intencional (AppConfig + aiCalibration) y la extracción fue exitosa; el texto es un label estático de UI | **Confirmada como defecto secundario** (S3), no causa del non-conclusive |

## E. Causa raíz (confirmada)

**Desfase de contrato entre el formato de extracción exhaustivo y el gate de parámetros mínimos del prediagnóstico.** La extracción exhaustiva (IMPL-20260516-12 + guardrails FIX-20260812-20) movió FEV1/FVC a las filas `parametros[]`, pero el gate clínico sigue buscándolos como campos flat de raíz que nadie puebla.

Cadena causal completa (archivo:línea):

1. **Frontend — routing:** `getPublishedCalibrationForEventTest` (`frontend/src/actions/calibration-v3.actions.ts:746-820`, `readV3Root` en `:140`) devuelve `null` para calibraciones V1/V2 (sólo lee V3; diseño Fase 3, `:770-774`) → `calibrationSource='legacy_heuristic'` y `study_type='Espirometria'` por heurística. El `enabled=false` V1/V2 **no se consulta** en este gate (sólo aplica a V3).
2. **Frontend — pérdida de `medical_test_id`:** `uploadEventTestFile` lo agrega al FormData (`event-test.actions.ts:925`), pero `triggerStudyAIAnalysis` construye un FormData nuevo sólo con `file/triggered_by_user_id/study_type/ai_calibration_json` (`ai-prediagnosis.actions.ts:167-180`) → **`medical_test_id` nunca llega al backend** → el `CalibrationResolver` (Fase 4) no se ejecuta en la ruta de upload → `calibration_version=None`.
3. **Backend — extracción:** `v2_upload_and_analyze` (`backend/app/main.py:940`, resolución en `:1001-1033`) recibe `medical_test_id=None`. `_resolve_provider` (`extractor.py:465-532`) → `m3`/`Minimax-M3` (aiCalibration + AppConfig). MiniMax devuelve el formato exhaustivo con keys **no canónicas** (`fev1`, `fvc`, `mejor_fvc`, `fev1_fvc`, `fef25_75`, … en lugar de `fev1_l`, `fvc_l`, `mejor_fvc_l`, `fev1_fvc_pct`, `fef25_75_l_s` del frozenset `extractor.py:150-155`).
4. **Backend — normalizador incompleto:** `_normalize_espirometria_result` (`extractor.py:346-454`) deriva `es_interpretable`/`completitud_documental` pero **no hace backfill de los campos flat legacy `fev1`/`fvc`/`fev1_fvc_ratio` desde `parametros[]`** (el paso que falta). Además, como las keys no llevan sufijo `_l`, el conteo de principales da 0 → raíz `completitud_documental=no_concluyente` y `es_interpretable=false` (`extractor.py:399-402, 426-435`), contradiciendo `calidad` del LLM (`suficiente`/`true`).
5. **Backend — parse Pydantic falla (agravante):** el dict del LLM no trae `paciente`/`fecha_estudio` en raíz (están en `paciente_detalle`/`estudio`), campos requeridos de `EspirometriaData` (`schemas/medical.py:205-206`) → `EspirometriaData(**result)` lanza y la rama `except` (`extractor.py:904-906`) devuelve el dict crudo. El resultado práctico es idéntico al de un `model_dump()` con `fev1=None`: **no hay `fev1`/`fvc` utilizables en raíz**.
6. **Backend — gate clínico:** sin `calibration_version` y sin `diagnosis.prompt` en el shim V1/V2, `_resolve_clinical_criteria` cae a la prioridad 3 `legacy_hardcoded` (`prediagnostic.py:708-718`) con `requiredParams = REQUIRED_PARAMS["Espirometria"] = ["fev1","fvc"]` (`prediagnostic.py:175`). `_check_minimum_params` (`prediagnostic.py:590-621`) hace **lookup exclusivo en raíz** (`extracted_data.get(param)`, `:610-612`) — no inspecciona `parametros[]` ni aliases → `missing=["fev1","fvc"]` → retorno `AI_NON_CONCLUSIVE` en `prediagnostic.py:932-949` **sin invocar DR7**.

### E.1 Provider efectivo: legacy vs V3 no publicado

- **Extracción:** provider efectivo = `m3`/`Minimax-M3`, resuelto por la calibración V1/V2 legacy (`aiCalibration.extraction.provider`) y consistente con el default global `AppConfig.extraction_default_provider={"provider":"m3"}`. No hay V3 publicada que lo altere. El texto "Extrayendo datos con Gemini" es un **label estático** de `AI_PIPELINE_STAGES` (`PapeletaWorkspace.tsx:164`), no refleja el provider real.
- **Prediagnóstico:** `calibration_source=legacy_hardcoded` + `prompt_source=backend_fallback` porque (a) no hay V3 publicada y (b) el resolver ni corrió por la pérdida de `medical_test_id` (paso 2). El prompt clínico usado fue `PREDIAGNOSTIC_PROMPTS["Espirometria"]` (`backend_v2`), que irónicamente instruye "PRIORIZA esos valores tabulares [parametros]" — el prompt clínico sí contempla el formato exhaustivo; el gate que lo precede no.

### E.2 Mapeo `parametros[]` / `fev1_l` / `fvc_l` → criterios clínicos

Tres vocabularios desconectados:

| Capa | Vocabulario exigido | Vocabulario real | Resultado |
|---|---|---|---|
| Gate clínico legacy (`REQUIRED_PARAMS`) | flat raíz `fev1`, `fvc` | sólo `parametros[]` | **fallo del gate** |
| Keys canónicas del normalizador (`_ESPIROMETRIA_CANONICAL_KEYS`) | `fev1_l`, `fvc_l`, `fev1_fvc_pct`, `mejor_fev1_l`, … | `fev1`, `fvc`, `fev1_fvc`, `mejor_fvc`, … (sin sufijo) | SOSPECHA_MAPEO + `es_interpretable=false` derivado |
| Draft V3 del lote nocturno (`clinicalCriteria.requiredParams`) | `fev1_l`, `fvc_l`, `fev1_fvc_pct` | – | **fallaría igual**: `_check_minimum_params` busca en raíz, y esos nombres tampoco existen en raíz (H4) |

El draft V3 (`context/lote-nocturno-20260820-01/evidencia/baseline/calibrations-snapshot/espirometria-v3-draft.json`, status `draft`, NO publicado) define `fieldDefinitions` con aliases (`fvc`↔`fvc_l`, `fev1`↔`fev1_l`, `fev1_fvc_ratio`↔`fev1_fvc_pct`) — evidencia de que el contrato previsto para resolver el mapeo es **requiredParams ↔ filas de `parametros[]` vía key/label/alias**, y ese mecanismo no existe hoy en `_check_minimum_params`.

## F. Solución recomendada (fix mínimo, nivel L2 — a implementar por SOFIA vía ATLAS)

Objetivo: que el gate de mínimos reconozca el formato exhaustivo y que el normalizador exponga los valores clave, sin cambiar contratos públicos (`EspirometriaData`, `AIPrediagnosisResult`, endpoints) ni comportamiento de otros tipos de estudio.

1. **`backend/app/services/ai/extractor.py` — `_normalize_espirometria_result`:**
   - Backfill de campos flat legacy desde `parametros[]` cuando estén ausentes: `fev1`, `fvc`, `fev1_fvc_ratio`, `fev1_percent_predicho`, `fvc_percent_predicho`. Valor = mejor maniobra (máx de m1/m2/m3) de la fila cuyo `key`/`label` mapee (aceptando variantes con y sin sufijo: `fev1_l`|`fev1`, `fvc_l`|`fvc`, `fev1_fvc_pct`|`fev1_fvc`|`mefv1_mfvc`, y filas `mejor_*` con prioridad si existen). El schema ya documenta "mejor valor disponible" (`schemas/medical.py:208-212`), así que no introduce semántica nueva.
   - Aceptar variantes sin sufijo en el conteo de principales y en la derivación de `es_interpretable` (normalizar `key` antes de comparar contra `_ESPIROMETRIA_CANONICAL_KEYS`, o ampliar el frozenset con las variantes observadas) para eliminar el falso `no_concluyente`/`es_interpretable=false`.
   - Poblar `paciente`/`fecha_estudio` raíz desde `paciente_detalle.nombre_completo`/`estudio.fecha_estudio` cuando falten, para que `EspirometriaData` valide y se elimine la caída silenciosa al dict crudo (`extractor.py:904-906`).
2. **`backend/app/services/ai/prediagnostic.py` — `_check_minimum_params`:** resolución table-aware para Espirometría: si el parámetro requerido no está en raíz, buscarlo en `parametros[]` por `key`/`label` con normalización de aliases antes de declararlo faltante. Mantener el comportamiento actual para el resto de tipos. Esto deja el camino listo para `requiredParams` V3 (`fev1_l`, …) sin segundo ciclo.
3. **Tests de regresión** (ver §G).

**No incluir en este fix sin decisión funcional explícita (punto de decisión, ver §I):** reenviar `medical_test_id` en `triggerStudyAIAnalysis`. Con los datos actuales de producción (`aiCalibration.enabled=false` en V1/V2), activar el resolver en la ruta de upload clasificaría el test como `document_extraction` con `enabled=false` → `calibration_source="calibration_disabled"` → **la IA se bloquearía por completo** para Espirometría y Audiometría (`prediagnostic.py:813-826, 850-891`). Si el resolver debe activarse, ATLAS/Frank deben confirmar antes el estado intended del flag `enabled` V1/V2 (¿config inconsistente o decisión vigente?).

**Defecto cosmético separado (puede ser unidad trivial independiente):** `PapeletaWorkspace.tsx:164` — el label de progreso debe derivar del provider real (el audit ya expone `extraction_provider_used`) o usar texto neutro ("Extrayendo datos"). Hoy hardcodea "Gemini" y será incorrecto cada vez que el provider sea m3.

## G. Prueba de regresión y validación

**Unitarias (backend, `backend/tests/test_ai_pipeline.py`):**

1. Gate table-aware: payload Espirometría sin flat raíz pero con `parametros[]` (keys `fev1`/`fvc` y variante canónica `fev1_l`/`fvc_l`) + DR7 mockeado → `generate_prediagnosis` supera el gate y alcanza la llamada clínica (no `Parámetros mínimos faltantes`).
2. Negativa: payload sin filas FEV1/FVC (ni flat ni tabla) → sigue retornando `AI_NON_CONCLUSIVE` con el mismo reason (el gate no se relaja).
3. Normalizador: backfill de `fev1`/`fvc`/`fev1_fvc_ratio` desde filas con ambas grafías; `es_interpretable=true` y `completitud_documental=suficiente` derivados con keys sin sufijo; `paciente`/`fecha_estudio` mapeados desde bloques → `EspirometriaData` valida (sin caída al dict crudo).
4. Control Audiometría: comportamiento del gate sin cambios para `oido_derecho`/`oido_izquierdo`.

**E2E (reproducción del hallazgo):**

5. Repetir el flujo Playwright de FND-20260821-03 (sesión admin, subida de `context/RD2026/ESPIROMETRIA.pdf` en el EventTest de Espirometría): el prediagnóstico NO debe terminar con `non_conclusive_reason="Parámetros mínimos faltantes: fev1, fvc"`; con `MEDGEMMA_ENABLED=true` y DR7 accesible debe llegar a `AI_PENDING_REVIEW` (o non-conclusive por causa clínica/DR7, nunca por el gate). Precondición declarada: entorno con DR7 configurado (producción lo tiene: `clinical_model_used=medgemma-27b-it`).
6. Verificar audit del snapshot: `extraction_provider_used=m3` sigue siendo respetado (sin regresión del selector).

## H. Parche L1 aplicado

No. Diagnóstico puro por instrucción del solicitante (no implementar fixes, no alterar producción, sin commit/push). No se modificó ningún archivo del repositorio; los scripts de consulta DB de sólo-lectura fueron eliminados tras su uso.

## I. Handoff, riesgos y reversión

**Dueño siguiente:** ATLAS. Acción exacta: abrir sesión independiente de SOFIA entregándole este dictamen (§F puntos 1-3 + §G pruebas 1-4; pruebas 5-6 en entorno con DR7). En paralelo, decidir con Frank el punto de §F párrafo final (semántica de `enabled=false` V1/V2 + reenvío de `medical_test_id`), pues condiciona la publicación V3 del draft de espirometría.

**Riesgos del fix propuesto:**

- Clínico: el backfill elige "mejor maniobra"; si ATLAS/SOFIA prefieren M1 o la fila `Mejor *` literal, debe fijarse en la mini-SPEC antes de implementar (afecta el número que ve DR7). Mitigación: el criterio "mejor valor disponible" ya está documentado en el schema.
- Regresión de otros tipos: el cambio en `_check_minimum_params` debe quedar condicionado a Espirometría (o a presencia de `parametros[]`) para no alterar Laboratorio/Rayos_X/ECG.
- El fix no resuelve el bloqueo potencial por `enabled=false` V1/V2 si luego se cablea el resolver (ver §F); documentar en el PR para no encadenar otro ciclo.

**Reversión:** los cambios son código puro sin migración ni cambio de schema DB; revertir = revertir el commit del fix. Los snapshots ya persistidos son inmutables (el fix sólo afecta corridas nuevas; el expediente de este hallazgo puede regenerarse tras el fix vía re-subida o `regenerateStudyAI` si se desea actualizar su estado).

**Hallazgos incidentales (fuera de alcance, para ATLAS):**

- EXAMEN MEDICO (GEN-015) del mismo expediente: `422 {"loc":["query","study_type"],"msg":"Field required"}` — endpoint que trata `study_type` como query param; defecto independiente.
- `enabled=false` en aiCalibration V1/V2 de Espirometría y Audiometría en producción no es aplicado por ninguna capa de la ruta upload (frontend gate sólo lee V3; backend resolver no recibe `medical_test_id`): posible inconsistencia de configuración a aclarar.

---

### Autoauditoría DEBY

- Diferencié síntoma (reason del non-conclusive), causa probable (H3 al inicio) y causa confirmada (H3 con evidencia de producción + código).
- La evidencia no contiene secretos ni PII (nombre de paciente y keys redactados/omitidos; sólo hashes y metadata clínica).
- Clasificación L2 por riesgo/contrato, no por conteo de líneas.
- No edité código ni artefactos de otro owner; no inserté FIX ID en código; no delegué lateralmente (handoff único a ATLAS).
- Loop breaker aplicado: FIX-20260812-20 documentó el mismo string de error pero su causa fue la capa extractiva (ya corregida y verificada en esta corrida: 10 filas reales); la causa actual es una capa distinta (gate clínico + contrato flat), con archivos y mecanismo diferentes → procede dictamen nuevo; máximo 1 ciclo DEBY→SOFIA por este error a partir de aquí.
- Prueba de regresión definida (§G) y validación E2E trazable al hallazgo original.
