# SPEC ARCH-20260519-04 — Estabilización final de Audiometría

## Objetivo

Cerrar el frente restante de Audiometría separando con claridad dos defectos distintos:

1. Ajustes residuales de presentación en frontend para que la extracción clínica refleje fielmente el formato real.
2. Corrimiento tabular residual en extracción del oído izquierdo, hoy visible como `125=10` y `500=null` donde el documento fuente muestra `125` vacío y `500=10`.

## Contexto validado

- El renderer ya volvió a mostrar la tabla de vía aérea tras la compatibilización publicada en `9346708`.
- El payload revalidado vigente usa `oido_x.via_aerea`, `oido_x.via_osea`, `pta`, `notas_calidad` como string y `paciente_detalle.notas`.
- El schema visual aún no cubre completamente esta variante porque sigue priorizando `pta_visible`, `notas_calidad.descripcion` y un orden reducido de frecuencias.
- El defecto extractivo no es visual: el ojo izquierdo sigue presentando un corrimiento real frente a la tabla fuente.

## Alcance

### Slice A — Frontend

Corregir de forma mínima la presentación de Audiometría para:

1. Mostrar PTA cuando el payload traiga `pta` o `pta_visible`.
2. Mostrar `notas_calidad` cuando llegue como string, arreglo o estructura con `descripcion`.
3. Ordenar la tabla bilateral en el orden clínico completo del formato: `125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000`.

### Slice B — Backend / Extractor

Emitir dictamen técnico sobre el corrimiento residual del oído izquierdo y, si el análisis lo confirma, preparar implementación mínima posterior para endurecer extracción tabular sin reintroducir lectura desde la gráfica.

## Criterios de aceptación

1. La UI de Audiometría muestra PTA por oído aunque el payload use `pta` en lugar de `pta_visible`.
2. La UI muestra `notas_calidad` legibles cuando lleguen como string plano, arreglo de strings o estructura con `descripcion`.
3. La tabla de vía aérea respeta el orden `125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000` cuando existan esos valores.
4. No se rompe compatibilidad con snapshots históricos que usen `va/vo/pta_visible`.
5. Existe dictamen forense independiente que confirme o refute la hipótesis de corrimiento residual en extracción del oído izquierdo.

## No objetivos

- No recalcular diagnóstico clínico en frontend.
- No mezclar el problema visual con la lógica de prediagnóstico.
- No rehacer el pipeline completo de extracción de Audiometría en este corte.

## Validación esperada

- Frontend: `tsc --noEmit` en `frontend/` o validación equivalente sin errores.
- Backend / Forense: dictamen técnico con check discriminante basado en el estudio real revalidado.

## Archivos probables

- `frontend/src/components/clinical/extraction-presentation-schemas.ts`
- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`
- `backend/app/services/ai/extractor.py` si el dictamen confirma ajuste mínimo necesario
- `backend/tests/test_ai_pipeline.py` si se implementa corrección extractiva posterior