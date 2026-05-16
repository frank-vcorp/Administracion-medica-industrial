# HANDOFF ARCH-20260516-02 a SOFIA — Calibración V2 con casos reales de Audiometría y Espirometría

- ID: ARCH-20260516-02
- Fecha: 2026-05-16
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementación
- SPEC fuente: context/SPECs/SPEC_ARCH-20260516-02-CALIBRACION-V2-CASOS-REALES-AUDIO-ESPIRO.md

## Objetivo

Usar los hallazgos reales ya observados en producción para ejecutar una calibración V2 enfocada de Audiometría y Espirometría, y después dejar preparado el terreno para una nueva prueba comparativa.

La corrección clave al enfoque es esta: NO resuelvas esta calibración como ajuste invisible de prompts/backend solamente. Debe entrar por el panel existente de calibración por prueba y reflejarse ahí.

## Qué ya está verificado y no debes redescubrir

### Audiometría

1. la extracción actual ya es útil y clínicamente consistente
2. el problema no es de lógica clínica principal, sino de precisión fina y cobertura de campos visibles del PDF
3. la sospecha fuerte es que el extractor mezcla gráfica y tabla cuando ambas existen

### Espirometría

1. el extractor ya captura el núcleo útil
2. el razonamiento intermedio ya puede aproximarse a lectura restrictiva
3. la conclusión final puede contradecir esos mismos números
4. además el PDF muestra más campos de los que hoy se persisten

## Punto de entrada real

1. `frontend/src/app/admin/services/[id]/calibration/page.tsx`
2. `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx`
3. `frontend/src/lib/calibration-schema.ts`
4. `frontend/src/types/calibration.ts`
5. `frontend/src/actions/medical-profiles.ts`
6. `backend/app/schemas/medical.py`
7. `backend/app/services/ai/extractor.py`
8. `backend/app/services/ai/prediagnostic.py`
9. `backend/tests/test_ai_pipeline.py`

## Alcance mínimo obligatorio

### Superficie de calibración obligatoria

1. la prueba debe poder abrirse en `/admin/services/[id]/calibration`
2. el criterio nuevo de calibración debe quedar visible en `aiCalibration`
3. debe ser posible revisar documento, extracción y diagnóstico dentro de esa consola para estos casos reales
4. no acepto una solución donde el comportamiento cambie pero el panel no exprese qué se calibró

### Slice A — Audiometría

1. reforzar extracción para que priorice tabla numérica explícita sobre aproximación de gráfica cuando ambas coexistan
2. mantener frecuencias canónicas por oído
3. si el PDF lo muestra con claridad, ampliar campos auxiliares de soporte sin romper el contrato actual
4. no degradar la consistencia clínica ya lograda
5. reflejar en la configuración de extracción de la prueba la precedencia tabla > gráfica

### Slice B — Espirometría

1. ampliar extracción con más campos visibles del PDF real
2. endurecer reglas clínicas para que la síntesis final no contradiga sus premisas
3. introducir guardrail específico para relación conservada + FVC reducida → no cerrar como obstrucción
4. si hay conflicto lógico entre justificación y conclusión, degradar a lectura conservadora o no concluyente
5. dejar esas reglas visibles en la configuración diagnóstica o notas de calibración de la prueba

## Casos de calibración obligatorios

Debes usar al menos estos dos patrones reales:

1. Audiometría con tabla y gráfica, resultado normal bilateral
2. Espirometría con FVC % predicho bajo, FEV1/FVC conservado y diagnóstico humano del documento compatible con patrón restrictivo

## Restricciones

1. no cambiar el flujo clínico ni la UI operativa principal salvo reflejos mínimos de contrato
2. no introducir diagnóstico final ni aptitud automática
3. no ocultar incertidumbre documental si el PDF es ambiguo
4. no mezclar calibración con reentrenamiento del modelo
5. no bypasses el panel de calibración ya existente

## Criterios de aceptación mínimos

1. Audiometría mejora precisión documental frente al PDF sin perder su salida clínica correcta
2. Espirometría deja de emitir cierres clínicos contradictorios en el caso restrictivo observado
3. los cambios quedan expresados y visibles en el panel `/admin/services/[id]/calibration`
4. existe validación dirigida en tests o casos comparativos contra estos ejemplos reales
5. dejas claro qué mejoró en extracción y qué mejoró en síntesis clínica

## Entregable esperado

1. cambios mínimos y defendibles en extractor/prediagnóstico
2. validación enfocada de ambos estudios
3. checkpoint técnico con comparación antes/después
4. sistema listo para que el usuario vuelva a subir o regenerar y hagamos otra prueba sobre documentos reales