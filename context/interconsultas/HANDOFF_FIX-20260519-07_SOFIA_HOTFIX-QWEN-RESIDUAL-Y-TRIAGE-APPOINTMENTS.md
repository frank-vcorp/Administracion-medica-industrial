# HANDOFF FIX-20260519-07 -> SOFIA

## Contexto

Tras desplegar el corte ARCH-20260519-13 en producción, el usuario reportó dos síntomas:

1. en la carga IA de Audiometría aparece `name 'GEMINI_MODEL' is not defined`
2. en `/appointments` Vercel muestra `500` con error genérico de Server Components render

La evidencia ya separa ambos frentes.

## Diagnóstico confirmado

### A. Hotfix backend confirmado

Quedaron referencias residuales a constantes eliminadas durante la migración de extracción a Qwen.

Anclas confirmadas:

1. `backend/app/main.py` en el payload `extraction_snapshot.audit.model_name` todavía usa `GEMINI_MODEL`
2. `backend/app/main.py` en `prediagnosis_snapshot.audit.model_name` todavía usa `predx_model_used or GEMINI_MODEL`
3. `backend/app/main.py` en `v2_prediagnosis_from_params.audit.model_extraction` todavía usa `GEMINI_MODEL_EXTRACTION`

Este defecto sí explica el error visible en la UI de subida IA.

### B. `/appointments` parece frente separado

La ruta pública `https://administracion-medica-industrial.vercel.app/appointments` responde login y no reproduce por sí sola el NameError del backend IA.

Hipótesis de trabajo:

1. `/appointments` es un segundo defecto de frontend/Vercel o de la cadena de server actions de citas
2. no debe bloquear el hotfix backend del NameError

## Objetivo

Corregir primero el hotfix backend confirmado y luego validar si `/appointments` sigue fallando. Solo si persiste, abrir segundo slice de triage sobre citas.

## Alcance mínimo

1. reemplazar toda referencia residual a `GEMINI_MODEL` o `GEMINI_MODEL_EXTRACTION` en `backend/app/main.py` por los campos correctos del frente extractivo vigente
2. asegurar que los payloads/audits usen `FEATHERLESS_EXTRACTION_MODEL` o el modelo extractivo resuelto, según corresponda
3. rerun del test backend relevante
4. validar en Railway que desaparezca el error `name 'GEMINI_MODEL' is not defined`
5. después del hotfix, revalidar `/appointments` en Vercel para decidir si requiere segundo corte

## Restricciones

1. no reintroducir Gemini como proveedor extractivo
2. no tocar la semántica clínica actual
3. no mezclar en el mismo cambio una refactorización amplia de citas si `/appointments` requiere investigación aparte

## Archivos ancla

1. `backend/app/main.py`
2. `backend/tests/test_ai_pipeline.py`

## Validación pedida

1. el upload IA ya no debe devolver `name 'GEMINI_MODEL' is not defined`
2. `/api/v2/ai/status` debe seguir reportando `extraction_provider_active=featherless`
3. si `/appointments` sigue en 500 tras el hotfix backend y redeploy correspondiente, reportarlo como bug separado con ancla en frontend