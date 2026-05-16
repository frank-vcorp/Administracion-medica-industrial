# SPEC ARCH-20260516-09: RAW de Prediagnóstico con Paridad Visual al RAW de Extracción

## 1. Objetivo
Hacer que el cuadro de `RAW de entrada clínica` tenga la misma presencia visual y descubrilidad que el cuadro de `RAW de extracción`, para que el usuario pueda ubicarlo de inmediato en la papeleta sin tener que adivinar que está embebido dentro del panel de prediagnóstico.

## 2. Problema Observado
- El `RAW de extracción` se renderiza como un bloque técnico oscuro, abierto y claramente identificable en la columna derecha.
- El `RAW de entrada clínica` se renderiza hoy como un `details` blanco, discreto y embebido dentro del panel de prediagnóstico en la columna izquierda.
- El contraste visual actual hace que el usuario no lo perciba como un panel RAW equivalente.

## 3. Hipótesis Local
El problema principal no es ausencia de datos, sino falta de paridad visual y de ubicación percibida. Si el RAW clínico adopta el mismo lenguaje visual del RAW de extracción, el usuario lo encontrará y lo interpretará como panel técnico equivalente.

## 4. Decisión Arquitectónica
Se aprueba un ajuste de UX visual sin alterar la lógica clínica:
- `StudyPrediagnosisRawPanel` debe adoptar la misma semántica visual base que `StudyExtractionRawPanel`.
- Debe verse como bloque técnico oscuro, con header claro, copy affordance y contenido `pre` monoespaciado.
- Debe permanecer colapsable, pero con mayor visibilidad inicial.

## 5. Alcance
### Incluye
- Restilar `StudyPrediagnosisRawPanel` para que se vea como panel RAW técnico equivalente al de extracción.
- Mantener el contenido ya aprobado: `input_debug`, `medical_calibration`, `rendered_prompt`.
- Mejorar descubrilidad con header técnico, badges y affordances más visibles.

### No incluye
- Cambios al contrato de persistencia de `input_debug`.
- Cambios al extractor o al motor clínico.
- Reubicar necesariamente el panel fuera del bloque de prediagnóstico, salvo que el ajuste mínimo lo requiera para conservar paridad.

## 6. Criterios de Aceptación
1. El panel de `RAW de entrada clínica` se reconoce visualmente como hermano del `RAW de extracción`.
2. Usa bloque oscuro, tipografía monoespaciada y affordance de expansión/copia equivalente.
3. Sigue mostrando `extracted_data`, `medical_calibration` y `rendered_prompt`.
4. Snapshots viejos sin `input_debug` no rompen la UI.

## 7. Validación Esperada
- Abrir una Audiometría con `input_debug` persistido.
- Confirmar que el panel RAW clínico es visible de inmediato y no se pierde dentro del card blanco del prediagnóstico.
- Confirmar que el usuario puede distinguir rápidamente entre:
  - RAW de extracción
  - RAW de entrada clínica

## 8. Resultado Esperado
El RAW clínico deja de verse como detalle secundario y pasa a tener el mismo lenguaje visual técnico que el RAW de extracción.