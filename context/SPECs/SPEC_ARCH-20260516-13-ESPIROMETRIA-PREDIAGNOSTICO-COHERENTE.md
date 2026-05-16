# SPEC ARCH-20260516-13: Espirometría — Prediagnóstico Clínico Coherente con la Tabla Fuente

- ID: ARCH-20260516-13
- Fecha: 2026-05-16
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260516-12-ESPIROMETRIA-EXTRACCION-EXHAUSTIVA.md
  - context/SPECs/SPEC_ARCH-20260516-02-CALIBRACION-V2-CASOS-REALES-AUDIO-ESPIRO.md

## 1. Objetivo

Endurecer la capa de prediagnóstico de Espirometría para que su resumen clínico no contradiga la tabla fuente extraída y produzca cierres prudentes, consistentes y trazables frente a patrones normales, obstructivos, mixtos o sugestivos de restricción.

## 2. Problema Observado

- El prompt clínico actual usa reglas generales ATS/ERS, pero sigue siendo demasiado corto para layouts reales más ricos.
- El sistema puede detectar en la justificación una señal compatible con restricción y luego cerrar con una etiqueta obstructiva o demasiado agresiva.
- El razonamiento clínico aún no está gobernado explícitamente por la jerarquía de evidencia extraída del documento real.

## 3. Hipótesis Local

Si el prediagnóstico de Espirometría se obliga a:

1. priorizar la tabla fuente completa
2. declarar de forma explícita qué parámetros gobernaron el cierre
3. degradar a `AI_NON_CONCLUSIVE` ante conflicto interno o calidad insuficiente

entonces se reducirá de forma material el riesgo de síntesis clínicas contradictorias.

## 4. Decisión Arquitectónica

Se aprueba un endurecimiento del prompt clínico de Espirometría con estas reglas:

1. La capa clínica debe apoyarse en la extracción exhaustiva nueva cuando exista.
2. La tabla tabular tiene precedencia sobre cualquier inferencia vaga derivada de la gráfica o del texto.
3. La conclusión clínica debe ser la salida de una jerarquía explícita de decisión y no de una redacción libre del modelo.
4. Si el propio análisis encuentra conflicto entre `ratio`, `FVC`, `% predicho`, `LLN`, calidad o repetibilidad, debe degradarse a `AI_NON_CONCLUSIVE` o a una formulación prudente no cerrada.

## 5. Reglas Clínicas Obligatorias

### A. Jerarquía de evidencia

El prompt debe ordenar al modelo así:

1. usar parámetros tabulares explícitos del documento
2. priorizar `LLN` si está disponible
3. si no hay `LLN`, usar umbrales prudentes de ATS/ERS con limitación explícita
4. considerar `repetibilidad` y `notas_calidad` antes de cerrar patrón

### B. Reglas mínimas de síntesis

1. Si `FEV1/FVC` está conservado y `FVC` o `FVC % predicho` está reducida, NO cerrar como obstructivo salvo evidencia adicional muy fuerte y explícita.
2. Si `FEV1/FVC` está disminuido y `FVC` también está reducida, considerar patrón mixto o calidad insuficiente; no simplificar automáticamente a obstructivo.
3. Si `repetibilidad_ats_ers_fvc` o `repetibilidad_ats_ers_fev1` son negativas, bajar confianza y explicitar limitaciones.
4. Si faltan `FEV1`, `FVC` o la relación relevante, degradar a `AI_NON_CONCLUSIVE`.
5. Si la conclusión contradice una justificación numérica previa, prevalece la degradación a `AI_NON_CONCLUSIVE`.

### C. Recommendation

Se autoriza un campo `recommendation` prudente en Espirometría, bajo estos límites:

1. sugerir correlación clínica
2. sugerir repetición o mejor calidad técnica si el estudio es dudoso
3. sugerir comparación con estudios previos o valoración médica complementaria si hay patrón sugestivo
4. prohibido emitir aptitud, incapacidad, tratamiento o dictamen final

## 6. Cambios Esperados en Prompt

El prompt clínico debe:

1. recibir la estructura exhaustiva nueva sin romper compatibilidad hacia atrás
2. obligar al modelo a citar parámetros concretos de la tabla en `justification`
3. poblar `clinical_basis` con las claves efectivamente usadas
4. incluir reglas explícitas de degradación por conflicto o baja calidad
5. devolver `recommendation` no nula cuando haya información suficiente para una recomendación prudente

## 7. Alcance

### Incluye

1. ajustar `backend/app/services/ai/prediagnostic.py` para Espirometría
2. adaptar la lectura del nuevo payload extractivo exhaustivo
3. endurecer tests del slice clínico para evitar cierres contradictorios

### No incluye

1. dictamen final médico
2. cambio de flujo clínico
3. interpretación automatizada de curvas fuera de la evidencia tabular

## 8. Criterios de Aceptación

1. El prediagnóstico de Espirometría ya no emite cierres obstructivos cuando la evidencia tabular soporte mejor una lectura sugestiva de restricción o una salida no concluyente.
2. La justificación cita parámetros específicos del payload extractivo nuevo.
3. La confianza baja cuando la calidad técnica o repetibilidad sean insuficientes.
4. `recommendation` queda visible en lenguaje prudente y sin invadir aptitud ni tratamiento.
5. Existe al menos una prueba dirigida con un caso real o representativo de FVC reducida y ratio conservado.

## 9. Resultado Esperado

Espirometría deja de depender de una síntesis clínica demasiado libre y pasa a producir un prediagnóstico más disciplinado, gobernado por la tabla fuente, la calidad técnica y reglas explícitas de coherencia clínica.