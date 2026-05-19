# HANDOFF ARCH-20260518-03 -> SOFIA

## Contexto

Se corrigió la hipótesis intermedia del corte anterior. El usuario aclaró la regla operativa real del sistema:

1. extracción siempre gobernada por calibración personalizada
2. sin fallback de extracción
3. fallback permitido solo para clínica

Además, el contrato clínico actual ya exige explícitamente `justification`, `citations` y `limitations`, y eso debe preservarse en cualquier refactor de resolución de prompts.

## Objetivo

Implementar la resolución correcta de prompts:

1. extracción desde `aiCalibration` como fuente única
2. error explícito si falta prompt de extracción
3. clínica desde `aiCalibration` con fallback general prudente solo si falta calibración clínica
4. preservar en salida clínica `justification`, `citations` y `limitations`

## Fuente de Verdad

- `context/SPECs/SPEC_ARCH-20260518-03-EXTRACCION-SIN-FALLBACK-CLINICA-CON-FALLBACK.md`

## Alcance mínimo

1. Ajustar la resolución de prompts de extracción para eliminar fallback backend.
2. Mantener fallback solo en la capa clínica.
3. Registrar correctamente en auditoría la fuente real usada.
4. Confirmar que `AIPrediagnosisResult` sigue siendo respetado por los prompts y el runtime.

## Restricciones

1. No permitir que extracción improvise con prompt genérico si falta calibración.
2. No reportar `prompt_version` inexistente o engañosa.
3. No degradar el contrato clínico actual de evidencia/justificación.

## Validación pedida

1. Caso con calibración completa: extracción y clínica resuelven desde `aiCalibration`.
2. Caso sin prompt de extracción: error explícito de configuración.
3. Caso sin prompt clínico: entra fallback clínico general.
4. Confirmar que la salida clínica sigue trayendo `justification`, `citations` y `limitations`.