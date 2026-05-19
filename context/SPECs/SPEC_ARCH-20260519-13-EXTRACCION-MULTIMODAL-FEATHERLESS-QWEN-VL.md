# SPEC ARCH-20260519-13 — Extracción multimodal en Featherless con Qwen-VL

- ID: ARCH-20260519-13
- Fecha: 2026-05-19
- Agente: INTEGRA - Arquitecto
- Estado: Lista para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260513-02-PILOTO-MEDGEMMA-FEATHERLESS.md
  - context/SPECs/SPEC_ARCH-20260513-08-MEDGEMMA-OPENAI-SDK-FEATHERLESS.md
  - context/SPECs/SPEC_ARCH-20260518-03-EXTRACCION-SIN-FALLBACK-CLINICA-CON-FALLBACK.md
  - context/SPECs/SPEC_ARCH-20260518-06-BASE-EXTRACCION-Y-PLANTILLA-CALIBRACION.md

## Objetivo

Reemplazar Gemini por Featherless + Qwen-VL en todo el frente extractivo para leer PDFs e imágenes clínicas con menor costo y mejor desempeño esperado en extracción visual, manteniendo intacta la separación entre extracción documental y prediagnóstico clínico.

La capa objetivo queda así:

1. clasificación documental con Qwen-VL en Featherless
2. extracción documental estructurada con Qwen-VL en Featherless
3. prediagnóstico clínico sin cambios en este corte

## Decisión de arquitectura

Se aprueba lo siguiente:

1. el modelo correcto para extracción visual en Featherless es Qwen/Qwen3-VL-30B-A3B-Instruct
2. Qwen/Qwen3.6-35B-A3B no se aprueba para extracción de imágenes en este corte porque corresponde a una variante textual y no al proveedor visual objetivo
3. Gemini sale del runtime extractivo del backend y deja de ser dependencia operativa para clasificación y extracción documental
4. la capa clínica no cambia en esta iteración; cualquier uso clínico de Featherless sigue siendo una decisión separada
5. la extracción seguirá gobernada por aiCalibration.extraction.prompt y por la base universal del backend; cambia el motor multimodal subyacente y también el clasificador documental del frente extractivo

## Problema que resuelve

Hoy el sistema tiene una dependencia costosa de Gemini para el frente extractivo.

Eso deja tres limitaciones operativas:

1. el costo del proveedor extractivo actual es alto para operación continua
2. no se aprovecha un modelo visual que el usuario considera más fuerte para la extracción documental
3. la observabilidad actual no está pensada para un frente extractivo 100% Featherless

## Alcance aprobado

Incluye:

1. reemplazar Gemini por Featherless en clasificación documental y extracción estructurada
2. fijar como modelo visual inicial Qwen/Qwen3-VL-30B-A3B-Instruct
3. exponer en estado y snapshots qué proveedor y modelo de extracción corrieron realmente
4. mantener la capa clínica totalmente separada de esta decisión
5. cubrir validación mínima en estudios prioritarios con evidencia visual real

No incluye:

1. usar Qwen/Qwen3.6-35B-A3B para OCR o lectura de imagen
2. migrar prediagnóstico clínico a Qwen
3. abrir fallback silencioso de extracción si falta prompt de calibración
4. reescribir prompts por estudio fuera de los ajustes mínimos necesarios para compatibilidad multimodal
5. mantener Gemini como dependencia activa del frente extractivo

## Modelo aprobado para esta iteración

Proveedor y modelo objetivo:

1. proveedor: Featherless
2. modalidad: multimodal visión + texto
3. modelo inicial: Qwen/Qwen3-VL-30B-A3B-Instruct

Decisión explícita sobre el modelo textual visto por el usuario:

1. Qwen/Qwen3.6-35B-A3B queda fuera de la capa extractiva visual
2. si se desea evaluarlo, debe abrirse luego como experimento textual separado para resumido, normalización o razonamiento posterior al OCR, no como lector primario de imagen

## Diseño técnico mínimo

### Capa 1. Clasificación documental

La clasificación documental pasa al mismo proveedor del frente extractivo:

1. DocumentClassifierService debe resolverse sobre Featherless con Qwen-VL
2. se elimina Gemini como proveedor de clasificación en runtime
3. el objetivo es unificar costo, proveedor y modalidad en la capa extractiva completa

### Capa 2. Extracción documental

La extracción documental pasa a Featherless como proveedor único del frente extractivo.

Comportamiento esperado:

1. si existen FEATHERLESS_API_KEY y FEATHERLESS_EXTRACTION_MODEL, clasificador y extractor llaman a Featherless
2. si falta configuración mínima de Featherless, la inicialización debe reflejar estado degradado honesto
3. la regla de extracción sin fallback de prompt permanece intacta: si falta aiCalibration.extraction.prompt, la corrida falla como error de configuración, no cambia a un prompt genérico
4. Gemini no debe seguir ejecutándose en esta capa como fallback silencioso

### Capa 3. Prediagnóstico clínico

No cambia:

1. PrediagnosticService sigue usando su política actual
2. FEATHERLESS_MODEL clínico y FEATHERLESS_EXTRACTION_MODEL deben ser variables distintas
3. no se permite reutilizar el modelo visual de extracción como sustituto automático de la capa clínica

## Variables de entorno objetivo

Nuevas o redefinidas para este corte:

1. FEATHERLESS_API_KEY
2. FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
3. FEATHERLESS_EXTRACTION_MODEL=Qwen/Qwen3-VL-30B-A3B-Instruct

Se conservan:

1. MEDGEMMA_ENABLED
2. FEATHERLESS_MODEL para clínica si el frente clínico sigue activo

Se eliminan del runtime extractivo:

1. GEMINI_API_KEY como requisito para clasificación y extracción
2. GEMINI_MODEL_EXTRACTION como selector operativo de la capa extractiva

## Observabilidad obligatoria

El sistema debe exponer con honestidad:

1. extraction_provider_active=featherless cuando la capa esté operativa
2. extraction_model_active
3. featherless_extraction_configured true o false
4. clinical_provider_active sin alterarlo por este corte

Además, el snapshot o payload persistido del análisis debe poder trazar:

1. extraction_provider
2. extraction_model_used

## Archivos esperados para implementación

El corte debe mantenerse dentro de cinco superficies:

1. backend/app/services/ai/extractor.py
2. backend/app/main.py
3. backend/app/schemas/medical.py
4. backend/tests/test_ai_pipeline.py
5. backend/tests/test_pdf_services.py solo si hiciera falta cobertura adicional del camino multimodal

## Validación obligatoria

### Validación técnica

1. api status debe reportar correctamente proveedor y modelo de extracción activos
2. con credenciales válidas el clasificador y el extractor deben completar una corrida real o mockeada por el camino Featherless
3. si Featherless responde error de permisos o capacidad, el sistema debe explicitarlo en estado o resultado
4. Gemini no debe aparecer como proveedor extractivo activo tras este corte

### Validación funcional mínima

1. un PDF de Audiometría o Espirometría debe recorrer la extracción con Qwen-VL y devolver JSON parseable
2. una imagen o PDF de Rayos_X debe al menos completar la llamada y producir estructura coherente con el contrato vigente
3. el frontend y la papeleta no deben requerir cambios para consumir este corte

### Validación de regresión

1. la capa clínica debe seguir trazando featherless o gemini como hasta hoy, sin contaminación desde extracción
2. aiCalibration.extraction.prompt debe seguir siendo requisito obligatorio
3. el endpoint /api/v2/ai/status no debe perder información vigente de MedGemma
4. el frontend y la papeleta no deben depender de nombres legacy como gemini_model para interpretar resultados extractivos

## Criterios de aceptación

1. Featherless opera clasificación y extracción multimodal con Qwen/Qwen3-VL-30B-A3B-Instruct
2. Qwen/Qwen3.6-35B-A3B no queda cableado como extractor visual por error de modalidad
3. el sistema expone proveedor y modelo extractivos reales en status y trazabilidad
4. Gemini deja de figurar como proveedor extractivo activo
5. la separación extracción versus clínica se conserva sin ambigüedad
6. el corte queda validado al menos sobre Audiometría o Espirometría y un estudio de imagen como Rayos_X si hay muestra disponible

## Riesgos conocidos

1. Featherless puede exponer diferencias de formato o parseo respecto al comportamiento histórico, especialmente en tablas densas
2. algunos PDFs clínicos complejos pueden requerir ajuste fino del bloque específico de extracción en calibración
3. si la cuenta Featherless no tiene modalidad o capacidad suficiente para el modelo visual elegido, el sistema debe declararlo de forma explícita
4. al retirar Gemini del frente extractivo, cualquier incidencia de Featherless impacta directamente clasificación y extracción hasta que exista otro reemplazo aprobado

## Definición de listo para implementación

La SPEC queda lista cuando SOFIA pueda implementar el cambio como reemplazo del frente extractivo por Featherless + Qwen-VL, sin reabrir arquitectura clínica ni rediseñar el pipeline general.