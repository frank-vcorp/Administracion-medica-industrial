# DICTAMEN TÉCNICO: Hipótesis forense sobre fallo en tests del pipeline IA backend
- **ID:** FIX-20260513-01
- **Fecha:** 2026-05-13
- **Solicitante:** HUMANO
- **Estado:** EN ANÁLISIS

### A. Análisis de Causa Raíz
El comando de pytest no pudo reproducirse en este entorno por cancelación previa del sandbox, así que el análisis se hizo por inspección estática del código.

La hipótesis de fallo más probable es una desalineación entre el contrato del extractor y la forma en que el propio extractor enmascara errores de validación. El punto crítico está en [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L219), especialmente en la rama de parseo y el catch-all final en [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L306). Si cualquier schema Pydantic falla al construir el objeto esperado, el método no propaga el error: imprime una advertencia y regresa el dict crudo de Gemini. Eso convierte un problema de contrato en un fallo posterior por atributo inexistente dentro del test.

El bloque de test más sospechoso por este patrón es [backend/tests/test_ai_pipeline.py](backend/tests/test_ai_pipeline.py#L124), porque asume que `extract_by_type("Laboratorio")` siempre devolverá un objeto con acceso por atributos (`result.paciente`, `result.parametros`). El schema correspondiente está en [backend/app/schemas/medical.py](backend/app/schemas/medical.py#L69) y exige `fecha: str` y `parametros: List[Dict[str, str]]`. Si el payload real no satisface ese contrato de forma exacta, el extractor devolverá un dict y el test fallará con `AttributeError` al evaluar `result.paciente` o `result.parametros`.

Hay un segundo candidato fuerte en prediagnóstico: la selección de proveedor clínico se decide con constantes de módulo tomadas del entorno al importar [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L39) y luego evaluadas en [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L490). El bloque de test [backend/tests/test_ai_pipeline.py](backend/tests/test_ai_pipeline.py#L345) parchea solo `_call_gemini_text_only`, no el proveedor. Si en el entorno real `MEDGEMMA_ENABLED=true` y hay `FEATHERLESS_API_KEY`, ese test puede desviarse a Featherless y fallar sin tocar el mock esperado.

### B. Justificación de la Solución
No se aplicó parche porque la solicitud fue emitir dictamen sin escribir código productivo.

Si se autorizara un parche mínimo, el más defensivo sería cambiar el comportamiento del extractor en [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L306): en vez de devolver el dict crudo tras un fallo de parseo, debería propagar una excepción explícita con el `doc_type` y la carga inválida, o bien devolver un resultado tipado consistente. Ese ajuste ataca la causa raíz porque evita falsos negativos opacos y hace que el test revele el contrato roto real.

Si el problema observado en la corrida del usuario fue solo uno y no una cascada, la otra corrección mínima razonable sería endurecer los tests de prediagnóstico que dependen del proveedor por defecto, parcheando siempre `MEDGEMMA_ENABLED` y `FEATHERLESS_API_KEY` en los casos que esperan Gemini, particularmente alrededor de [backend/tests/test_ai_pipeline.py](backend/tests/test_ai_pipeline.py#L345).

### C. Instrucciones de Handoff para HUMANO
1. Revisar primero si el fallo visible fue un `AttributeError` o una aserción sobre tipo/atributo en el bloque de extracción. Si sí, la causa más probable es el `return result` del extractor tras un error de schema.
2. Si el fallo menciona proveedor, timeout o ruta Featherless/MedGemma, revisar el estado del entorno al importar `prediagnostic.py`; en ese caso el segundo candidato gana fuerza.
3. Si quieres confirmación de alta certeza sin sandbox, el siguiente paso útil es obtener solo el traceback textual de pytest y contrastarlo contra estas dos rutas: parseo silencioso del extractor o selección de proveedor en prediagnóstico.