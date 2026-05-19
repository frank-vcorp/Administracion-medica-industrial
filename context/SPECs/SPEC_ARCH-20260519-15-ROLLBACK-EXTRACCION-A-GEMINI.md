# SPEC ARCH-20260519-15 — Rollback de extracción a Gemini

- ID: ARCH-20260519-15
- Fecha: 2026-05-19
- Agente: INTEGRA - Arquitecto
- Estado: Lista para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260519-13-EXTRACCION-MULTIMODAL-FEATHERLESS-QWEN-VL.md
  - context/checkpoints/CHK_DOC-20260519-05-CIERRE-SESION-QWEN-CAPACITY.md
  - context/SPECs/SPEC_ARCH-20260518-03-EXTRACCION-SIN-FALLBACK-CLINICA-CON-FALLBACK.md

## Objetivo

Restaurar Gemini como proveedor operativo del frente extractivo para clasificación documental y extracción estructurada, dejando a Featherless fuera del runtime extractivo mientras permanezca la inestabilidad por capacidad del modelo Qwen-VL en producción.

La capa clínica no cambia en este corte.

## Decisión de arquitectura

Se aprueba lo siguiente:

1. Gemini vuelve a ser el proveedor activo de clasificación documental y extracción estructurada
2. Featherless + Qwen-VL sale del runtime extractivo, sin eliminar necesariamente el código de soporte si puede quedar encapsulado para futura reactivación
3. la capa clínica permanece separada y sin cambios
4. se conserva la regla de extracción sin fallback de prompt: si falta `aiCalibration.extraction.prompt`, la corrida debe fallar como error de configuración
5. el sistema debe exponer con honestidad que el proveedor extractivo activo volvió a ser Gemini

## Motivo del rollback

La validación productiva confirmó que la integración con Qwen quedó técnicamente desplegada, pero no es operativamente confiable para el flujo actual de AMI porque el proveedor responde `503 capacity_exhausted` sobre `Qwen/Qwen3-VL-30B-A3B-Instruct` en corridas reales de `/api/v2/studies/upload-and-analyze`.

Para AMI, el criterio prioritario en este momento es continuidad operativa de la extracción, no exploración de proveedor.

## Problema que resuelve

Hoy el flujo extractivo puede quedar interrumpido por capacidad del proveedor Featherless aunque la integración esté correcta.

Eso rompe el caso de uso principal:

1. subir estudios y obtener extracción clínica usable en tiempo real
2. sostener el flujo de Audiometría y otros estudios sin depender de saturación externa del modelo Qwen-VL
3. evitar mensajes ambiguos o fallas intermitentes en la papeleta por indisponibilidad del proveedor extractivo

## Alcance aprobado

Incluye:

1. restaurar Gemini en `DocumentClassifierService` y en el extractor documental
2. volver a declarar Gemini como proveedor extractivo activo en `/api/v2/ai/status`
3. ajustar trazabilidad y payloads para que reporten proveedor/modelo reales del rollback
4. preservar intacta la capa clínica
5. cubrir validación mínima del camino restaurado

No incluye:

1. rediseñar prompts clínicos o extractivos
2. abrir un mecanismo de fallback dual Gemini/Featherless en esta iteración
3. reactivar Qwen con balanceo o reintentos avanzados
4. cambiar el contrato funcional del frontend más allá de la observabilidad honesta del proveedor activo

## Diseño técnico mínimo

### Capa 1. Clasificación documental

1. `DocumentClassifierService` vuelve a resolver sobre Gemini
2. `GEMINI_API_KEY` vuelve a ser requisito operativo del clasificador extractivo
3. `FEATHERLESS_EXTRACTION_MODEL` deja de gobernar el runtime extractivo

### Capa 2. Extracción documental

1. el extractor vuelve a usar Gemini como motor multimodal/documental activo
2. la extracción sin fallback de prompt sigue intacta
3. si falta configuración de Gemini, el sistema debe declararlo de forma honesta en estado y/o inicialización

### Capa 3. Prediagnóstico clínico

1. no cambia
2. `FEATHERLESS_MODEL` clínico sigue separado del proveedor extractivo
3. no mezclar semántica de extracción con la capa clínica

## Variables de entorno objetivo

Activas para este corte:

1. `GEMINI_API_KEY`
2. `GEMINI_MODEL_EXTRACTION` o la variable extractiva Gemini equivalente ya usada por el backend

Sin uso operativo en extracción durante este corte:

1. `FEATHERLESS_EXTRACTION_MODEL`
2. cualquier bandera que deje a Featherless como proveedor extractivo activo

Se conservan para clínica si ya existen:

1. `MEDGEMMA_ENABLED`
2. `FEATHERLESS_MODEL`
3. `FEATHERLESS_API_KEY`

## Observabilidad obligatoria

El sistema debe exponer:

1. `extraction_provider_active=gemini`
2. `extraction_model_active` con el modelo real de Gemini usado
3. `clinical_provider_active` sin cambios de semántica
4. trazabilidad de `extraction_provider` y `extraction_model_used` en el resultado o snapshot

## Superficie esperada

1. backend/app/services/ai/classifier.py
2. backend/app/services/ai/extractor.py
3. backend/app/main.py
4. backend/tests/test_ai_pipeline.py

## Validación obligatoria

### Validación técnica

1. `/api/v2/ai/status` debe reportar `extraction_provider_active=gemini`
2. clasificación y extracción deben completar una corrida real o mockeada por el camino Gemini
3. Featherless no debe figurar como proveedor extractivo activo después del rollback
4. la capa clínica debe seguir reportando su proveedor sin contaminación desde extracción

### Validación funcional mínima

1. un PDF de Audiometría o Espirometría debe recorrer nuevamente el pipeline extractivo con Gemini
2. la papeleta no debe romper por cambios de contrato del payload
3. los mensajes de error deben seguir siendo honestos si Gemini no está configurado

## Criterios de aceptación

1. Gemini vuelve a operar clasificación y extracción documental
2. Qwen deja de ser el proveedor extractivo activo en producción
3. `/api/v2/ai/status` refleja el rollback correctamente
4. la capa clínica permanece sin cambios
5. el flujo de subida y extracción vuelve a priorizar continuidad operativa

## Riesgos conocidos

1. volver a Gemini reintroduce el costo operativo que el usuario quería evitar
2. si quedaron referencias residuales al camino Qwen en observabilidad o payloads, pueden generar trazabilidad inconsistente
3. el rollback debe ser completo en runtime extractivo para evitar estados híbridos difíciles de depurar

## Definición de listo para implementación

La SPEC queda lista cuando SOFIA pueda restaurar Gemini como proveedor extractivo activo sin tocar la capa clínica, validar el estado en `/api/v2/ai/status` y dejar el flujo nuevamente operativo para uso real.