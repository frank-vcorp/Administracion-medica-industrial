# SPEC_ARCH-20260518-06 — Base universal de extracción y plantilla guiada en calibración

## Objetivo
Separar la política universal de extracción médica del bloque específico por estudio para que:
- el backend conserve una base extractiva estable y homogénea
- la calibración solo capture reglas particulares del estudio
- cualquier calibrador tenga una plantilla visible sobre qué pedir y cómo pedirlo

## Decisión
1. El backend compone el prompt final de extracción como:
   - base universal fija en código
   - más bloque específico editable en `aiCalibration.extraction.prompt`
2. La UI de calibración debe exponer el campo real `extraction.prompt`.
3. La UI debe mostrar una plantilla reusable y una guía breve para pedir a Copilot el bloque específico.
4. La UI debe exponer también el prompt clínico editable para mantener coherencia con la regla de dos prompts por prueba.

## Criterios de aceptación
- El editor de calibración permite guardar `extraction.prompt` y `diagnosis.prompt`.
- El editor muestra una plantilla específica de extracción junto al campo.
- El editor aclara que el bloque editable no sustituye la base universal del backend.
- El backend mantiene error explícito si falta `aiCalibration.extraction.prompt`.
- El backend concatena la base universal con el prompt específico antes de llamar a Gemini.

## Notas
- La base universal puede decir que se trata de datos médicos para mejorar reconocimiento documental.
- La base universal no debe permitir interpretación clínica.
- La parte específica por estudio se versiona desde calibración.