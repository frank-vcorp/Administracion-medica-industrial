# Checkpoint CHK_ARCH-20260715-02 — Recalibración Audiometría (Fase 3)

**Fecha:** 2026-07-15
**ID intervención:** IMPL-20260715-02
**SPEC:** `context/SPECs/SPEC_ARCH-20260715-02-RECALIBRACION-AUDIOMETRIA-CASO-REAL.md`
**Documento de referencia:** `context/interconsultas/PROMPTS_DOC-20260518-02-AUDIOMETRIA.md`
**Implementa:** SOFIA (Constructora Principal)
**Fase cubierta:** Fase 3 — Sincronización Prompt Clínico (Fallback Backend)
**Estado:** ✅ Implementación completa; pendiente segunda mano de validación GEMINI antes de commit

---

## Resumen ejecutivo

Se sincronizó el prompt clínico de Audiometría del fallback backend
(`PREDIAGNOSTIC_PROMPTS["Audiometria"]` en `backend/app/services/ai/prediagnostic.py`)
con la versión objetivo documentada en `predx-audiometria-v2-derivado`
(`PROMPTS_DOC-20260518-02-AUDIOMETRIA.md` §"1. Prompt Clínico Final").

Cambios clave respecto al prompt previo (`predx-audiometria-v1`):

1. **Prohibición explícita de copiar narrativa diagnóstica del documento fuente**
   (regla general #4). El modelo debe generar una *síntesis clínica derivada*
   a partir de los parámetros extraídos, no transcribir la conclusión del PDF.
2. **Bloques derivados obligatorios**: cuando hay umbrales de vía aérea por oído
   y frecuencias suficientes, el prompt exige generar:
   - `resumen_por_oido` (pta, status, severity, pattern, basis por oído)
   - `resumen_bilateral` (status, laterality, symmetry, note)
   - `clasificacion_hipoacusia` (right, left, bilateral, confidence)
3. **PTA por oído con prioridad al extraído**: si viene en el JSON, se usa
   directamente; si no, solo se estima cuando hay frecuencias suficientes y
   la limitación se declara explícitamente.
4. **Sensibilidad a `completitud_documental`**: si es "parcial" o
   "no_concluyente", el prompt exige reducir confianza y declarar limitaciones
   (no degradación automática a `AI_NON_CONCLUSIVE` salvo evidencia insuficiente).
5. **Campos Faringe/CAD/CAI/MTD/MTI**: relegados a contexto secundario, no
   base de interpretación audiométrica (regla general #5).
6. **Criterios ISO 1999 conservados**: Normal ≤25 dB, Leve 26-40, Moderada 41-60,
   Severa 61-80, Profunda >80 dB. Escotoma a 4000 Hz como *bandera* (no afirmación)
   sin suficiente evidencia del estudio completo.
7. **Tipo de hipoacusia**: solo se infiere (conductiva/neurosensorial/mixta) si
   hay vía ósea útil, separación aéreo-ósea o patrón consistente; en su defecto,
   `NO_CONCLUYENTE_PARA_TIPO`.
8. **Recommendation prudente**: ocupacional (seguimiento, vigilancia, correlación,
   comparación con previos o repetición si calidad insuficiente). Prohibido aptitud,
   dictamen, incapacidad o tratamiento prescriptivo (alineado con ARCH-20260516-06).

---

## Archivos modificados

| Archivo | Líneas afectadas | Tipo de cambio |
|---------|------------------|----------------|
| `backend/app/services/ai/prediagnostic.py` | 105-160 (~55 líneas en prompt + comentario histórico) | Reemplazo de `PREDIAGNOSTIC_PROMPTS["Audiometria"]` por versión `predx-audiometria-v2-derivado` |

**NO modificados** (per restricciones de la SPEC):
- `backend/app/services/ai/extractor.py` (lógica de normalización)
- `backend/app/schemas/medical.py` (`AIPrediagnosisResult` se conserva intacto;
  los campos derivados nuevos son **opcionales** y serán ignorados por Pydantic V2
  con la política `extra='ignore'` por defecto)
- `frontend/src/components/clinical/extraction-presentation-schemas.ts`
- Otros prompts (`Laboratorio`, `Espirometria`, `Rayos_X`, `Electrocardiograma`,
  `Somatometria`, `AgudezaVisual`, `ExamenMedico`)
- `generate_prediagnosis()` y `_call_dr7_medical_chat()`

---

## Validaciones ejecutadas

### Gate 1 — Compilación
```text
$ python3 -m py_compile backend/app/services/ai/prediagnostic.py
PY_COMPILE_OK ✅
```

### Gate 1.5 — Typecheck
```text
$ python3 -m mypy backend/app/services/ai/prediagnostic.py --ignore-missing-imports --no-strict-optional
Success: no issues found in 1 source file ✅
```
(mypy instalado con `--break-system-packages` para esta corrida; no estaba preinstalado en el entorno.)

### Gate 2 — Tests
```text
$ python3 -m pytest backend/tests/test_ai_pipeline.py -v -k audiometria
collected 61 items / 45 deselected / 16 selected
backend/tests/test_ai_pipeline.py::TestDocumentClassifierService::test_classify_audiometria PASSED
backend/tests/test_ai_pipeline.py::TestExtractorService::test_extract_audiometria PASSED
backend/tests/test_ai_pipeline.py::TestPrediagnosticoNuevosTipos::test_audiometria_dr7_json_puro_parsea_ok PASSED
backend/tests/test_ai_pipeline.py::TestPrediagnosticoNuevosTipos::test_audiometria_dr7_json_con_pad_parsea_ok PASSED
backend/tests/test_ai_pipeline.py::TestPrediagnosticoNuevosTipos::test_audiometria_dr7_content_segmentado_parsea_ok PASSED
backend/tests/test_ai_pipeline.py::TestPrediagnosticoNuevosTipos::test_audiometria_dr7_content_vacio_degrada_non_conclusive PASSED
backend/tests/test_ai_pipeline.py::TestCalibrationV1AudioEspiro::test_audiometria_nominal_con_frecuencias_canonicas PASSED
backend/tests/test_ai_pipeline.py::TestCalibrationV1AudioEspiro::test_audiometria_incompleta_completitud_parcial PASSED
backend/tests/test_ai_pipeline.py::TestCalibrationV1AudioEspiro::test_audiometria_con_campos_fuente_formato_diagnostico PASSED
backend/tests/test_ai_pipeline.py::TestCalibrationV1AudioEspiro::test_audiometria_sin_campos_fuente_compatibilidad_snapshots_viejos PASSED
backend/tests/test_ai_pipeline.py::TestCalibrationV1AudioEspiro::test_audiometria_derivacion_completitud_cuando_null PASSED
backend/tests/test_ai_pipeline.py::TestCalibrationV1AudioEspiro::test_audiometria_derivacion_frecuencias_detectadas_cuando_null PASSED
backend/tests/test_ai_pipeline.py::TestCalibrationV1AudioEspiro::test_audiometria_sospecha_corrimiento_125hz PASSED
backend/tests/test_ai_pipeline.py::TestCalibrationV1AudioEspiro::test_audiometria_null_values_omitidos_en_normalizacion PASSED
backend/tests/test_ai_pipeline.py::TestCalibrationV1AudioEspiro::test_prediagnostico_audiometria_usa_calibracion_medica_cuando_disponible PASSED
backend/tests/test_ai_pipeline.py::TestCalibrationV1AudioEspiro::test_prediagnostico_audiometria_usa_fallback_general_sin_calibracion PASSED
====================== 16 passed, 45 deselected in 0.96s ======================= ✅
```

**Suite completa:**
```text
$ python3 -m pytest backend/tests/test_ai_pipeline.py
============================== 61 passed in 0.37s ============================== ✅
```

### Gate 3 — Revisión manual

| Check | Estado | Notas |
|-------|--------|-------|
| Prompt refleja exactamente el documento objetivo | ✅ | Coincidencia 1:1 con `PROMPTS_DOC-20260518-02-AUDIOMETRIA.md` §1 (texto del prompt + JSON esperado) |
| Guardrails de lenguaje prudente conservados | ✅ | Reglas generales #1, #2, #3, #5 y `recommendation` prudente en regla específica #7 |
| JSON esperado incluye los 3 bloques derivados | ✅ | `resumen_por_oido`, `resumen_bilateral`, `clasificacion_hipoacusia` con ejemplos |
| Tests existentes pasan | ✅ | 16/16 audiometria + 61/61 ai_pipeline |
| Sin riesgo de romper otros tipos | ✅ | Cambio contenido a `PREDIAGNOSTIC_PROMPTS["Audiometria"]`; otros prompts intactos |
| Sin cambios en schema Pydantic | ✅ | `AIPrediagnosisResult` no tocado; campos nuevos serán ignorados por Pydantic V2 (`extra='ignore'`) |
| Sin cambios en extractor / normalización | ✅ | Cumple restricción de la SPEC |
| Sin cambios en `_call_dr7_medical_chat` / `generate_prediagnosis` | ✅ | Cumple restricción de la SPEC |

### Gate 4 — Documentación
- Checkpoint presente: `context/checkpoints/CHK_ARCH-20260715-02-RECALIBRACION-AUDIOMETRIA.md` (este archivo).
- Comentarios inline en `prediagnostic.py` líneas 107-111 referencian SPEC + ID intervención + documento objetivo.

---

## Self-Review Manual

| Pregunta | Respuesta |
|----------|-----------|
| ¿El prompt nuevo refleja exactamente el documento objetivo? | **Sí.** El cuerpo del prompt (líneas 112-148) y el JSON esperado (líneas 149-197) son transcripción directa de `PROMPTS_DOC-20260518-02-AUDIOMETRIA.md` §"1. Prompt Clínico Final". Se conserva el placeholder `{calibration_context}` y `{extracted_json}` para sustitución en runtime. |
| ¿Se mantienen los guardrails de lenguaje prudente? | **Sí.** Reglas generales explícitas ("compatible con", "sugiere", "sin evidencia suficiente", "requiere correlación clínica"). Recommendation restringida a seguimiento/vigilancia/correlación. Prohibiciones de aptitud/dictamen/incapacidad/tratamiento conservadas. |
| ¿El JSON esperado incluye los 3 bloques derivados? | **Sí.** `resumen_por_oido` (con `pta`, `status`, `severity`, `pattern`, `basis` por oído), `resumen_bilateral` (con `status`, `laterality`, `symmetry`, `note`), `clasificacion_hipoacusia` (con `right`, `left`, `bilateral`, `confidence`). |
| ¿Los tests existentes siguen pasando? | **Sí.** 16/16 tests específicos de audiometria + 61/61 suite completa `test_ai_pipeline.py`. Los tests mockean `_call_dr7_medical_chat`, así que el cambio en el prompt del fallback backend no afecta su contrato. |
| ¿Hay riesgo de romper otros tipos de estudio? | **No.** Cambio aislado a `PREDIAGNOSTIC_PROMPTS["Audiometria"]`. El resto del diccionario (Laboratorio, Espirometria, Rayos_X, Electrocardiograma, Somatometria, AgudezaVisual, ExamenMedico) está intacto. |

---

## Desviaciones y Riesgos

### Riesgo 1 — Campos derivados ignorados por el schema Pydantic
**Descripción:** `AIPrediagnosisResult` (en `backend/app/schemas/medical.py`) no declara
`resumen_por_oido`, `resumen_bilateral` ni `clasificacion_hipoacusia`. Pydantic V2 con la
política por defecto (`extra='ignore'`) descartará silenciosamente esos campos cuando
se construya el resultado.

**Impacto:** MedGemma generará los bloques, pero la capa backend los perderá antes
de persistir. La UI no podrá mostrarlos en esta capa.

**Mitigación documentada:** Esta restricción fue explícita en el handoff de la SPEC
("NO toques el schema Pydantic AIPrediagnosisResult"). El cambio es solo a nivel de
prompt. Para que los bloques lleguen a UI, **se requiere una SPEC/IMPL adicional** que
extienda el schema y/o renderice los bloques desde el `input_debug.rendered_prompt` o
desde un snapshot paralelo. Esa decisión queda fuera del alcance de
ARCH-20260715-02 y debe ser coordinada con INTEGRA antes de la Fase 4 (validación con caso real).

### Riesgo 2 — Confianza baja puede disparar `AI_NON_CONCLUSIVE` automáticamente
**Descripción:** El umbral `CONFIDENCE_THRESHOLDS["Audiometria"] = 0.55` (línea 49)
más el nuevo énfasis del prompt en "reducir confianza cuando hay limitaciones" puede
provocar que casos válidos (con completitud parcial pero PTA extraído) caigan por
debajo del umbral y se marquen `AI_NON_CONCLUSIVE`.

**Impacto:** Más casos `AI_NON_CONCLUSIVE` en pantallas de revisión médica.

**Mitigación:** El comportamiento actual del umbral es **deliberado** (documentado en
ARCH-20260326-16 §"Umbrales V1"). Si en la Fase 4 se observa sobre-degradación, se
puede afinar el umbral en una SPEC posterior. No es un blocker para commitear este
cambio de prompt.

### Desviación — Mypy no estaba preinstalado
**Descripción:** `mypy` no estaba disponible en el entorno. Se instaló con
`pip install mypy --break-system-packages` para completar el Gate 1.5.

**Impacto:** Ninguno en el código. Solo informativo.

---

## Recomendaciones para Fase 4 (validación con caso real)

1. Procesar el PDF `CERVANTES CELEDON DAMIAN-161745-23-12-2025_04_18_14_3333.pdf`
   en `/admin/services/[id]/calibration` para Audiometría.
2. Verificar que el `input_debug.rendered_prompt` ahora incluye los 3 bloques
   derivados (visible para debugging).
3. **Verificar manualmente** el contenido del JSON crudo que devuelve MedGemma
   (no del schema parseado) para confirmar que `resumen_por_oido`,
   `resumen_bilateral` y `clasificacion_hipoacusia` se generan con PTA=13/8
   (o equivalente según el caso real).
4. Si la UI no muestra los bloques, **es esperado** dado el Riesgo 1;
   escalar a INTEGRA para una SPEC de extensión del schema.

---

## Pendientes / Siguiente paso

- [ ] **Invocar a GEMINI** (`subagent_type='gemini'`) como segunda mano de
      validación, según protocolo INTEGRA + AGENTS.md.
- [ ] Tras OK de GEMINI y OK del humano: commitear con mensaje
      `feat(ai-pipeline): sincronizar prompt clínico Audiometría con predx-audiometria-v2-derivado (ARCH-20260715-02) [SOFIA]`.
- [ ] Fase 4 (validación con caso real en panel de calibración).

---

## Metadata

- **ID intervención:** IMPL-20260715-02
- **ID checkpoint:** CHK_ARCH-20260715-02-RECALIBRACION-AUDIOMETRIA
- **Fecha:** 2026-07-15
- **Agente:** SOFIA (Constructora Principal)
- **Mandante:** INTEGRA (Arquitecto de Soluciones)
- **SPEC de referencia:** SPEC_ARCH-20260715-02-RECALIBRACION-AUDIOMETRIA-CASO-REAL
- **Versión de prompt:** `predx-audiometria-v2-derivado`