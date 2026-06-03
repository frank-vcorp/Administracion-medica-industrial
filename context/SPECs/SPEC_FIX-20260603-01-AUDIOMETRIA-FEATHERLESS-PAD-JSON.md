# SPEC FIX-20260603-01 — Hotfix de parseo clínico Featherless en Audiometría

- ID: FIX-20260603-01
- Fecha: 2026-06-03
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Respaldo forense:
  - context/interconsultas/DICTAMEN_FIX-20260603-01.md

## Objetivo

Corregir el fallo en el prediagnóstico clínico de Audiometría cuando Featherless/MedGemma devuelve texto contaminado con prefijos como `<pad><pad>...`, para que el sistema:

1. recupere JSON válido cuando sí exista un cuerpo estructurado útil
2. degrade honestamente a `AI_NON_CONCLUSIVE` cuando la salida clínica siga siendo inválida
3. deje de reportar esos fallos como si vinieran de Gemini

## Hipótesis verificada

1. La extracción documental sí funciona y devuelve `extracted_data` válido desde Gemini.
2. El fallo ocurre después, en [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L799-L869).
3. `_call_featherless_text_only()` limpia solo fences Markdown y luego parsea con `GeminiBase._tolerant_json_parse()`.
4. `GeminiBase._tolerant_json_parse()` no remueve prefijos `<pad>` y además produce un mensaje de error con el texto `Respuesta de Gemini no es JSON parseable`, aunque sea usado por Featherless.

## Archivo ancla inicial

1. [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L799)

## Datos existentes a reutilizar

1. El flujo de degradación honesta a `AI_NON_CONCLUSIVE` ya existe en [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py#L697-L744).
2. El parser tolerante ya intenta rescatar el primer bloque `{...}` en [backend/app/services/ai/base.py](backend/app/services/ai/base.py#L25-L54).
3. La extracción de Audiometría y su contrato actual no deben tocarse en este slice.

## Datos faltantes a crear

1. Saneamiento previo al parseo para respuestas clínicas con prefijos basura tipo `<pad>`.
2. Mensaje de error neutral por proveedor en el parser compartido.
3. Pruebas automatizadas que cubran el caso real reportado por el usuario.

## Alcance aprobado

Incluye:

1. endurecer el postproceso de `_call_featherless_text_only()`
2. volver agnóstico el mensaje de parseo compartido
3. agregar pruebas angostas del hotfix

No incluye:

1. recalibrar prompts de extracción o diagnóstico de Audiometría
2. tocar [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py)
3. cambiar proveedor clínico
4. reescribir el pipeline completo de prediagnóstico

## Archivos exactos a modificar

Máximo permitido: 3 archivos.

1. [backend/app/services/ai/prediagnostic.py](backend/app/services/ai/prediagnostic.py)
2. [backend/app/services/ai/base.py](backend/app/services/ai/base.py)
3. [backend/tests/test_ai_pipeline.py](backend/tests/test_ai_pipeline.py)

## Cambio mínimo obligatorio

1. Sanitizar `raw_text` de Featherless antes del parseo:
   - remover tokens `<pad>` repetidos al inicio o embebidos como relleno
   - remover fences Markdown si reaparecen
   - preservar el bloque JSON `{...}` cuando exista
2. Mantener parseo tolerante, pero con mensaje neutral tipo `Respuesta del modelo no es JSON parseable`.
3. Si después del saneamiento no hay JSON válido, conservar la degradación actual a `AI_NON_CONCLUSIVE` con motivo de Featherless, no de Gemini.

## Criterios de aceptación

1. Una respuesta clínica con prefijo `<pad><pad>` seguida de JSON válido ya no cae en `AI_NON_CONCLUSIVE`.
2. Una respuesta clínica realmente inválida sigue degradando a `AI_NON_CONCLUSIVE`.
3. El motivo final ya no contiene el texto `Respuesta de Gemini no es JSON parseable` cuando el proveedor clínico es Featherless.
4. No se altera el flujo extractivo de Audiometría.

## Validación exacta esperada

Ejecutar:

```bash
cd /workspaces/Administracion-medica-industrial/backend && pytest tests/test_ai_pipeline.py
```

Además, agregar y dejar en verde al menos estas tres pruebas dentro de [backend/tests/test_ai_pipeline.py](backend/tests/test_ai_pipeline.py):

1. respuesta clínica JSON puro
2. respuesta clínica con prefijo `<pad>` y JSON válido
3. respuesta clínica no JSON que degrade a `AI_NON_CONCLUSIVE` con motivo ligado a Featherless

## Criterio de éxito

La iteración será exitosa cuando Audiometría siga extrayendo igual, pero la capa clínica deje de romperse ante prefijos basura recuperables y el mensaje final refleje correctamente que el fallo pertenece al proveedor clínico o al parseo genérico, no a Gemini.