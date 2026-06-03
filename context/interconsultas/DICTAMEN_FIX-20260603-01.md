# DICTAMEN TÉCNICO: Falla de parseo clínico en Audiometría por respuesta contaminada de Featherless
- **ID:** FIX-20260603-01
- **Fecha:** 2026-06-03
- **Solicitante:** Usuario
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz
1. La extracción documental de Audiometría sí se completa correctamente en [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L224) y [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L245-L251), usando Gemini como proveedor extractivo. La evidencia aportada por el usuario confirma `extracted_data` válido y `extraction_provider = gemini`.
2. El fallo ocurre después, en la capa clínica de prediagnóstico. En [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L547-L556) y [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L697) el flujo enruta a Featherless/MedGemma mediante `_call_featherless_text_only()`.
3. En [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L799-L869) la respuesta de Featherless solo se limpia de fences Markdown y luego se parsea con `GeminiBase._tolerant_json_parse()`. Ese parser, ubicado en [backend/app/services/ai/base.py](backend/app/services/ai/base.py#L25-L54), no remueve prefijos basura como `<pad><pad>...` y además arroja un mensaje hardcodeado como `Respuesta de Gemini no es JSON parseable`.
4. El resultado observable es doblemente engañoso: el proveedor que realmente falló fue Featherless/MedGemma, pero el motivo final mezcla `FeatherlessParseError` con un mensaje interno que menciona Gemini. Eso hace parecer que la calibración de Audiometría o el extractor se rompieron, cuando el problema real está en el gateway clínico y su postproceso.

### B. Conclusión Forense
1. La causa raíz más probable es salida contaminada del proveedor clínico Featherless/MedGemma, no un defecto del prompt extractivo de Audiometría.
2. El patrón `'<pad><pad>...'` es consistente con artefactos del modelo o del gateway textual, no con un fallo semántico del prompt de extracción.
3. El fix correcto es endurecer el saneamiento previo al parseo en la capa clínica y volver agnóstico al proveedor el mensaje de parseo base.

### C. Cambio Mínimo Recomendado
1. En [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L799-L869), sanear `raw_text` antes del parseo para remover prefijos conocidos no JSON como `<pad>`, whitespace residual y fences, y conservar el bloque `{...}` cuando exista.
2. En [backend/app/services/ai/base.py](backend/app/services/ai/base.py#L25-L54), neutralizar el mensaje de `_tolerant_json_parse()` para que no mencione Gemini cuando el parser se reutiliza desde Featherless.
3. Cubrir el hotfix con pruebas angostas en [backend/tests/test_ai_pipeline.py](backend/tests/test_ai_pipeline.py) para los tres casos críticos: JSON puro, JSON con prefijo `<pad>`, y respuesta realmente no parseable.

### D. Instrucciones de Handoff para SOFIA
1. No tocar [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py); el extractor no es el dueño del defecto.
2. No recalibrar prompts de Audiometría en este corte; el problema no está en la tabla ni en la extracción.
3. Mantener el comportamiento honesto de degradación a `AI_NON_CONCLUSIVE` cuando la salida clínica siga siendo inválida después del saneamiento.
4. Corregir la observabilidad para que el motivo final refiera a Featherless o a un parseo genérico, nunca a Gemini, cuando el fallo sea clínico.

### Nota Forense
El hallazgo coincide con la memoria técnica del repositorio en `/memories/repo/backend-ai-pitfalls.md`: la capa clínica depende de constantes de entorno de Featherless y un `403` o una salida inválida deben tratarse como fallo del proveedor clínico, no de la extracción documental.