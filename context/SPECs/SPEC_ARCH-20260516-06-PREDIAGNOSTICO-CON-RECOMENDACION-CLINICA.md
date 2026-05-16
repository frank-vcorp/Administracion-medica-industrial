# SPEC ARCH-20260516-06: Prediagnóstico IA con Recomendación Clínica Visible

## 1. Objetivo
Corregir el contrato del prediagnóstico IA para que entregue, persista y muestre una recomendación clínica breve y útil para el médico, sin cruzar la línea de aptitud laboral, dictamen final ni tratamiento prescriptivo.

## 2. Problema Observado
- El prediagnóstico actual sí genera resumen, justificación, limitaciones y fuentes.
- No genera recomendación visible porque la capa clínica fue diseñada sin ese campo.
- En Audiometría el resultado se siente incompleto: interpreta que la audición es normal, pero no propone conducta sugerida o seguimiento.
- El problema no depende del extractor ni del versionado del snapshot.

## 3. Causa Raíz
### 3.1 Prompt clínico
Los prompts de prediagnóstico contienen restricciones explícitas contra recomendaciones:
- Audiometría: "NO emitas aptitud laboral, dictamen médico final ni recomendaciones de alta o baja."
- Otros tipos también restringen recomendaciones de tratamiento.

### 3.2 Schema clínico
`AIPrediagnosisResult` no incluye un campo de recomendación, por lo que aunque el LLM quisiera emitirlo, el contrato actual no lo espera ni lo formaliza.

### 3.3 UI clínica
La tarjeta del prediagnóstico solo renderiza:
- `summary`
- `confidence`
- `justification`
- `limitations`
- `citations`
- `red_flags`

No existe bloque visible de `recommendation` o `suggested_follow_up`.

## 4. Decisión Arquitectónica
Se corrige el contrato del prediagnóstico IA para incluir una capa explícita de recomendación clínica prudente.

La recomendación debe entenderse como:
- sugerencia de correlación clínica
- seguimiento o vigilancia sugerida
- medidas preventivas generales de salud ocupacional cuando correspondan

La recomendación NO puede ser:
- aptitud laboral
- dictamen final
- incapacidad
- alta/baja laboral
- tratamiento farmacológico prescriptivo

## 5. Alcance
### Incluye
- Ajustar prompts clínicos para exigir una recomendación breve y prudente.
- Extender `AIPrediagnosisResult` con un campo explícito de recomendación.
- Persistir ese campo dentro del snapshot clínico ya existente.
- Mostrar la recomendación en la tarjeta de prediagnóstico.

### No incluye
- Cambios al extractor documental.
- Cambios a la lógica de aptitud laboral o dictamen médico final.
- Reprocesamiento masivo de snapshots históricos.
- Rediseño general del panel clínico.

## 6. Contrato Propuesto
Agregar al resultado clínico un campo tipo:

```json
"recommendation": "Sugerir vigilancia audiométrica periódica y reforzar uso consistente de protección auditiva según exposición ocupacional y criterio médico."
```

### Regla de contenido
- Máximo 1 a 2 oraciones.
- Lenguaje prudente y no prescriptivo.
- Basado en el patrón interpretado y el contexto ocupacional cuando aplique.
- Si el caso es no concluyente, la recomendación debe orientarse a revisión médica o repetición/validación del estudio, no a conclusiones clínicas fuertes.

## 7. Criterios de Aceptación
1. Un prediagnóstico nuevo de Audiometría devuelve un campo de recomendación clínica en el payload estructurado.
2. La recomendación se persiste dentro del snapshot clínico sin romper snapshots previos.
3. La tarjeta del prediagnóstico muestra una sección visible de recomendación o seguimiento sugerido.
4. La recomendación nunca expresa aptitud laboral, dictamen final ni tratamiento prescriptivo.
5. Si el estudio es `AI_NON_CONCLUSIVE`, la recomendación visible se adapta a ese estado con wording prudente.

## 8. Regla Clínica Inicial para Audiometría
### Si audición dentro de límites normales
Permitir recomendaciones del tipo:
- correlacionar con clínica y exposición ocupacional
- mantener vigilancia periódica según programa de salud ocupacional
- reforzar uso de protección auditiva si hay exposición a ruido

### Si hay hallazgos sugestivos
Permitir recomendaciones del tipo:
- valoración médica complementaria
- comparación con audiometrías previas
- seguimiento audiométrico

### Si es no concluyente
Permitir recomendaciones del tipo:
- repetir estudio
- validar calidad documental
- completar información faltante

## 9. Archivos Objetivo
- `backend/app/schemas/medical.py`
- `backend/app/services/ai/prediagnostic.py`
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx`
- Tests clínicos acotados del pipeline IA si ya existen para este contrato

## 10. Prioridad Relativa
Este corte sustituye como prioridad inmediata al slice de observabilidad RAW del prediagnóstico. El RAW puede quedar como mejora secundaria posterior; la necesidad actual del usuario es obtener una recomendación clínica útil en la salida visible.

## 11. Validación Esperada
- Reprocesar una Audiometría normal.
- Confirmar que el resumen clínico siga prudente.
- Confirmar que aparece recomendación visible.
- Verificar que la recomendación no invade aptitud laboral ni tratamiento.

## 12. Resultado Esperado
El prediagnóstico deja de sentirse incompleto y entrega una conducta sugerida útil para revisión médica, manteniendo intactos los guardrails legales y clínicos.